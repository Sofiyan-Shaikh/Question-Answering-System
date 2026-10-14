"""
evaluate.py
-----------
Runs official SQuAD 2.0 evaluation (EM + F1) on the full dev split
using the fine-tuned model and calibrated null threshold τ.

Outputs a JSON report to artifacts/eval_results.json.

Usage:
    python training/evaluate.py [--max_samples -1]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from typing import Dict, List

import torch
from transformers import BertForQuestionAnswering, BertTokenizerFast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from training.data.preprocess import load_raw
from training.models.baseline import (
    compute_exact,
    compute_f1,
    best_metric,
)

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts", "bert-squad2-v1")
MAX_LENGTH    = 512
DOC_STRIDE    = 128
MAX_ANS_LEN   = 30


def predict_example(model, tokenizer, question, context, null_threshold, device):
    """Run model on one example; return predicted answer text ('' = unanswerable)."""
    enc = tokenizer(
        question, context,
        truncation="only_second",
        max_length=MAX_LENGTH,
        stride=DOC_STRIDE,
        return_overflowing_tokens=True,
        return_offsets_mapping=True,
        return_tensors="pt",
        padding="max_length",
    )
    offset_maps = enc.pop("offset_mapping").tolist()
    enc.pop("overflow_to_sample_mapping", None)
    enc = {k: v.to(device) for k, v in enc.items()}

    with torch.no_grad():
        out = model(**enc)

    best_span_score = float("-inf")
    global_null     = float("-inf")
    best_start = best_end = 0
    best_om: list = []

    for ci in range(out.start_logits.size(0)):
        sl   = out.start_logits[ci]
        el   = out.end_logits[ci]
        ns   = (sl[0] + el[0]).item()
        seqs = enc["token_type_ids"][ci].tolist()
        om   = offset_maps[ci]

        if ns > global_null:
            global_null = ns

        for i in range(1, len(sl)):
            if seqs[i] != 1 or om[i] == [0, 0]:
                continue
            for j in range(i, min(i + MAX_ANS_LEN, len(el))):
                if seqs[j] != 1 or om[j] == [0, 0]:
                    break
                score = (sl[i] + el[j]).item()
                if score > best_span_score:
                    best_span_score = score
                    best_start, best_end, best_om = i, j, om

    delta = best_span_score - global_null

    if delta > null_threshold and best_om:
        sc  = best_om[best_start][0]
        ec  = best_om[best_end][1]
        return context[sc:ec]
    return ""


def evaluate(max_samples: int = -1, model_path: str = None) -> Dict:
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"Device: {device}")

    # Determine default model path
    if not model_path:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        pkl_candidate = os.path.join(project_root, "qa_model.pkl")
        qa_model_dir = os.path.join(project_root, "artifacts", "qa-model")
        if os.path.exists(pkl_candidate):
            model_path = pkl_candidate
        elif os.path.exists(qa_model_dir):
            model_path = qa_model_dir
        else:
            model_path = ARTIFACTS_DIR

    if not os.path.exists(model_path):
        print(f"No model found at {model_path}. Provide a valid model path.")
        sys.exit(1)

    print(f"Loading model from {model_path} …")
    null_threshold = -2.35
    if os.path.isfile(model_path) and model_path.endswith(".pkl"):
        from training.models.bert_qa import BertQAModel
        qa_helper = BertQAModel.from_pickle(model_path, device=device)
        model = qa_helper.model
        tokenizer = qa_helper.tokenizer
    else:
        model = BertForQuestionAnswering.from_pretrained(model_path).to(device).eval()
        tokenizer = BertTokenizerFast.from_pretrained(model_path)
        config_path = os.path.join(model_path, "inference_config.json")
        if os.path.exists(config_path):
            with open(config_path) as f:
                null_threshold = json.load(f).get("null_threshold", null_threshold)
    print(f"Using null threshold τ = {null_threshold}")

    # Load dev data
    print("Loading dev data …")
    examples = load_raw("validation")
    if max_samples > 0:
        examples = examples[:max_samples]
    n = len(examples)
    print(f"Evaluating on {n:,} examples …")

    # Evaluation
    total_em  = defaultdict(float)
    total_f1  = defaultdict(float)
    counts    = defaultdict(int)

    for idx, ex in enumerate(examples):
        if idx % 200 == 0:
            print(f"  {idx}/{n} …")

        answers       = ex["answers"]
        ground_truths = [t for t in answers["text"] if t]
        is_answerable = len(ground_truths) > 0

        pred = predict_example(model, tokenizer, ex["question"], ex["context"], null_threshold, device)

        # Determine question type
        q_lower = ex["question"].lower().strip()
        if q_lower.startswith("who"):       qtype = "Who"
        elif q_lower.startswith("what"):    qtype = "What"
        elif q_lower.startswith("when"):    qtype = "When"
        elif q_lower.startswith("where"):   qtype = "Where"
        elif q_lower.startswith("why"):     qtype = "Why"
        elif q_lower.startswith("how"):     qtype = "How"
        else:                               qtype = "Other"

        if is_answerable:
            em = best_metric(pred, ground_truths, compute_exact)
            f1 = best_metric(pred, ground_truths, compute_f1)
        else:
            # Unanswerable: correct iff prediction is empty
            em = 1.0 if pred == "" else 0.0
            f1 = 1.0 if pred == "" else 0.0

        for key in ["overall", qtype]:
            total_em[key]  += em
            total_f1[key]  += f1
            counts[key]    += 1

    # Aggregate
    results: Dict = {
        "dataset":        "SQuAD 2.0 Official Dev Split",
        "total_samples":  n,
        "null_threshold": null_threshold,
        "exact_match":    round(total_em["overall"] / max(counts["overall"], 1) * 100, 2),
        "f1_score":       round(total_f1["overall"] / max(counts["overall"], 1) * 100, 2),
        "by_question_type": {},
    }

    for qtype in ["Who", "What", "When", "Where", "Why", "How", "Other"]:
        if counts[qtype] > 0:
            results["by_question_type"][qtype] = {
                "count":        counts[qtype],
                "exact_match":  round(total_em[qtype] / counts[qtype] * 100, 2),
                "f1_score":     round(total_f1[qtype] / counts[qtype] * 100, 2),
            }

    # Save
    out_path = os.path.join(os.path.dirname(__file__), "..", "artifacts", "eval_results.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)

    print("\n── Evaluation Results ──────────────────────────────")
    print(f"  Exact Match : {results['exact_match']}%")
    print(f"  F1 Score    : {results['f1_score']}%")
    print(f"  Samples     : {results['total_samples']:,}")
    print(f"  Saved to    : {out_path}")
    print("────────────────────────────────────────────────────")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", type=str, default=None,
                        help="Path to model file (.pkl) or artifact directory")
    parser.add_argument("--max_samples", type=int, default=-1,
                        help="Number of dev examples (-1 = full dev set)")
    args = parser.parse_args()
    evaluate(max_samples=args.max_samples, model_path=args.model_path)
