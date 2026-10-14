"""
fetch_squad.py
--------------
Downloads SQuAD 2.0 train and validation splits via Hugging Face `datasets`
and saves them as JSON files under training/data/.

Usage:
    python training/data/fetch_squad.py
"""

import json
import os
from datasets import load_dataset

SAVE_DIR = os.path.dirname(os.path.abspath(__file__))


def fetch_and_save():
    print("Downloading SQuAD 2.0 …")
    dataset = load_dataset("squad_v2")

    for split in ["train", "validation"]:
        records = []
        for item in dataset[split]:
            records.append({
                "id":       item["id"],
                "title":    item["title"],
                "context":  item["context"],
                "question": item["question"],
                # answers dict has 'text' list and 'answer_start' list
                "answers":  item["answers"],
            })

        out_path = os.path.join(SAVE_DIR, f"squad2_{split}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

        print(f"  Saved {len(records):,} {split} examples → {out_path}")

    print("Done.")


if __name__ == "__main__":
    fetch_and_save()
