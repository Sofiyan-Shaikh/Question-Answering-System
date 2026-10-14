# Technical Requirements Document (TRD)
## Question Answering System — SQuAD 2.0

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend  (Tailwind CSS, Recharts, Axios)            │
│  Workspace UI · Highlighting · Analytics Dashboard          │
└─────────────────────┬───────────────────────────────────────┘
                      │  HTTPS / REST (Axios)
┌─────────────────────▼───────────────────────────────────────┐
│  FastAPI Service  (Uvicorn)                                 │
│  JWT Auth · Input Validation (Pydantic) · CORS              │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐  ┌───────────▼──────────────────────┐
│ BertTokenizerFast   │  │  BertForQuestionAnswering         │
│ Offset Mapping      │  │  Start / End Logits               │
│ Sliding Window      │  │  Null Threshold Manager (τ)       │
└─────────────────────┘  └───────────────────────────────────┘
```

---

## 2. Technical Requirements

| ID | Requirement | Detail |
|---|---|---|
| **TR-001** | Reproducible SQuAD 2.0 download | `datasets.load_dataset("squad_v2")` via Hugging Face; saved as JSON |
| **TR-002** | Fast tokenisation with offset mapping | `BertTokenizerFast` with `return_offsets_mapping=True` |
| **TR-003** | Sliding window for long contexts | `truncation="only_second"`, `max_length=512`, `stride=128` |
| **TR-004** | Ground-truth index mapping | Unanswerable → `s=0, e=0` ([CLS] token); answerable → char-to-token span |
| **TR-005** | Baseline pipeline | TF-IDF sentence similarity + exact-word overlap matching |
| **TR-006** | BERT fine-tuning | `BertForQuestionAnswering` from `bert-base-uncased` |
| **TR-007** | AdamW optimiser + schedule | `lr=3e-5`, `β₁=0.9`, `β₂=0.999`, `weight_decay=0.01`, linear warmup (10%) |
| **TR-008** | Null-threshold search | Grid-search τ ∈ [-10, 10] step 0.1 on dev predictions to maximise combined F1 |
| **TR-009** | Official SQuAD 2.0 evaluation | EM + F1 per example and by question type (Who/What/When/Where/Why/How) |
| **TR-010** | Model artifact versioning | `pytorch_model.bin`, `config.json`, `vocab.txt`, `inference_config.json` (stores τ) |
| **TR-011** | FastAPI inference route | `POST /api/v1/qa/predict` — returns answer, confidence, offsets, version, latency |
| **TR-012** | React + Axios frontend | Asynchronous API calls; JWT token in `Authorization: Bearer` header |
| **TR-013** | JWT authentication | `python-jose` + `passlib[bcrypt]`; bearer token on all protected routes |
| **TR-014** | Automated test suite | `pytest` covering token mapping, threshold logic, API routes, UI components |

---

## 3. Predictor Execution Logic

```
1. Receive context (str) and question (str)
2. Encode via BertTokenizerFast(question, context,
       truncation="only_second", max_length=512, stride=128,
       return_offsets_mapping=True)
3. Execute: outputs = model(**inputs)
4. Obtain start_logits and end_logits
5. Compute best non-null score: max(S_i + E_j) where 1 ≤ i ≤ j < N
6. Compute null score: S_0 + E_0  (logits at [CLS])
7. Calculate Δ = Score_best_span − Score_null
8. If Δ < τ  →  is_answerable = false, return empty span
9. Else → decode token span (i*, j*) to char indices via offset_mapping
          slice raw context string → return answer
```

---

## 4. Model Architecture

```
Input: [CLS] Q_1 ... Q_m [SEP] C_1 ... C_n [SEP]

BERT Encoder (12 layers, 768 hidden, 12 attention heads)
        │
        ▼
Linear Start Head: W_s ∈ ℝ^(1×768)  →  start_logits ∈ ℝ^N
Linear End Head:   W_e ∈ ℝ^(1×768)  →  end_logits   ∈ ℝ^N

Loss = CrossEntropy(P_start, y_start) + CrossEntropy(P_end, y_end)
Unanswerable: y_start = 0, y_end = 0
```

---

## 5. Model Artifact Bundle

```
artifacts/bert-squad2-v1/
├── pytorch_model.bin        # Fine-tuned weights (or model.safetensors)
├── config.json              # Architecture configuration
├── tokenizer_config.json    # Tokenizer settings
├── vocab.txt                # WordPiece vocabulary
└── inference_config.json    # { "null_threshold": -2.35, "model_version": "..." }
```

---

## 6. API Contract

### POST `/api/v1/qa/predict`

**Request schema**
```json
{
  "context":  "string  (1–10,000 chars)",
  "question": "string  (1–500 chars)"
}
```

**Response schema**
```json
{
  "answer":            "string",
  "is_answerable":     "boolean",
  "confidence_score":  "float [0,1]",
  "start_char":        "int  (-1 if unanswerable)",
  "end_char":          "int  (-1 if unanswerable)",
  "model_version":     "string",
  "execution_time_ms": "float"
}
```

**Error responses**

| Code | Meaning |
|------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 422 | Unprocessable Entity (validation failure) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (model not loaded) |

---

## 7. Split Protocol

- **Train split**: fine-tuning and hyperparameter selection only.
- **Dev split**: threshold calibration (τ) and final evaluation.
- **Rule**: Do **not** tune hyperparameters on the final dev-set evaluation pass.

---

## 8. Infrastructure Constraints

| Context | Requirement |
|---|---|
| Training | CUDA GPU (NVIDIA T4/V100/A10G) — BERT transformer architecture |
| Inference | CPU viable for single-request serving; latency target < 200 ms |
| Containerisation | Docker multi-stage build (Node frontend → Python backend) |
| Reverse proxy | Nginx (SSL termination, load balancing, static asset serving) |

---

## 9. Security Controls

| Control | Implementation |
|---|---|
| Input validation | Pydantic schemas enforce max text lengths (DoS prevention) |
| Authentication | JWT Bearer tokens (`python-jose`); 30-min expiry |
| CORS | Restricted to whitelisted origins |
| Secret management | JWT secret in `.env`; excluded from version control |
| Logging hygiene | Raw context/question text stripped from structured logs |
| Rate limiting | Configure at Nginx / API gateway layer in production |

---

## 10. Observability

| Signal | Detail |
|---|---|
| Structured logs | `request_id`, `timestamp`, `endpoint`, `status_code`, `latency_ms`, `model_version` |
| Operational metrics | Throughput, p50/p95 latency, error rate (5xx), unanswerable prediction % |
| Health checks | `GET /api/v1/health` — GPU memory, model load status, device |

---

*Document owner: ShaikhSofiyan Nisar · Advanced Data Science Track · Polaris*
