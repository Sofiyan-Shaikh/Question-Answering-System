"""
export_pickle_model.py
----------------------
CLI utility to convert a pickled BertForQuestionAnswering checkpoint (e.g. qa_model.pkl)
into standard Hugging Face format (safetensors, config.json, tokenizer, inference_config.json).

Usage:
    python training/export_pickle_model.py --pkl_path qa_model.pkl --output_dir artifacts/qa-model
"""

import argparse
import json
import os
import sys
from transformers import BertForQuestionAnswering, BertTokenizerFast

# Allow imports from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from training.models.bert_qa import BertQAModel


def export_pickle_to_huggingface(
    pkl_path: str,
    output_dir: str,
    base_model: str = "bert-base-uncased",
    null_threshold: float = -2.35,
    model_version: str = "qa-model-pkl",
):
    print(f"Loading pickled QA model from: {pkl_path}")
    qa = BertQAModel.from_pickle(
        pkl_path=pkl_path,
        base_model=base_model,
        null_threshold=null_threshold,
        model_version=model_version,
    )

    print(f"Exporting model to: {output_dir}")
    qa.save(output_dir)

    print("Verifying saved model with a test inference...")
    verified = BertQAModel.from_pretrained(output_dir)
    res = verified.predict(
        question="Where is the Eiffel Tower located?",
        context="The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France."
    )
    print(f"Verification output: {res}")
    print("Export completed successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export QA model pickle to Hugging Face format")
    parser.add_argument("--pkl_path", type=str, default="qa_model.pkl", help="Path to .pkl model")
    parser.add_argument("--output_dir", type=str, default="artifacts/qa-model", help="Target directory")
    parser.add_argument("--base_model", type=str, default="bert-base-uncased", help="Base BERT model architecture")
    parser.add_argument("--null_threshold", type=float, default=-2.35, help="Null threshold value")
    parser.add_argument("--model_version", type=str, default="qa-model-pkl", help="Model version label")
    args = parser.parse_args()

    export_pickle_to_huggingface(
        pkl_path=args.pkl_path,
        output_dir=args.output_dir,
        base_model=args.base_model,
        null_threshold=args.null_threshold,
        model_version=args.model_version,
    )
