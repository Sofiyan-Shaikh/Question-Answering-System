import csv
import json
import os
import re
import sys
import time
import types
import io
import pickle
import math
import torch
from typing import Dict, List, Optional, Tuple
from transformers import BertTokenizerFast, BertForQuestionAnswering
from ..config import settings


def _load_pickle_weights(pkl_path: str, device: str = "cpu") -> Dict[str, torch.Tensor]:
    """
    Safely load a pickled PyTorch/BERT model and extract its state_dict.
    Provides backward compatibility for older transformers versions and
    CUDA-serialized tensor storages.
    """
    # 1. Provide compatibility shim for older transformers versions
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

    # 2. Patch torch.storage._load_from_bytes to safely deserialize CUDA tensors on CPU
    orig_load_from_bytes = getattr(torch.storage, "_load_from_bytes", None)

    def _safe_load_from_bytes(b):
        return torch.load(io.BytesIO(b), map_location=device, weights_only=False)

    torch.storage._load_from_bytes = _safe_load_from_bytes
    try:
        with open(pkl_path, "rb") as f:
            raw_obj = pickle.load(f)
    finally:
        if orig_load_from_bytes is not None:
            torch.storage._load_from_bytes = orig_load_from_bytes

    if hasattr(raw_obj, "state_dict"):
        return raw_obj.state_dict()
    elif isinstance(raw_obj, dict):
        return raw_obj.get("state_dict", raw_obj)
    else:
        raise ValueError(f"Unsupported object type in pickle: {type(raw_obj)}")


def _detect_multi_answer_intent(question: str) -> int:
    """Detect if the question intends multiple answers, e.g. 'two', 'three', 'list', 'founders'."""
    q_lower = question.lower().strip()
    if re.search(r"\b(two|both|2)\b", q_lower):
        return 2
    if re.search(r"\b(three|3)\b", q_lower):
        return 3
    if re.search(r"\b(four|4)\b", q_lower):
        return 4
    if re.search(r"\b(five|5)\b", q_lower):
        return 5
    if re.search(r"\b(list|name all|name the|who were the|who are the|what are the|which are the)\b", q_lower):
        return 3
    return 1


def _maybe_linearize_table(context: str) -> Tuple[str, bool]:
    """
    Detect if context is a CSV or Markdown/pipe-separated table.
    If detected, return a linearized representation for improved BERT comprehension,
    otherwise return original context unchanged.
    """
    lines = [line.strip() for line in context.strip().splitlines() if line.strip()]
    if len(lines) < 2:
        return context, False

    # Check for Markdown/pipe table
    pipe_lines = [l for l in lines if l.startswith("|") or "|" in l]
    if len(pipe_lines) >= 2 and len(pipe_lines) >= len(lines) * 0.7:
        parsed_rows = []
        for pl in pipe_lines:
            if set(pl.replace("|", "").replace("-", "").replace(":", "").strip()) == set():
                continue
            cells = [c.strip() for c in pl.split("|") if c.strip()]
            if cells:
                parsed_rows.append(cells)
        if len(parsed_rows) >= 2:
            headers = parsed_rows[0]
            linearized_parts = []
            for row in parsed_rows[1:]:
                row_items = [f"{h}: {val}" for h, val in zip(headers, row)]
                linearized_parts.append(", ".join(row_items) + ".")
            return " ".join(linearized_parts), True

    # Check for CSV table
    if all("," in l for l in lines[:3]) and len(lines) >= 2:
        try:
            reader = list(csv.reader(io.StringIO(context)))
            if len(reader) >= 2 and all(len(r) == len(reader[0]) and len(r) > 1 for r in reader):
                headers = [h.strip() for h in reader[0]]
                linearized_parts = []
                for row in reader[1:]:
                    row_items = [f"{h}: {val.strip()}" for h, val in zip(headers, row)]
                    linearized_parts.append(", ".join(row_items) + ".")
                return " ".join(linearized_parts), True
        except Exception:
            pass

    return context, False


ELLIPTICAL_PATTERNS = r"^(in what|in which|at what|on what|what year|when|where|who|whom|by whom|why|how|which)\b"


def _decompose_single_question_clause(question: str) -> List[str]:
    """
    Decompose single compound coordinated questions (e.g. 'Who founded Amazon and in what year?')
    into atomic sub-questions. Returns list of 2 or more sub-questions if compound, or [question] if single.
    """
    q_clean = question.strip().rstrip("?").strip()
    split_match = re.search(r",?\s+(?:and|as well as)\s+", q_clean, flags=re.IGNORECASE)
    if not split_match:
        return [question]

    idx_start, idx_end = split_match.span()
    part1 = q_clean[:idx_start].strip()
    part2 = q_clean[idx_end:].strip()

    if not part1 or not part2:
        return [question]

    # Part 2 MUST be an interrogative clause or elliptical WH-phrase
    is_part2_interrogative = bool(
        re.match(ELLIPTICAL_PATTERNS, part2, flags=re.IGNORECASE) or
        re.match(r"^(was|is|did|were|are|can|could|should|would)\b", part2, flags=re.IGNORECASE)
    )
    if not is_part2_interrogative:
        return [question]

    wh_match = re.match(r"^(who|where|when|what|why|how|which|in what|in which|at what|on what|by whom)\b", part1, flags=re.IGNORECASE)
    sub_q1 = part1 if part1.endswith("?") else part1 + "?"

    # If part2 has multiple words after WH
    part2_wh_match = re.match(ELLIPTICAL_PATTERNS, part2, flags=re.IGNORECASE)
    if part2_wh_match:
        words_after_wh = part2[part2_wh_match.end():].strip().split()
        if len(words_after_wh) >= 2:
            sub_q2 = part2[0].upper() + part2[1:]
            sub_q2 = sub_q2 if sub_q2.endswith("?") else sub_q2 + "?"
            return [sub_q1, sub_q2]

    if wh_match:
        core = part1[wh_match.end():].strip()
        if re.match(r"^(was|is|did|were|are|has|have|had)\b", core, flags=re.IGNORECASE):
            sub_q2 = f"{part2.capitalize()} {core}?"
            return [sub_q1, sub_q2]
        
        words = core.split()
        if len(words) >= 2:
            verb = words[0]
            obj = " ".join(words[1:])
            if verb.endswith("ed") or verb in ("built", "wrote", "won", "made", "sold", "bought", "discovered"):
                sub_q2 = f"{part2.capitalize()} was {obj} {verb}?"
                return [sub_q1, sub_q2]
        
        sub_q2 = f"{part2.capitalize()} {core}?"
        return [sub_q1, sub_q2]

    sub_q2 = part2[0].upper() + part2[1:]
    sub_q2 = sub_q2 if sub_q2.endswith("?") else sub_q2 + "?"
    return [sub_q1, sub_q2]


def _decompose_compound_question(question: str) -> List[str]:
    """
    Decompose complex questions (multi-sentence or compound coordinated)
    into atomic sub-questions.
    Handles:
    - Multi-sentence questions: "Who founded Amazon and in what year? What was its original product focus?"
    - Single coordinated questions: "Who founded Amazon and in what year?"
    """
    q_str = question.strip().rstrip(",").strip()
    
    # Split by '?' while preserving valid sub-question sentences
    raw_sentences = [s.strip() for s in q_str.split("?") if s.strip()]
    
    if len(raw_sentences) > 1:
        decomposed = []
        for s in raw_sentences:
            s_q = s if s.endswith("?") else s + "?"
            decomposed.extend(_decompose_single_question_clause(s_q))
        return decomposed

    return _decompose_single_question_clause(question)


class QAPredictor:
    """BERT-based Question Answering Predictor"""
    
    def __init__(self):
        """Initialize the predictor with model and tokenizer"""
        self.model = None
        self.tokenizer = None
        self.device = settings.DEVICE
        self.null_threshold = settings.NULL_THRESHOLD
        self.model_version = settings.MODEL_VERSION
        self.model_loaded = False
        
    def load_model(self):
        """Load the fine-tuned BERT model and tokenizer"""
        try:
            model_target = settings.MODEL_NAME
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

            # Resolve model path if relative
            resolved_path = model_target
            if not os.path.exists(resolved_path):
                candidate = os.path.join(project_root, model_target)
                if os.path.exists(candidate):
                    resolved_path = candidate
                elif os.path.exists(os.path.join(project_root, "qa_model.pkl")):
                    resolved_path = os.path.join(project_root, "qa_model.pkl")

            # Determine whether target is a pickle file or directory
            is_pickle = False
            pkl_file = None
            if os.path.isfile(resolved_path) and resolved_path.endswith(".pkl"):
                is_pickle = True
                pkl_file = resolved_path
            elif os.path.isdir(resolved_path):
                candidate_pkl = os.path.join(resolved_path, "qa_model.pkl")
                if os.path.exists(candidate_pkl):
                    is_pickle = True
                    pkl_file = candidate_pkl

            if is_pickle:
                print(f"Loading QA model from pickle file: {pkl_file}")
                state_dict = _load_pickle_weights(pkl_file, device=self.device)
                local_dir = os.path.join(project_root, "artifacts", "qa-model")
                if os.path.isdir(local_dir):
                    self.tokenizer = BertTokenizerFast.from_pretrained(local_dir)
                    self.model = BertForQuestionAnswering.from_pretrained(local_dir)
                else:
                    self.tokenizer = BertTokenizerFast.from_pretrained(settings.BASE_MODEL_NAME)
                    self.model = BertForQuestionAnswering.from_pretrained(settings.BASE_MODEL_NAME)
                self.model.load_state_dict(state_dict)
                self.model_version = settings.MODEL_VERSION or "qa-model-pkl"

                # Check for sibling or artifact inference_config.json
                config_candidates = [
                    os.path.join(os.path.dirname(pkl_file), "inference_config.json"),
                    os.path.join(project_root, "artifacts", "qa-model", "inference_config.json"),
                    os.path.join(project_root, "artifacts", "bert-squad2-v1", "inference_config.json"),
                ]
                for cfg in config_candidates:
                    if os.path.exists(cfg):
                        try:
                            with open(cfg, "r", encoding="utf-8") as f:
                                inf_cfg = json.load(f)
                                self.null_threshold = inf_cfg.get("null_threshold", self.null_threshold)
                                if "model_version" in inf_cfg:
                                    self.model_version = inf_cfg["model_version"]
                            break
                        except Exception:
                            pass
            else:
                model_dir = resolved_path
                if not os.path.isdir(model_dir):
                    model_dir = settings.BASE_MODEL_NAME

                config_path = os.path.join(model_dir, "inference_config.json")
                if os.path.exists(config_path):
                    with open(config_path, "r", encoding="utf-8") as f:
                        inference_config = json.load(f)
                    self.null_threshold = inference_config.get(
                        "null_threshold", self.null_threshold
                    )
                    self.model_version = inference_config.get(
                        "model_version", settings.MODEL_VERSION
                    )
                else:
                    self.model_version = settings.MODEL_VERSION

                self.tokenizer = BertTokenizerFast.from_pretrained(model_dir)
                self.model = BertForQuestionAnswering.from_pretrained(model_dir)

            self.model.to(self.device)
            self.model.eval()
            self.model_loaded = True
            print(f"Model loaded successfully (version: {self.model_version}) on {self.device}")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise
    
    def predict(self, context: str, question: str, top_k: int = 1) -> Dict:
        """
        Predict answer(s) for a given context and question.
        Supports compound questions via automated question decomposition.
        
        Args:
            context: Context passage text
            question: Question to answer
            top_k: Maximum number of distinct non-overlapping answers to extract
            
        Returns:
            Dictionary containing answer, answers list, confidence, offsets, and metadata
        """
        if not self.model_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        
        start_time = time.time()

        # 1. Automated compound question decomposition (e.g. 'Who founded Amazon and in what year?')
        sub_questions = _decompose_compound_question(question)
        if len(sub_questions) > 1:
            combined_spans = []
            for sub_q in sub_questions:
                sub_res = self._predict_single_query(context, sub_q, top_k=1)
                if sub_res.get("is_answerable"):
                    for span in sub_res.get("answers", []):
                        if not any(s["answer"].lower() == span["answer"].lower() for s in combined_spans):
                            span_item = dict(span)
                            span_item["sub_question"] = sub_q
                            combined_spans.append(span_item)
            
            exec_time = (time.time() - start_time) * 1000
            if combined_spans:
                combined_answer = ", ".join(s["answer"] for s in combined_spans)
                avg_confidence = round(sum(s["confidence_score"] for s in combined_spans) / len(combined_spans), 4)
                return {
                    "answer": combined_answer,
                    "answers": combined_spans,
                    "is_answerable": True,
                    "confidence_score": avg_confidence,
                    "start_char": combined_spans[0]["start_char"],
                    "end_char": combined_spans[0]["end_char"],
                    "model_version": self.model_version,
                    "execution_time_ms": round(exec_time, 2)
                }
            else:
                return {
                    "answer": "",
                    "answers": [],
                    "is_answerable": False,
                    "confidence_score": 0.0,
                    "start_char": -1,
                    "end_char": -1,
                    "model_version": self.model_version,
                    "execution_time_ms": round(exec_time, 2)
                }

        # Otherwise execute single atomic query
        return self._predict_single_query(context, question, top_k=top_k)

    def _predict_single_query(self, context: str, question: str, top_k: int = 1) -> Dict:
        """Execute single-query extractive inference pipeline."""
        start_time = time.time()

        # 1. Determine effective top_k (explicit parameter or auto-detected multi-answer intent)
        detected_k = _detect_multi_answer_intent(question)
        effective_top_k = max(top_k, detected_k) if top_k <= 1 else top_k

        # 2. Check for tabular data (CSV / Markdown) and linearize if detected
        working_context, was_tabular = _maybe_linearize_table(context)
        
        # 3. Tokenize inputs with sliding window and offset mapping
        inputs = self.tokenizer(
            question,
            working_context,
            truncation="only_second",
            max_length=settings.MAX_LENGTH,
            stride=settings.DOC_STRIDE,
            return_overflowing_tokens=True,
            return_offsets_mapping=True,
            padding="max_length",
            return_tensors="pt"
        )
        
        offset_mapping = inputs.pop("offset_mapping").tolist()
        inputs.pop("overflow_to_sample_mapping", None)
        num_chunks = inputs["input_ids"].size(0)
        seq_ids_list = [inputs.sequence_ids(i) for i in range(num_chunks)]
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # 4. Get model predictions across all chunks
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        start_logits = outputs.start_logits
        end_logits = outputs.end_logits
        
        # 5. Extract top-k distinct non-overlapping answers
        answer_spans = self._extract_top_k_spans(
            start_logits=start_logits,
            end_logits=end_logits,
            offset_mapping=offset_mapping,
            seq_ids=seq_ids_list,
            context=working_context,
            top_k=effective_top_k
        )

        # 6. Map character offsets back to original context if tabular linearization was used
        if was_tabular:
            for span in answer_spans:
                ans_text = span["answer"]
                orig_pos = context.find(ans_text)
                if orig_pos != -1:
                    span["start_char"] = orig_pos
                    span["end_char"] = orig_pos + len(ans_text)

        is_answerable = len(answer_spans) > 0
        if is_answerable:
            top_span = answer_spans[0]
            if effective_top_k > 1 and len(answer_spans) > 1:
                combined_answer = ", ".join(s["answer"] for s in answer_spans)
            else:
                combined_answer = top_span["answer"]
            confidence = top_span["confidence_score"]
            start_char = top_span["start_char"]
            end_char = top_span["end_char"]
        else:
            combined_answer = ""
            confidence = 0.0
            start_char = -1
            end_char = -1
        
        execution_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return {
            "answer": combined_answer,
            "answers": answer_spans,
            "is_answerable": is_answerable,
            "confidence_score": confidence,
            "start_char": start_char,
            "end_char": end_char,
            "model_version": self.model_version,
            "execution_time_ms": round(execution_time, 2)
        }
    
    def _extract_top_k_spans(
        self,
        start_logits: torch.Tensor,
        end_logits: torch.Tensor,
        offset_mapping,
        seq_ids: list = None,
        context: str = "",
        top_k: int = 1,
    ) -> List[Dict]:
        """
        Extract top-k non-overlapping answer spans exceeding the null threshold tau.
        """
        if isinstance(offset_mapping, torch.Tensor):
            offset_mapping = offset_mapping.tolist()

        if start_logits.dim() == 1:
            start_logits = start_logits.unsqueeze(0)
            end_logits = end_logits.unsqueeze(0)
            offset_mapping = [offset_mapping]
            seq_ids = [seq_ids] if seq_ids is not None else None
        elif seq_ids is not None and len(seq_ids) > 0 and not isinstance(seq_ids[0], list):
            seq_ids = [seq_ids]

        num_chunks = start_logits.size(0)
        global_null_score = float('-inf')

        for chunk_idx in range(num_chunks):
            null_score = (start_logits[chunk_idx][0] + end_logits[chunk_idx][0]).item()
            if null_score > global_null_score:
                global_null_score = null_score

        candidates = []
        for chunk_idx in range(num_chunks):
            sl = start_logits[chunk_idx]
            el = end_logits[chunk_idx]
            chunk_seq_ids = seq_ids[chunk_idx] if seq_ids is not None else None
            chunk_offsets = offset_mapping[chunk_idx] if chunk_idx < len(offset_mapping) else []
            seq_len = len(sl)

            for i in range(1, seq_len):
                if chunk_seq_ids is not None and chunk_seq_ids[i] != 1:
                    continue
                if i >= len(chunk_offsets):
                    continue
                om_i = chunk_offsets[i]
                if om_i[0] == 0 and om_i[1] == 0:
                    continue

                for j in range(i, min(i + 30, seq_len)):
                    if chunk_seq_ids is not None and chunk_seq_ids[j] != 1:
                        break
                    if j >= len(chunk_offsets):
                        break
                    om_j = chunk_offsets[j]
                    if om_j[0] == 0 and om_j[1] == 0:
                        continue

                    span_score = (sl[i] + el[j]).item()
                    delta = span_score - global_null_score
                    if delta > self.null_threshold:
                        sc = om_i[0]
                        ec = om_j[1]
                        ans_text = context[sc:ec].strip()
                        if ans_text:
                            candidates.append({
                                "score": span_score,
                                "delta": delta,
                                "start_char": sc,
                                "end_char": ec,
                                "text": ans_text,
                            })

        if not candidates:
            return []

        # Sort candidates descending by delta / score
        candidates.sort(key=lambda x: x["delta"], reverse=True)

        selected = []
        for cand in candidates:
            c_text_clean = cand["text"].strip().lower()
            overlaps = False
            for sel in selected:
                s_text_clean = sel["answer"].strip().lower()
                # Overlap in character boundaries
                if not (cand["end_char"] <= sel["start_char"] or cand["start_char"] >= sel["end_char"]):
                    overlaps = True
                    break
                # Identical text
                if c_text_clean == s_text_clean:
                    overlaps = True
                    break
                # Substring overlap in close vicinity
                if (c_text_clean in s_text_clean or s_text_clean in c_text_clean) and abs(cand["start_char"] - sel["start_char"]) < 40:
                    overlaps = True
                    break

            if not overlaps:
                conf = torch.sigmoid(torch.tensor(cand["delta"])).item()
                if math.isnan(conf) or math.isinf(conf):
                    conf = 0.0
                else:
                    conf = max(0.0, min(1.0, float(conf)))

                selected.append({
                    "answer": cand["text"],
                    "confidence_score": round(conf, 4),
                    "start_char": cand["start_char"],
                    "end_char": cand["end_char"],
                })

                if len(selected) >= top_k:
                    break

        return selected

    def _extract_answer(
        self, 
        start_logits: torch.Tensor, 
        end_logits: torch.Tensor,
        offset_mapping,
        seq_ids: list = None,
    ) -> Tuple[Optional[int], int, int, bool, float]:
        """
        Extract the best answer span and determine answerability across sliding window chunks.
        
        Returns:
            Tuple of (best_chunk_idx, start_idx, end_idx, is_answerable, confidence)
        """
        # Convert tensor offset_mapping if passed
        if isinstance(offset_mapping, torch.Tensor):
            offset_mapping = offset_mapping.tolist()

        # Support single-chunk 1D or 2D inputs
        if start_logits.dim() == 1:
            start_logits = start_logits.unsqueeze(0)
            end_logits = end_logits.unsqueeze(0)
            offset_mapping = [offset_mapping]
            seq_ids = [seq_ids] if seq_ids is not None else None
        elif seq_ids is not None and len(seq_ids) > 0 and not isinstance(seq_ids[0], list):
            seq_ids = [seq_ids]

        num_chunks = start_logits.size(0)
        global_null_score = float('-inf')
        best_score = float('-inf')
        best_chunk_idx: Optional[int] = None
        best_start = 0
        best_end = 0

        for chunk_idx in range(num_chunks):
            sl = start_logits[chunk_idx]
            el = end_logits[chunk_idx]
            null_score = (sl[0] + el[0]).item()
            if null_score > global_null_score:
                global_null_score = null_score

            chunk_seq_ids = seq_ids[chunk_idx] if seq_ids is not None else None
            chunk_offsets = offset_mapping[chunk_idx] if chunk_idx < len(offset_mapping) else []
            seq_len = len(sl)

            for i in range(1, seq_len):
                if chunk_seq_ids is not None and chunk_seq_ids[i] != 1:
                    continue
                if i < len(chunk_offsets):
                    om_i = chunk_offsets[i]
                    if om_i[0] == 0 and om_i[1] == 0:
                        continue
                else:
                    continue

                for j in range(i, min(i + 30, seq_len)):  # Max answer length of 30 tokens
                    if chunk_seq_ids is not None and chunk_seq_ids[j] != 1:
                        break
                    if j < len(chunk_offsets):
                        om_j = chunk_offsets[j]
                        if om_j[0] == 0 and om_j[1] == 0:
                            continue
                    else:
                        break

                    score = (sl[i] + el[j]).item()
                    if score > best_score:
                        best_score = score
                        best_chunk_idx = chunk_idx
                        best_start = i
                        best_end = j

        if best_chunk_idx is None or best_score == float('-inf'):
            return None, 0, 0, False, 0.0

        # Calculate score difference
        score_diff = best_score - global_null_score

        # Determine answerability
        is_answerable = score_diff > self.null_threshold

        # Calculate confidence (using sigmoid on score difference)
        confidence = torch.sigmoid(torch.tensor(score_diff)).item()
        if math.isnan(confidence) or math.isinf(confidence):
            confidence = 0.0
        else:
            confidence = max(0.0, min(1.0, float(confidence)))

        return best_chunk_idx, best_start, best_end, is_answerable, round(confidence, 4)


# Global predictor instance
predictor = QAPredictor()
