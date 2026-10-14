"""
baseline.py
-----------
Lightweight TF-IDF + exact-word-overlap baseline QA pipeline.
Establishes a performance floor before fine-tuning BERT.

Pipeline
────────
1. Retrieve the sentence from the context most similar to the question
   using TF-IDF cosine similarity.
2. Find the longest contiguous exact-word overlap between the question
   and the retrieved sentence as the predicted answer span.
3. Evaluate with exact-match (EM) and F1 on the SQuAD 2.0 dev set.

Usage:
    python training/models/baseline.py
"""

from __future__ import annotations

import re
import string
from collections import Counter
from typing import List, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── Text normalisation (mirrors official SQuAD eval) ──────────────────────

def normalize_answer(s: str) -> str:
    """Lower, strip punctuation, articles, and extra whitespace."""
    def remove_articles(text: str) -> str:
        return re.sub(r"\b(a|an|the)\b", " ", text)

    def white_space_fix(text: str) -> str:
        return " ".join(text.split())

    def remove_punc(text: str) -> str:
        return "".join(ch for ch in text if ch not in string.punctuation)

    return white_space_fix(remove_articles(remove_punc(s.lower())))


def get_tokens(s: str) -> List[str]:
    return normalize_answer(s).split() if s else []


# ── Metrics ────────────────────────────────────────────────────────────────

def compute_exact(prediction: str, ground_truth: str) -> int:
    return int(normalize_answer(prediction) == normalize_answer(ground_truth))


def compute_f1(prediction: str, ground_truth: str) -> float:
    pred_tokens  = get_tokens(prediction)
    truth_tokens = get_tokens(ground_truth)
    common       = Counter(pred_tokens) & Counter(truth_tokens)
    num_same     = sum(common.values())
    if num_same == 0:
        return 0.0
    precision = num_same / len(pred_tokens)
    recall    = num_same / len(truth_tokens)
    return 2 * precision * recall / (precision + recall)


def best_metric(prediction: str, ground_truths: List[str], metric_fn) -> float:
    return max(metric_fn(prediction, gt) for gt in ground_truths) if ground_truths else 0.0


# ── TF-IDF sentence retriever ──────────────────────────────────────────────

def split_sentences(context: str) -> List[str]:
    """Naive sentence splitter on '.', '?', '!'."""
    sentences = re.split(r"(?<=[.?!])\s+", context.strip())
    return [s.strip() for s in sentences if s.strip()]


def retrieve_best_sentence(question: str, context: str) -> str:
    """Return the context sentence most similar to the question via TF-IDF."""
    sentences = split_sentences(context)
    if not sentences:
        return context

    corpus  = sentences + [question]
    tfidf   = TfidfVectorizer().fit_transform(corpus)
    q_vec   = tfidf[-1]
    s_vecs  = tfidf[:-1]
    scores  = cosine_similarity(q_vec, s_vecs).flatten()
    best_idx = int(scores.argmax())
    return sentences[best_idx]


# ── Answer extraction: longest exact-word-overlap span ────────────────────

def extract_answer_span(question: str, sentence: str) -> str:
    """
    Find the longest contiguous subsequence of words in `sentence`
    that also appears in `question`.
    """
    q_words  = normalize_answer(question).split()
    s_words  = sentence.split()
    s_norm   = [normalize_answer(w) for w in s_words]

    q_set    = set(q_words)
    best_span: Tuple[int, int] = (0, 0)
    best_len  = 0

    i = 0
    while i < len(s_norm):
        if s_norm[i] in q_set:
            j = i
            while j < len(s_norm) and s_norm[j] in q_set:
                j += 1
            if j - i > best_len:
                best_len  = j - i
                best_span = (i, j)
            i = j
        else:
            i += 1

    if best_len == 0:
        # Fall back: return first 10 words of the sentence
        return " ".join(s_words[:10])

    return " ".join(s_words[best_span[0]:best_span[1]])


# ── Full baseline predict ──────────────────────────────────────────────────

def baseline_predict(question: str, context: str) -> str:
    """End-to-end baseline prediction."""
    sentence = retrieve_best_sentence(question, context)
    return extract_answer_span(question, sentence)


# ── Evaluation loop ────────────────────────────────────────────────────────

def evaluate_baseline(examples, max_samples: int = 500) -> dict:
    """
    Evaluate baseline on a list of SQuAD 2.0 example dicts.
    Caps at max_samples for speed.
    """
    total_em  = 0.0
    total_f1  = 0.0
    n_answerable   = 0
    n_unanswerable = 0
    count = 0

    for ex in examples[:max_samples]:
        answers = ex["answers"]
        context  = ex["context"]
        question = ex["question"]

        ground_truths = answers["text"] if answers["text"] else []
        is_answerable = len(ground_truths) > 0 and ground_truths[0] != ""

        prediction = baseline_predict(question, context)

        if is_answerable:
            em  = best_metric(prediction, ground_truths, compute_exact)
            f1  = best_metric(prediction, ground_truths, compute_f1)
            total_em += em
            total_f1 += f1
            n_answerable += 1
        else:
            # Unanswerable: baseline always predicts something → always wrong
            n_unanswerable += 1

        count += 1

    denom = max(n_answerable, 1)
    return {
        "samples_evaluated": count,
        "answerable":        n_answerable,
        "unanswerable":      n_unanswerable,
        "exact_match":       round(total_em / denom * 100, 2),
        "f1_score":          round(total_f1 / denom * 100, 2),
    }


# ── CLI ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json, os, sys

    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "squad2_validation.json"
    )

    if not os.path.exists(data_path):
        print(
            "Validation data not found. Run:\n"
            "    python training/data/fetch_squad.py\n"
            "first."
        )
        sys.exit(1)

    with open(data_path) as f:
        examples = json.load(f)

    print("Running TF-IDF baseline on first 500 dev examples …")
    results = evaluate_baseline(examples, max_samples=500)

    print("\n── Baseline Results ─────────────────")
    for k, v in results.items():
        print(f"  {k:<25} {v}")
    print("────────────────────────────────────")
    print("\nNote: Baseline does NOT handle unanswerable questions.")
    print("BERT fine-tuning with null-threshold calibration will significantly improve these numbers.")
