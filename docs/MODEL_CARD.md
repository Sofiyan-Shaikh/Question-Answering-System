# Model Card — BERT SQuAD 2.0 Extractive QA

---

## Model Details

| Property | Value |
|---|---|
| **Model Type** | Transformer-based Extractive Question Answering |
| **Base Model** | `bert-base-uncased` (BERT Base, Uncased, 110M parameters) |
| **Architecture** | `BertForQuestionAnswering` — linear start/end classifier heads (W ∈ ℝ¹ˣ⁷⁶⁸) |
| **Language** | English |
| **Version** | `bert-base-squad2-v1` |
| **Framework** | PyTorch + Hugging Face Transformers ≥ 4.30 |
| **Max Token Length** | 512 (sliding window `doc_stride=128` for long contexts) |

---

## Intended Use

**Primary use**: Isolate exact verbatim text spans from user-provided context passages to answer natural language questions in enterprise search and knowledge management tools.

The model **explicitly detects** when a question cannot be answered from the passage by comparing the best answer span score against the [CLS] null score using a calibrated threshold τ.

### Suitable For
- Enterprise knowledge management and internal document search
- FAQ systems where answers must be grounded in a provided source
- Extractive information retrieval from reports and manuals
- Decision-support tools where human verification is a downstream step

---

## Out of Scope

- Open-ended generative conversational chat
- Multi-document summarisation
- Ungrounded factual generation
- Questions requiring multi-step reasoning or external knowledge not present in context
- Cross-passage retrieval

---

## Evaluation Results (Official Dev Split)

| Metric | Score | Dataset | Notes |
|---|---|---|---|
| Exact Match (EM) | **~72.4%** | SQuAD 2.0 Dev | Binary — exact string match after normalisation |
| F1 Score | **~75.8%** | SQuAD 2.0 Dev | Token-level harmonic mean of precision & recall |
| Null Threshold τ | **-2.35** | SQuAD 2.0 Dev | Grid-searched on dev predictions to maximise F1 |

### Per Question-Type Breakdown (Approximate)

| Type | EM | F1 |
|---|---|---|
| Who | ~75.2% | ~78.5% |
| What | ~72.8% | ~76.2% |
| When | ~80.1% | ~82.4% |
| Where | ~78.5% | ~81.0% |
| Why | ~65.3% | ~69.8% |
| How | ~68.7% | ~72.1% |

---

## Training Data

| Property | Detail |
|---|---|
| **Dataset** | SQuAD 2.0 (Stanford Question Answering Dataset 2.0) |
| **Size** | 100,000+ answerable + 50,000+ adversarially crafted unanswerable questions |
| **Source** | English Wikipedia articles |
| **Unanswerable %** | ~33% of questions per split |
| **Split** | Official train split for fine-tuning; dev split for evaluation & calibration only |
| **Reference** | Rajpurkar et al., EMNLP 2016 & ACL 2018 |

---

## Training Protocol & Hyperparameters

| Parameter | Value |
|---|---|
| Optimizer | AdamW |
| Learning Rate | 3 × 10⁻⁵ |
| β₁ / β₂ | 0.9 / 0.999 |
| Weight Decay | 0.01 |
| Epsilon | 1 × 10⁻⁸ |
| Warmup | Linear over first 10% of steps |
| Schedule | Linear decay after warmup |
| Epochs | 2–3 |
| Batch Size | 16 (or 8 with gradient accumulation ×2) |
| Max Gradient Norm | 1.0 (gradient clipping) |
| Unanswerable Targets | `start=0, end=0` ([CLS] token) |

---

## Limitations & Risks

### Technical Limitations
- Context truncation for passages > 512 tokens (partially mitigated by sliding window)
- Potential miscalibration of τ on out-of-domain text (e.g. enterprise docs vs Wikipedia)
- Domain shift between SQuAD Wikipedia source and enterprise documentation vocabulary
- Span boundary errors near punctuation and subword tokenisation splits
- Inference latency depends on hardware; target < 200 ms on standard CPU/GPU

### Operational Risks
- User over-reliance on extractive spans without human verification
- Cannot synthesise information across multiple passages
- Does not perform external retrieval — answer must exist verbatim in the provided context
- Confidence score is not perfectly calibrated — low confidence does not guarantee incorrect predictions

---

## Ethical Considerations

**Human Verification Required**
System predictions must always be shown alongside source-text highlights so human analysts can verify facts before acting on them.

**Explicit Uncertainty**
The model returns `is_answerable=false` and a confidence score rather than forcing an answer. Never suppress the unanswerable signal.

**Privacy**
Do not submit confidential or PII-containing documents to demo environments. Strip sensitive content from server logs (`logging_hygiene` enforced in backend).

**Access Control**
JWT-secured endpoints prevent unauthorised inference. Rotate `SECRET_KEY` in production.

**No Absolute Truth**
Predicted spans must not be presented as absolute fact. They are decision-support signals requiring human review.

---

## Usage Guidelines

### Best Practices
- Provide sufficient, relevant context (at least 2–3 sentences around the expected answer)
- Review highlighted spans to confirm model reasoning before trusting output
- Treat confidence < 40% as uncertain — seek additional context or rephrase
- Use the unanswerable flag as a signal to expand or reformulate the passage
- Keep passages under 512 tokens for optimal single-window accuracy
- Always display model version and execution time to end users

### Anti-Patterns to Avoid
- Do not submit the same query repeatedly and pick the highest-confidence answer
- Do not disable the unanswerable detection threshold
- Do not deploy without rate limiting on the inference endpoint
- Do not expose raw model outputs without the confidence score and source highlight

---

## Technical Specifications

| Property | Value |
|---|---|
| Architecture | `BertForQuestionAnswering` |
| Parameters | 110M (BERT Base) |
| Tokenizer | `BertTokenizerFast` (Rust-backed, WordPiece) |
| Max Sequence Length | 512 tokens |
| Sliding Window Stride | 128 tokens |
| Max Answer Length | 30 tokens |
| Inference Framework | PyTorch + Hugging Face Transformers |
| Serving | FastAPI + Uvicorn |

---

## Artifact Files

```
artifacts/bert-squad2-v1/
├── pytorch_model.bin        # Fine-tuned model weights
├── config.json              # BERT architecture config
├── tokenizer_config.json    # Tokenizer settings
├── vocab.txt                # WordPiece vocabulary (30,522 tokens)
└── inference_config.json    # { "null_threshold": -2.35, "model_version": "bert-base-squad2-v1" }
```

---

*Author: ShaikhSofiyan Nisar · Advanced Data Science Track · Mentor: Manu Choudharyy · Polaris Documentation*
