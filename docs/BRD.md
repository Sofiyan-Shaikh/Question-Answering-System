# Business Requirements Document (BRD)
## Question Answering System — SQuAD 2.0

---

## 1. Problem Statement

Enterprise knowledge teams waste significant time manually reading long documents to locate factual answers. Traditional keyword search lacks precision, while generative AI risks hallucinating unverified facts. Knowledge management systems need an **extractive, deterministic model** that isolates exact character spans directly in source texts and explicitly flags questions when context is insufficient.

---

## 2. Personas

| Persona | Goal | Pain Point |
|---|---|---|
| **Enterprise Knowledge Analyst** | Quickly locate precise facts in internal reports and manuals | Manual document skimming and slow retrieval |
| **NLP / Search Lead** | Verify model precision and unanswerable query detection on benchmarks | Lack of metric transparency (EM/F1) and confidence tracking |
| **ML Engineer** | Integrate extractive search into internal tools via a documented REST API | No standardised, authenticated inference endpoint |
| **System Administrator** | Prevent unauthorised access to inference endpoints | No authentication layer on model APIs |

---

## 3. Business Objectives

1. Train a BERT-based model on SQuAD 2.0 using character-to-token offset mapping.
2. Implement explicit unanswerable query detection using a calibrated null threshold (τ).
3. Evaluate model performance using official Exact Match (EM) and F1-score metrics on the SQuAD 2.0 dev split.
4. Expose real-time inference through a validated FastAPI service.
5. Provide an interactive React user interface with live text highlighting and error handling.
6. Build a dashboard displaying performance breakdowns across question types (Who, What, When, Where, Why, How).
7. Publish a comprehensive Model Card documenting intended use, operational limits, and metrics.

---

## 4. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| **BR-001** | Ingest SQuAD 2.0 | Must | Train/dev JSON schema ingested and parsed correctly |
| **BR-002** | Token & Offset Validation | Must | Character offsets accurately mapped to token spans via fast tokenizers |
| **BR-003** | Establish Baseline | Must | TF-IDF / heuristic QA pipeline benchmarked |
| **BR-004** | Train BERT QA Model | Must | Fine-tune `bert-base-uncased` producing versioned PyTorch artifacts |
| **BR-005** | Unanswerable Detection | Must | Questions lacking context answers flagged via calibrated threshold τ |
| **BR-006** | Final Dev Evaluation | Must | Calculate official EM and F1 scores on SQuAD 2.0 dev split |
| **BR-007** | FastAPI Endpoint | Must | `/api/v1/qa/predict` responds with answer, confidence, and character offsets |
| **BR-008** | React Search UI | Must | Interactive workspace with live text span highlighting |
| **BR-009** | Analytics Dashboard | Must | Charts showing EM, F1, loss distributions, and question-type breakdowns |
| **BR-010** | Basic Authentication | Must | JWT-based session/user authentication on protected routes |
| **BR-011** | Model Card | Must | Complete usage, metrics, limitations, and ethical considerations published |
| **BR-012** | Experiment Tracking | Should | Hyperparameters, loss curves, and evaluation runs systematically logged |

---

## 5. Non-Functional Requirements (NFRs)

| Category | Requirement |
|---|---|
| **Performance** | Model latency < 200 ms on standard CPU/GPU inference |
| **Reliability** | Pre-load model on startup; eliminate cold-start overhead |
| **Security** | HTTPS, CORS restrictions, JWT auth, input sanitisation, rate limiting |
| **Accessibility** | WCAG-compliant colour contrast, keyboard focus rings, screen-reader labels |
| **Responsible Use** | Do not expose confidential enterprise data in demo environments |
| **Scalability** | Stateless FastAPI backend allows horizontal container scaling |

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Context truncation on passages > 512 tokens | Sliding window with `doc_stride=128` |
| Miscalibration of unanswerable threshold τ | Grid-search τ on dev set; do not tune on final eval pass |
| Domain shift between Wikipedia and enterprise docs | Document limitation in Model Card; plan domain adaptation |
| User over-reliance on extractive spans | Always show highlighted source; display confidence score |

---

## 7. Constraints

- Model fine-tuning requires CUDA GPU (NVIDIA T4/V100/A10G); CPU viable for inference only.
- Must use the official SQuAD 2.0 train/dev split — no leakage between splits.
- All outputs must be grounded in the provided context — no external retrieval.

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| Exact Match (EM) | ≥ 70% on SQuAD 2.0 dev split |
| F1 Score | ≥ 73% on SQuAD 2.0 dev split |
| API Latency (p95) | < 200 ms |
| Unanswerable Precision | ≥ 70% |

---

*Document owner: ShaikhSofiyan Nisar · Advanced Data Science Track · Polaris*
