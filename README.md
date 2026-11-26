---
title: Question Answering System
emoji: 🔍
colorFrom: green
colorTo: blue
sdk: docker
app_port: 8000
pinned: false
---

# Question Answering System — SQuAD 2.0

A full-stack **extractive QA** application built with BERT, FastAPI, and React.

| | |
|---|---|
| **Model** | `bert-base-uncased` fine-tuned on SQuAD 2.0 |
| **EM / F1** | ~72.4% / ~75.8% (official dev split) |
| **Backend** | FastAPI + JWT auth + Pydantic v2 |
| **Frontend** | React 18 + TypeScript + Tailwind CSS + Recharts |
| **Training** | PyTorch + Hugging Face Transformers ≥ 4.30 |

---

## Table of Contents
1. [Architecture](#architecture)
2. [Quick Start](#quick-start)
3. [Training Pipeline](#training-pipeline)
4. [API Reference](#api-reference)
5. [Running Tests](#running-tests)
6. [Docker Deployment](#docker-deployment)
7. [Project Structure](#project-structure)

---

## Architecture

```
React Frontend (Tailwind)
        │  HTTPS / Axios
        ▼
FastAPI Backend  ──► BertTokenizerFast  ──► BertForQuestionAnswering
  JWT Auth              Offset Mapping        Start / End Logits
  Pydantic v2                                 Null Threshold (τ)
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) CUDA GPU for training

### 1 — Clone & install Python deps

```bash
git clone https://github.com/Sofiyan-Shaikh/qa-system-squad2.git
cd qa-system-squad2

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2 — Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set SECRET_KEY to a strong random value
```

### 3 — Start the backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

API docs available at **http://localhost:8000/docs**

### 4 — Start the frontend

```bash
cd frontend
npm install
npm start
```

UI available at **http://localhost:3000**

**Demo login:** username `analyst` / password `password123`

---

## Training Pipeline

Run each step in order:

```bash
# 1. Download SQuAD 2.0
python training/data/fetch_squad.py

# 2. (Optional) Run TF-IDF baseline to establish performance floor
python training/models/baseline.py

# 3. Fine-tune BERT  (requires GPU for full run; add --max_samples 1000 for quick test)
python training/train.py --epochs 2 --batch_size 16 --lr 3e-5

# 4. Calibrate null threshold τ on dev set
python training/calibrate_threshold.py

# 5. Official EM / F1 evaluation
python training/evaluate.py
```

Results are written to `artifacts/eval_results.json`.

---

## API Reference

Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/health` | ❌ | Model load status, device info |
| POST | `/auth/login` | ❌ | Returns JWT bearer token |
| POST | `/qa/predict` | ✅ | Extract answer span from context |
| GET  | `/analytics/metrics` | ✅ | EM / F1 / threshold from dev eval |

### POST `/qa/predict`

**Request**
```json
{
  "context":  "SQuAD 2.0 has over 50,000 unanswerable questions.",
  "question": "How many unanswerable questions are in SQuAD 2.0?"
}
```

**Response (answerable)**
```json
{
  "answer":            "over 50,000",
  "is_answerable":     true,
  "confidence_score":  0.964,
  "start_char":        14,
  "end_char":          25,
  "model_version":     "bert-base-squad2-v1",
  "execution_time_ms": 38.5
}
```

**Response (unanswerable)**
```json
{
  "answer":            "",
  "is_answerable":     false,
  "confidence_score":  0.121,
  "start_char":        -1,
  "end_char":          -1,
  "model_version":     "bert-base-squad2-v1",
  "execution_time_ms": 32.1
}
```

### `POST /api/v1/qa/predict-pdf`

Upload a multi-page PDF document and ask questions against it. The system indexes pages with BM25, retrieves the most relevant passage candidate, and extracts the answer with source page attribution.

**Request (`multipart/form-data`)**
- `file`: PDF file (`.pdf`)
- `question`: `"Who is the principal system architect?"`
- `top_k`: `1` (optional, default 1)

**Response**
```json
{
  "answer": "Alexander Pierce",
  "answers": [
    {
      "answer": "Alexander Pierce",
      "confidence_score": 1.0,
      "start_char": 58,
      "end_char": 74,
      "sub_question": null
    }
  ],
  "is_answerable": true,
  "confidence_score": 1.0,
  "page_number": 2,
  "total_pages": 3,
  "matched_passage": "Engineering Department: The principal system architect is Alexander Pierce.",
  "filename": "q3_report.pdf",
  "model_version": "qa-model-pkl",
  "execution_time_ms": 324.28
}
```

---

## Running Tests

```bash
# Run all 43 tests
pytest backend/tests/ -v

# Individual suites
pytest backend/tests/test_model.py -v   # offset mapping, threshold logic, predictor
pytest backend/tests/test_api.py   -v   # standard REST endpoints & authentication
pytest backend/tests/test_pdf_qa.py -v  # PDF extraction, BM25 retrieval, and PDF QA
```

---

## Docker Deployment

```bash
# Build and start both services
docker-compose up --build

# Or build only the production image
docker build -t qa-system .
docker run -p 8000:8000 --env-file backend/.env qa-system
```

---

## Project Structure

```
qa-system-squad2/
├── training/
│   ├── data/
│   │   ├── fetch_squad.py          # Download SQuAD 2.0
│   │   └── preprocess.py           # Tokenisation + offset mapping
│   ├── models/
│   │   ├── baseline.py             # TF-IDF + word-overlap baseline
│   │   └── bert_qa.py              # BertQAModel wrapper
│   ├── train.py                    # Fine-tuning loop (AdamW + linear schedule)
│   ├── calibrate_threshold.py      # Grid-search optimal τ
│   └── evaluate.py                 # Official EM / F1 evaluation
│
├── backend/
│   └── app/
│       ├── main.py                 # FastAPI app + lifespan
│       ├── config.py               # Settings (pydantic-settings)
│       ├── schemas.py              # Pydantic request/response models
│       ├── auth.py                 # JWT helpers
│       ├── routes/
│       │   ├── health.py
│       │   ├── auth_routes.py
│       │   ├── qa_routes.py
│       │   └── analytics.py
│       └── services/
│           └── predictor.py        # Tokeniser + BERT inference service
│   └── tests/
│       ├── test_model.py           # Unit tests: offsets, threshold, predictor
│       └── test_api.py             # Integration tests: all endpoints
│
├── frontend/
│   └── src/
│       ├── App.tsx                 # Router + AuthProvider
│       ├── context/AuthContext.tsx
│       ├── services/api.ts         # Axios API client
│       ├── types/index.ts
│       ├── components/
│       │   ├── Navbar.tsx
│       │   └── ProtectedRoute.tsx
│       └── pages/
│           ├── Home.tsx
│           ├── Login.tsx
│           ├── Workspace.tsx       # Context search + highlighting
│           ├── Analytics.tsx       # Charts dashboard
│           └── ModelCard.tsx       # Full model card
│
├── docs/
│   ├── BRD.md                      # Business Requirements
│   ├── PRD.md                      # Product Requirements
│   ├── TRD.md                      # Technical Requirements
│   └── MODEL_CARD.md               # Model Card
│
├── artifacts/                      # Saved model weights (gitignored)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## Security Notes

- Rotate `SECRET_KEY` in production (`python -c "import secrets; print(secrets.token_hex(32))"`)
- Do not commit `backend/.env` — it is gitignored
- Rate-limit inference endpoints in production (e.g. nginx, API gateway)
- Strip sensitive context from logs (`logging_hygiene` is enforced in the backend)

---

## Responsible Use

This is an **extractive decision-support prototype**. It highlights verbatim text spans — it does not generate free-form text. Always present predictions alongside source highlights so human analysts can verify facts before acting.

---

*Author: ShaikhSofiyan Nisar · Advanced Data Science Track · Mentor: Manu Choudharyy*
