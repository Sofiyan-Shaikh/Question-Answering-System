"""
preprocess.py
-------------
Tokenises SQuAD 2.0 examples with BertTokenizerFast and produces
feature dicts ready for BertForQuestionAnswering training/evaluation.

Key steps per example
─────────────────────
1. Encode (question, context) with sliding window (stride=128, max_len=512).
2. Map character-level answer offsets → token-level start/end positions.
3. For unanswerable examples set start=0, end=0 ([CLS] token).
4. Return a list of feature dicts (one per window chunk).

Usage:
    from training.data.preprocess import build_features
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple

from transformers import BertTokenizerFast

# ── Config ─────────────────────────────────────────────────────────────────
TOKENIZER_NAME = "bert-base-uncased"
MAX_LENGTH     = 512
DOC_STRIDE     = 128
DATA_DIR       = os.path.dirname(os.path.abspath(__file__))


def load_raw(split: str) -> List[Dict[str, Any]]:
    """Load raw SQuAD 2.0 JSON produced by fetch_squad.py."""
    path = os.path.join(DATA_DIR, f"squad2_{split}.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _char_to_token_span(
    offset_mapping: List[Tuple[int, int]],
    sequence_ids:   List[Optional[int]],
    char_start:     int,
    char_end:       int,
) -> Tuple[int, int]:
    """
    Convert character offsets (char_start, char_end) to token indices
    within the context portion of the encoded sequence.

    Returns (token_start, token_end).
    If the answer span is outside this window returns (0, 0) → [CLS].
    """
    if char_end <= char_start:
        return 0, 0

    # Find the first and last context token indices
    ctx_token_start = None
    ctx_token_end   = None
    for idx, seq_id in enumerate(sequence_ids):
        if seq_id == 1:                          # 1 = context tokens
            if ctx_token_start is None:
                ctx_token_start = idx
            ctx_token_end = idx

    if ctx_token_start is None:
        return 0, 0

    # Walk context tokens to find char coverage
    token_start = 0
    token_end   = 0
    found = False

    for idx in range(ctx_token_start, ctx_token_end + 1):
        c_start, c_end = offset_mapping[idx]
        if c_start <= char_start < c_end:
            token_start = idx
            found = True
        if found and c_end >= char_end:
            token_end = idx
            return token_start, token_end

    return 0, 0   # answer not in this window → treat as unanswerable


def build_features(
    examples:  List[Dict[str, Any]],
    tokenizer: BertTokenizerFast,
    is_train:  bool = True,
) -> List[Dict[str, Any]]:
    """
    Tokenise a list of SQuAD 2.0 examples into model-ready feature dicts.

    Each feature dict contains:
        input_ids, attention_mask, token_type_ids,
        start_positions, end_positions  (training only)
        example_id, offset_mapping      (evaluation only)
    """
    features: List[Dict[str, Any]] = []

    for example in examples:
        question   = example["question"]
        context    = example["context"]
        answers    = example["answers"]
        example_id = example["id"]

        # Answerable if at least one answer text is non-empty
        is_answerable = (
            len(answers["text"]) > 0 and answers["text"][0] != ""
        )

        encodings = tokenizer(
            question,
            context,
            truncation       = "only_second",
            max_length       = MAX_LENGTH,
            stride           = DOC_STRIDE,
            return_overflowing_tokens = True,
            return_offsets_mapping    = True,
            padding          = "max_length",
        )

        for chunk_idx in range(len(encodings["input_ids"])):
            input_ids       = encodings["input_ids"][chunk_idx]
            attention_mask  = encodings["attention_mask"][chunk_idx]
            token_type_ids  = encodings["token_type_ids"][chunk_idx]
            offset_mapping  = encodings["offset_mapping"][chunk_idx]
            sequence_ids    = encodings.sequence_ids(chunk_idx)

            feature: Dict[str, Any] = {
                "input_ids":      input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids,
                "example_id":     example_id,
                "offset_mapping": offset_mapping,
                "sequence_ids":   sequence_ids,
            }

            if is_train:
                if not is_answerable:
                    # Unanswerable → point to [CLS]
                    feature["start_positions"] = 0
                    feature["end_positions"]   = 0
                else:
                    char_start = answers["answer_start"][0]
                    char_end   = char_start + len(answers["text"][0])
                    tok_s, tok_e = _char_to_token_span(
                        offset_mapping, sequence_ids, char_start, char_end
                    )
                    feature["start_positions"] = tok_s
                    feature["end_positions"]   = tok_e

            features.append(feature)

    return features


# ── CLI usage ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tokenizer = BertTokenizerFast.from_pretrained(TOKENIZER_NAME)

    for split in ["train", "validation"]:
        print(f"Processing {split} …")
        raw = load_raw(split)
        feats = build_features(raw, tokenizer, is_train=(split == "train"))
        print(f"  {len(raw):,} examples → {len(feats):,} features (with sliding window)")

    print("Preprocessing complete.")
