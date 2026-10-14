"""
bert_qa.py
----------
Wrapper around Hugging Face BertForQuestionAnswering that adds:
  - Convenient load/save helpers
  - A predict() method that handles tokenisation, sliding window,
    null-threshold, and character-offset decoding in one call.

Usage:
    from training.models.bert_qa import BertQAModel
    model = BertQAModel.from_pretrained("artifacts/bert-squad2-v1")
    result = model.predict("Who wrote Hamlet?", "Shakespeare wrote Hamlet in 1600.")
"""

from __future__ import annotations

import json
import os
import time
from typing import Dict, Optional, Tuple

import torch
from transformers import BertForQuestionAnswering, BertTokenizerFast

# ── Defaults ───────────────────────────────────────────────────────────────
DEFAULT_MAX_LENGTH    = 512
DEFAULT_DOC_STRIDE    = 128
DEFAULT_MAX_ANS_LEN   = 30    # max answer span in tokens
DEFAULT_NULL_THRESHOLD = -2.35


class BertQAModel:
    """
    Wrapper around BertForQuestionAnswering with inference helpers.
    """

    def __init__(
        self,
        model:           BertForQuestionAnswering,
        tokenizer:       BertTokenizerFast,
        null_threshold:  float  = DEFAULT_NULL_THRESHOLD,
        model_version:   str    = "bert-base-squad2-v1",
        device:          str    = "cpu",
        max_length:      int    = DEFAULT_MAX_LENGTH,
        doc_stride:      int    = DEFAULT_DOC_STRIDE,
        max_answer_len:  int    = DEFAULT_MAX_ANS_LEN,
    ):
        self.model          = model.to(device).eval()
        self.tokenizer      = tokenizer
        self.null_threshold = null_threshold
        self.model_version  = model_version
        self.device         = device
        self.max_length     = max_length
        self.doc_stride     = doc_stride
        self.max_answer_len = max_answer_len

    # ── Factory methods ────────────────────────────────────────────────────

    @classmethod
    def from_pretrained(cls, model_dir: str, device: str = "cpu") -> "BertQAModel":
        """Load model + tokenizer + inference config from a directory."""
        model     = BertForQuestionAnswering.from_pretrained(model_dir)
        tokenizer = BertTokenizerFast.from_pretrained(model_dir)

        # Load inference config if present
        config_path = os.path.join(model_dir, "inference_config.json")
        null_threshold = DEFAULT_NULL_THRESHOLD
        model_version  = "bert-base-squad2-v1"
        if os.path.exists(config_path):
            with open(config_path) as f:
                cfg = json.load(f)
            null_threshold = cfg.get("null_threshold", null_threshold)
            model_version  = cfg.get("model_version",  model_version)

        return cls(model, tokenizer, null_threshold, model_version, device)

    @classmethod
    def from_pickle(
        cls,
        pkl_path: str,
        base_model: str = "bert-base-uncased",
        null_threshold: float = DEFAULT_NULL_THRESHOLD,
        model_version: str = "qa-model-pkl",
        device: str = "cpu",
    ) -> "BertQAModel":
        """Load a pickled BertForQuestionAnswering checkpoint safely across environments."""
        import sys
        import types
        import io
        import pickle

        # 1. Compatibility shim for older transformers versions
        if "transformers.core_model_loading" not in sys.modules:
            dummy_mod = types.ModuleType("transformers.core_model_loading")

            class WeightRenaming:
                def __init__(self, *args, **kwargs):
                    pass

                def __setstate__(self, state):
                    if isinstance(state, dict):
                        self.__dict__.update(state)
                    elif isinstance(state, tuple) and len(state) == 2 and isinstance(state[1], dict):
                        self.__dict__.update(state[1])
                    else:
                        self.state = state

            dummy_mod.WeightRenaming = WeightRenaming
            sys.modules["transformers.core_model_loading"] = dummy_mod

        # 2. Patch torch.storage._load_from_bytes for safe device deserialization
        orig_load = getattr(torch.storage, "_load_from_bytes", None)

        def _safe_load_from_bytes(b):
            return torch.load(io.BytesIO(b), map_location=device, weights_only=False)

        torch.storage._load_from_bytes = _safe_load_from_bytes
        try:
            with open(pkl_path, "rb") as f:
                raw_obj = pickle.load(f)
        finally:
            if orig_load is not None:
                torch.storage._load_from_bytes = orig_load

        if hasattr(raw_obj, "state_dict"):
            state_dict = raw_obj.state_dict()
        elif isinstance(raw_obj, dict):
            state_dict = raw_obj.get("state_dict", raw_obj)
        else:
            raise ValueError(f"Unsupported object type in pickle: {type(raw_obj)}")

        model = BertForQuestionAnswering.from_pretrained(base_model)
        model.load_state_dict(state_dict)
        tokenizer = BertTokenizerFast.from_pretrained(base_model)

        return cls(model, tokenizer, null_threshold=null_threshold, model_version=model_version, device=device)

    @classmethod
    def from_base(cls, device: str = "cpu") -> "BertQAModel":
        """Initialise from the base bert-base-uncased weights (no fine-tuning)."""
        model     = BertForQuestionAnswering.from_pretrained("bert-base-uncased")
        tokenizer = BertTokenizerFast.from_pretrained("bert-base-uncased")
        return cls(model, tokenizer, device=device, model_version="bert-base-uncased-baseline")

    # ── Save ───────────────────────────────────────────────────────────────

    def save(self, output_dir: str) -> None:
        """Save model weights, tokenizer, and inference config."""
        os.makedirs(output_dir, exist_ok=True)
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)
        config = {
            "null_threshold": self.null_threshold,
            "model_version":  self.model_version,
            "max_length":     self.max_length,
            "doc_stride":     self.doc_stride,
        }
        with open(os.path.join(output_dir, "inference_config.json"), "w") as f:
            json.dump(config, f, indent=2)
        print(f"Model saved to {output_dir}")

    # ── Core inference ─────────────────────────────────────────────────────

    def _best_span(
        self,
        start_logits: torch.Tensor,
        end_logits:   torch.Tensor,
        offset_mapping: list,
        sequence_ids:   list,
    ) -> Tuple[float, float, int, int]:
        """
        Returns (best_span_score, null_score, best_start_idx, best_end_idx).
        Only considers context tokens (sequence_id == 1).
        """
        null_score = (start_logits[0] + end_logits[0]).item()

        best_score = float("-inf")
        best_start = 0
        best_end   = 0

        n = len(start_logits)
        for i in range(1, n):
            if sequence_ids[i] != 1:
                continue
            if offset_mapping[i] == (0, 0):
                continue
            for j in range(i, min(i + self.max_answer_len, n)):
                if sequence_ids[j] != 1:
                    break
                if offset_mapping[j] == (0, 0):
                    break
                score = (start_logits[i] + end_logits[j]).item()
                if score > best_score:
                    best_score = score
                    best_start = i
                    best_end   = j

        return best_score, null_score, best_start, best_end

    def predict(self, question: str, context: str) -> Dict:
        """
        Full inference pipeline.

        Returns a dict matching the FastAPI QAResponse schema:
            answer, is_answerable, confidence_score,
            start_char, end_char, model_version, execution_time_ms
        """
        t0 = time.time()

        enc = self.tokenizer(
            question,
            context,
            truncation                = "only_second",
            max_length                = self.max_length,
            stride                    = self.doc_stride,
            return_overflowing_tokens = True,
            return_offsets_mapping    = True,
            return_tensors            = "pt",
            padding                   = "max_length",
        )

        offset_maps  = enc.pop("offset_mapping").tolist()
        overflow_map = enc.pop("overflow_to_sample_mapping", None)
        enc = {k: v.to(self.device) for k, v in enc.items()}

        # Run all chunks in one batch
        with torch.no_grad():
            outputs = self.model(**enc)

        start_logits_all = outputs.start_logits   # (num_chunks, seq_len)
        end_logits_all   = outputs.end_logits

        # Collect best span across all chunks
        global_best_score  = float("-inf")
        global_null_score  = float("-inf")
        global_best_start  = 0
        global_best_end    = 0
        global_chunk_idx   = 0

        for chunk_idx in range(start_logits_all.size(0)):
            seq_ids = enc["token_type_ids"][chunk_idx].tolist()
            span_score, null_score, bs, be = self._best_span(
                start_logits_all[chunk_idx],
                end_logits_all[chunk_idx],
                offset_maps[chunk_idx],
                seq_ids,
            )
            if null_score > global_null_score:
                global_null_score = null_score
            if span_score > global_best_score:
                global_best_score = span_score
                global_best_start = bs
                global_best_end   = be
                global_chunk_idx  = chunk_idx

        delta        = global_best_score - global_null_score
        is_answerable = delta > self.null_threshold
        confidence   = float(torch.sigmoid(torch.tensor(delta)).item())

        if is_answerable:
            om         = offset_maps[global_chunk_idx]
            start_char = om[global_best_start][0]
            end_char   = om[global_best_end][1]
            answer     = context[start_char:end_char]
        else:
            answer     = ""
            start_char = -1
            end_char   = -1

        return {
            "answer":           answer,
            "is_answerable":    is_answerable,
            "confidence_score": round(confidence, 4),
            "start_char":       start_char,
            "end_char":         end_char,
            "model_version":    self.model_version,
            "execution_time_ms": round((time.time() - t0) * 1000, 2),
        }
