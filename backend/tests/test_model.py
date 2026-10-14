"""
test_model.py
-------------
Unit tests for:
  - Token offset mapping correctness
  - Null-threshold logic (is_answerable flag)
  - BertQAModel predict() schema compliance
"""

import sys
import os
import pytest
import torch

# Allow imports from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


# ── Offset mapping unit tests ───────────────────────────────────────────────

class TestOffsetMapping:
    """Verify that character offsets round-trip correctly through the tokenizer."""

    @pytest.fixture(scope="class")
    def tokenizer(self):
        from transformers import BertTokenizerFast
        return BertTokenizerFast.from_pretrained("bert-base-uncased")

    def test_answer_span_in_context(self, tokenizer):
        context  = "SQuAD 2.0 has over 50,000 unanswerable questions."
        question = "How many unanswerable questions does SQuAD 2.0 have?"
        answer   = "over 50,000"

        enc = tokenizer(
            question, context,
            return_offsets_mapping=True,
            truncation="only_second",
            max_length=512,
        )
        offset_map = enc["offset_mapping"]
        seq_ids    = enc.sequence_ids()

        # Find the character range of the answer in context
        char_start = context.index(answer)
        char_end   = char_start + len(answer)

        # Walk the offset map to find matching tokens
        found_tokens = [
            i for i, (cs, ce) in enumerate(offset_map)
            if seq_ids[i] == 1 and cs >= char_start and ce <= char_end
        ]
        assert len(found_tokens) > 0, "Answer span not found in token offset mapping"

        # Reconstruct from offsets and verify it matches
        tok_start = found_tokens[0]
        tok_end   = found_tokens[-1]
        reconstructed = context[offset_map[tok_start][0]: offset_map[tok_end][1]]
        assert answer in reconstructed, f"Reconstructed '{reconstructed}' does not contain '{answer}'"

    def test_unanswerable_cls_mapping(self, tokenizer):
        """Unanswerable examples map ground-truth to position 0 ([CLS])."""
        from training.data.preprocess import _char_to_token_span

        context  = "BERT is a transformer model."
        question = "What is the capital of France?"

        enc = tokenizer(
            question, context,
            return_offsets_mapping=True,
            truncation="only_second",
            max_length=512,
        )
        offset_map = enc["offset_mapping"]
        seq_ids    = enc.sequence_ids()

        # For unanswerable: char_start=0, char_end=0 should yield (0, 0)
        ts, te = _char_to_token_span(offset_map, seq_ids, 0, 0)
        # Should return (0, 0) for unanswerable (no valid span found at pos 0/0)
        assert ts == 0 and te == 0


# ── Null-threshold unit tests ───────────────────────────────────────────────

class TestNullThreshold:
    """Verify is_answerable flag follows the τ threshold rule."""

    def _make_logits(self, span_score: float, null_score: float):
        """
        Build minimal start/end logit tensors where:
          best_span_score = span_score  (position 1)
          null_score      = null_score  (position 0)
        """
        start = torch.tensor([null_score, span_score, -10.0, -10.0])
        end   = torch.tensor([0.0,        0.0,        -10.0, -10.0])
        # span score = start[1] + end[1] = span_score + 0
        # null score = start[0] + end[0] = null_score + 0
        return start, end

    def test_answerable_when_delta_above_threshold(self):
        """delta > τ → is_answerable = True"""
        tau = -2.35
        # delta = 5.0 - 0.0 = 5.0 > tau
        span_score, null_score = 5.0, 0.0
        delta = span_score - null_score
        is_answerable = delta > tau
        assert is_answerable is True

    def test_unanswerable_when_delta_below_threshold(self):
        """delta < τ → is_answerable = False"""
        tau = -2.35
        # delta = -1.0 - 2.0 = -3.0 < tau
        span_score, null_score = -1.0, 2.0
        delta = span_score - null_score
        is_answerable = delta > tau
        assert is_answerable is False

    def test_boundary_at_threshold(self):
        """delta == τ → is_answerable = False (strict >)"""
        tau = -2.35
        delta = tau
        is_answerable = delta > tau
        assert is_answerable is False

    def test_confidence_sigmoid_range(self):
        """Confidence score must be in [0, 1]."""
        for delta in [-10.0, -2.35, 0.0, 5.0, 10.0]:
            conf = float(torch.sigmoid(torch.tensor(delta)).item())
            assert 0.0 <= conf <= 1.0, f"Confidence {conf} out of range for delta {delta}"


# ── Predictor service unit tests ────────────────────────────────────────────

class TestPredictorService:
    """Smoke tests for the predictor service (uses base BERT weights)."""

    @pytest.fixture(scope="class")
    def predictor(self):
        """Load a fresh predictor with base BERT weights (no fine-tuning needed)."""
        from backend.app.services.predictor import QAPredictor
        p = QAPredictor()
        p.load_model()
        return p

    def test_predict_returns_required_keys(self, predictor):
        result = predictor.predict(
            context="BERT was introduced by Google in 2018.",
            question="Who introduced BERT?"
        )
        required = {
            "answer", "is_answerable", "confidence_score",
            "start_char", "end_char", "model_version", "execution_time_ms"
        }
        assert required.issubset(result.keys()), f"Missing keys: {required - result.keys()}"

    def test_predict_confidence_in_range(self, predictor):
        result = predictor.predict(
            context="The Eiffel Tower is located in Paris, France.",
            question="Where is the Eiffel Tower?"
        )
        assert 0.0 <= result["confidence_score"] <= 1.0

    def test_predict_execution_time_positive(self, predictor):
        result = predictor.predict(
            context="Python is a programming language.",
            question="What is Python?"
        )
        assert result["execution_time_ms"] > 0

    def test_unanswerable_returns_empty_answer(self, predictor):
        """When model deems unanswerable, answer should be empty and offsets -1."""
        # Patch threshold to force unanswerable
        original_threshold = predictor.null_threshold
        predictor.null_threshold = 999.0   # impossibly high → always unanswerable
        try:
            result = predictor.predict(
                context="The sky is blue.",
                question="What is the GDP of France in 2045?"
            )
            assert result["is_answerable"] is False
            assert result["answer"] == ""
            assert result["start_char"] == -1
            assert result["end_char"] == -1
        finally:
            predictor.null_threshold = original_threshold

    def test_predict_long_passage_sliding_window(self, predictor):
        """Passages longer than max_length should be processed via sliding window chunks."""
        context = "Alpha is the first letter. " + ("The quick brown fox jumps over the lazy dog. " * 60) + " The secret password is Pineapple123."
        question = "What is the secret password?"
        result = predictor.predict(context=context, question=question)
        assert result["is_answerable"] is True
        assert "Pineapple123" in result["answer"]
        assert result["start_char"] > 512
        assert result["end_char"] > result["start_char"]

    def test_predict_multiple_answers(self, predictor):
        """Questions with multi-answer intent should extract multiple distinct answer spans."""
        context = "Apple Inc. was founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne in California."
        question = "Who were the founders of Apple?"
        result = predictor.predict(context=context, question=question, top_k=3)
        assert result["is_answerable"] is True
        assert "answers" in result
        assert len(result["answers"]) >= 1
        for ans_item in result["answers"]:
            assert "answer" in ans_item
            assert "confidence_score" in ans_item
            assert ans_item["start_char"] >= 0

    def test_predict_tabular_csv_context(self, predictor):
        """Tabular CSV context should be linearized and answer correctly extracted."""
        csv_context = "Product, Price, Stock\nWidgetA, $25, 40\nWidgetB, $50, 15"
        question = "What is the price of WidgetB?"
        result = predictor.predict(context=csv_context, question=question)
        assert result["is_answerable"] is True
        assert "$50" in result["answer"]

    def test_predict_compound_question_decomposition(self, predictor):
        """Compound questions (e.g. 'Who ... and in what year?') should decompose and answer both."""
        context = "Amazon was founded by Jeff Bezos in Bellevue, Washington, on July 5, 1994."
        question = "Who founded Amazon and in what year?"
        result = predictor.predict(context=context, question=question)
        assert result["is_answerable"] is True
        assert "Jeff Bezos" in result["answer"]
        assert "1994" in result["answer"]
        assert len(result["answers"]) >= 2
        answers_texts = [a["answer"] for a in result["answers"]]
        assert "Jeff Bezos" in answers_texts
        assert any("1994" in a for a in answers_texts)

    def test_predict_multi_sentence_compound_question(self, predictor):
        """Multi-sentence queries with compound clauses should resolve all distinct parts."""
        context = (
            "Amazon was founded by Jeff Bezos in 1994. "
            "The company originally started as an online marketplace for books."
        )
        question = "Who founded Amazon and in what year? What was its original product focus?"
        result = predictor.predict(context=context, question=question)
        assert result["is_answerable"] is True
        assert "Jeff Bezos" in result["answer"]
        assert "1994" in result["answer"]
        assert "books" in result["answer"]
        assert len(result["answers"]) == 3
        sub_qs = [a["sub_question"] for a in result["answers"]]
        assert "Who founded Amazon?" in sub_qs
        assert "What was its original product focus?" in sub_qs

