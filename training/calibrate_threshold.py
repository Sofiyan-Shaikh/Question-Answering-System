"""
calibrate_threshold.py
----------------------
Grid-searches the optimal null threshold (τ) on SQuAD 2.0 dev predictions
to maximise the combined F1 score across answerable AND unanswerable subsets.

Procedure
─────────
1. Run the fine-tuned model on every dev example (no threshold applied).
2. Record (best_span_score - null_score) and whether the example is answerable.
3. Grid-search τ over [-10, 10] in steps of 0.1.
4. For each τ compute combined F1 and pick the τ that maximises it.
5. Write τ to artifacts/bert-squad2-v1/inference_config.json.

Usage:
    python training/calibrate_threshold.py [--max_samples 1000]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import List, Tuple

import numpy as np
import torch
from transformers import BertForQuestionAnswering, BertTokenizerFast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from training.data.preprocess import load_raw
from training.models.baseline import compute_f1, normalize_answer

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts", "bert-squad2-v1")
MAX_LENGTH    = 512
DOC_STRIDE    = 128
MAX_ANS_LEN   = 30


def _predict_raw(
    model, tokenizer, question: str, context: str, device: str
) -> Tuple[float, float, int, int, list]:
    """Return (best_span_score, null_score, best_start, best_end, offset_map)."""
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

    best_span_score  = float("-inf")
    global_null      = float("-inf")
    best_start = best_end = 0
    best_offset_map: list = []

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
                    best_start = i
                    best_end   = j
                    best_offset_map = om

    return best_span_score, global_null, best_start, best_end, best_offset_map


def collect_predictions(examples, model, tokenizer, device, max_samples):
    """Collect raw score deltas and reference answers for every dev example."""
    records = []
    n = min(len(examples), max_samples) if max_samples > 0 else len(examples)

    for idx, ex in enumerate(examples[:n]):
        if idx % 100 == 0:
            print(f"  {idx}/{n} …")

        answers       = ex["answers"]
        ground_truths = [t for t in answers["text"] if t]
        is_answerable = len(ground_truths) > 0

        span_score, null_score, bs, be, om = _predict_raw(
            model, tokenizer, ex["question"], ex["context"], device
        )
        delta = span_score - null_score

        # Decode answer text
        if om and bs > 0:
            start_char = om[bs][0]
            end_char   = om[be][1]
            pred_text  = ex["context"][start_char:end_char]
        else:
            pred_text = ""

        records.append({
            "delta":          delta,
            "pred_text":      pred_text,
            "ground_truths":  ground_truths,
            "is_answerable":  is_answerable,
        })

    return records


def search_threshold(records: List[dict]) -> Tuple[float, float]:
    """Grid-search τ to maximise combined F1."""
    thresholds = np.arange(-10.0, 10.0, 0.1)
    best_tau   = 0.0
    best_f1    = 0.0

    for tau in thresholds:
        total_f1 = 0.0
        count    = 0

        for r in records:
            is_pred_answerable = r["delta"] > tau

            if is_pred_answerable:
                pred = r["pred_text"]
            else:
                pred = ""   # Model says unanswerable

            if r["is_answerable"] and r["ground_truths"]:
                f1 = max(compute_f1(pred, gt) for gt in r["ground_truths"])
            else:
                # Unanswerable: correct if pred == ""
                f1 = 1.0 if pred == "" else 0.0

            total_f1 += f1
            count    += 1

        avg_f1 = total_f1 / max(count, 1)
        if avg_f1 > best_f1:
            best_f1  = avg_f1
            best_tau = float(tau)

    return best_tau, best_f1


def main(max_samples: int = 500, model_path: str = None):
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"Device: {device}")

    # Determine model path
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
        print(f"No model found at {model_path}. Run train.py or provide valid model.")
        sys.exit(1)

    print(f"Loading model from {model_path} …")
    if os.path.isfile(model_path) and model_path.endswith(".pkl"):
        from training.models.bert_qa import BertQAModel
        qa_helper = BertQAModel.from_pickle(model_path, device=device)
        model = qa_helper.model
        tokenizer = qa_helper.tokenizer
        save_dir = os.path.join(os.path.dirname(model_path), "artifacts", "qa-model") if not os.path.dirname(model_path).endswith("artifacts") else os.path.dirname(model_path)
    else:
        model = BertForQuestionAnswering.from_pretrained(model_path).to(device).eval()
        tokenizer = BertTokenizerFast.from_pretrained(model_path)
        save_dir = model_path

    # Load dev data
    print("Loading dev data …")
    examples = load_raw("validation")

    # Collect raw predictions
    print(f"Collecting predictions on {min(len(examples), max_samples) if max_samples > 0 else len(examples)} dev examples …")
    records = collect_predictions(examples, model, tokenizer, device, max_samples)

    # Grid search
    print("Grid-searching τ …")
    best_tau, best_f1 = search_threshold(records)
    print(f"\n  Best τ = {best_tau:.2f}  (combined F1 = {best_f1 * 100:.2f}%)")

    # Save to inference_config.json
    os.makedirs(save_dir, exist_ok=True)
    config_path = os.path.join(save_dir, "inference_config.json")
    config = {}
    if os.path.exists(config_path):
        with open(config_path) as f:
            config = json.load(f)

    config["null_threshold"] = best_tau
    config["model_version"]  = config.get("model_version", "qa-model-pkl")

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"  Saved τ={best_tau} to {config_path}")
    print("Calibration complete. Run evaluate.py for final metrics.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", type=str, default=None,
                        help="Path to model file (.pkl) or artifact directory")
    parser.add_argument("--max_samples", type=int, default=500,
                        help="Dev examples to use (-1 = all, slow)")
    args = parser.parse_args()
    main(max_samples=args.max_samples, model_path=args.model_path)
