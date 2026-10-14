"""
train.py
--------
Fine-tunes bert-base-uncased on SQuAD 2.0 for extractive QA.

Pipeline
────────
1. Load and preprocess SQuAD 2.0 training split.
2. Build a PyTorch Dataset and DataLoader.
3. Fine-tune BertForQuestionAnswering with AdamW + linear schedule.
4. Save model artifact to artifacts/.

Usage:
    python training/train.py [--epochs 2] [--batch_size 16] [--lr 3e-5]
"""

from __future__ import annotations

import argparse
import os
import sys

import torch
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from transformers import (
    BertForQuestionAnswering,
    BertTokenizerFast,
    get_linear_schedule_with_warmup,
)

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from training.data.preprocess import build_features, load_raw

# ── Config ─────────────────────────────────────────────────────────────────
TOKENIZER_NAME = "bert-base-uncased"
ARTIFACTS_DIR  = os.path.join(os.path.dirname(__file__), "..", "artifacts", "bert-squad2-v1")


# ── Dataset ────────────────────────────────────────────────────────────────

class SQuADDataset(Dataset):
    def __init__(self, features):
        self.features = features

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        f = self.features[idx]
        return {
            "input_ids":        torch.tensor(f["input_ids"],       dtype=torch.long),
            "attention_mask":   torch.tensor(f["attention_mask"],  dtype=torch.long),
            "token_type_ids":   torch.tensor(f["token_type_ids"],  dtype=torch.long),
            "start_positions":  torch.tensor(f["start_positions"], dtype=torch.long),
            "end_positions":    torch.tensor(f["end_positions"],   dtype=torch.long),
        }


# ── Training loop ──────────────────────────────────────────────────────────

def train(
    epochs:     int   = 2,
    batch_size: int   = 16,
    lr:         float = 3e-5,
    warmup_ratio: float = 0.1,
    max_samples: int  = -1,   # -1 = full dataset
) -> None:
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"Device: {device}")

    # ── Load & preprocess data
    print("Loading SQuAD 2.0 training data …")
    tokenizer = BertTokenizerFast.from_pretrained(TOKENIZER_NAME)
    raw = load_raw("train")
    if max_samples > 0:
        raw = raw[:max_samples]
        print(f"  (Using {max_samples} samples for quick run)")

    print("Building training features …")
    features = build_features(raw, tokenizer, is_train=True)
    print(f"  {len(features):,} feature chunks from {len(raw):,} examples")

    dataset    = SQuADDataset(features)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=0)

    # ── Model
    model = BertForQuestionAnswering.from_pretrained(TOKENIZER_NAME)
    model.to(device)

    # ── Optimiser + scheduler
    num_training_steps  = len(dataloader) * epochs
    num_warmup_steps    = int(num_training_steps * warmup_ratio)

    optimizer = AdamW(
        model.parameters(),
        lr=lr,
        betas=(0.9, 0.999),
        weight_decay=0.01,
        eps=1e-8,
    )
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps   = num_warmup_steps,
        num_training_steps = num_training_steps,
    )

    # ── Training
    print(f"\nStarting training: {epochs} epoch(s), batch_size={batch_size}, lr={lr}")
    model.train()
    global_step = 0
    had_nan = False

    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        for step, batch in enumerate(dataloader, 1):
            input_ids       = batch["input_ids"].to(device)
            attention_mask  = batch["attention_mask"].to(device)
            token_type_ids  = batch["token_type_ids"].to(device)
            start_positions = batch["start_positions"].to(device)
            end_positions   = batch["end_positions"].to(device)

            outputs = model(
                input_ids       = input_ids,
                attention_mask  = attention_mask,
                token_type_ids  = token_type_ids,
                start_positions = start_positions,
                end_positions   = end_positions,
            )

            loss = outputs.loss
            if torch.isnan(loss):
                print(f"  WARNING: NaN loss detected at epoch {epoch} step {step}!")
                had_nan = True
                break

            loss.backward()

            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()

            epoch_loss  += loss.item()
            global_step += 1

            if step % 100 == 0:
                avg = epoch_loss / step
                print(f"  Epoch {epoch}/{epochs} | Step {step}/{len(dataloader)} | Loss {avg:.4f} | LR {scheduler.get_last_lr()[0]:.2e}")

        if had_nan:
            print("Aborting training due to NaN loss.")
            break

        avg_epoch_loss = epoch_loss / len(dataloader)
        print(f"\nEpoch {epoch} complete — avg loss: {avg_epoch_loss:.4f}\n")

    if had_nan:
        print("Model not saved because NaN loss was encountered.")
        return

    # ── Save
    print(f"Saving model to {ARTIFACTS_DIR} …")
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    model.save_pretrained(ARTIFACTS_DIR)
    tokenizer.save_pretrained(ARTIFACTS_DIR)
    print("Training complete. Run calibrate_threshold.py next.")


# ── CLI ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune BERT on SQuAD 2.0")
    parser.add_argument("--epochs",      type=int,   default=2,    help="Number of training epochs")
    parser.add_argument("--batch_size",  type=int,   default=16,   help="Training batch size")
    parser.add_argument("--lr",          type=float, default=3e-5, help="Learning rate")
    parser.add_argument("--max_samples", type=int,   default=-1,   help="Limit samples for quick testing (-1 = all)")
    args = parser.parse_args()

    train(
        epochs      = args.epochs,
        batch_size  = args.batch_size,
        lr          = args.lr,
        max_samples = args.max_samples,
    )
