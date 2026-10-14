# Product Requirements Document (PRD)
## Question Answering System — SQuAD 2.0

---

## 1. Product Goal

Provide enterprise knowledge teams with a **fast, deterministic, extractive QA system** that isolates exact text spans and identifies unanswerable queries while preserving analyst verification.

---

## 2. Product Principles

> *Extract first, verify second; explicit uncertainty over guessing; preserve original text formatting; version every model artifact; do not present predicted spans as absolute truth.*

---

## 3. Features

| # | Feature | Description |
|---|---|---|
| F-01 | Passage & question submission | Dual-input form: multiline context textarea + single-line question input |
| F-02 | Dynamic span highlighting | `<mark>` wraps exact character offsets (`start_char`, `end_char`) returned by model |
| F-03 | Unanswerable badge | Amber/red visual badge when `is_answerable=false` |
| F-04 | Confidence indicator | Progress bar and percentage score per prediction |
| F-05 | Analytics dashboard | EM/F1 summary cards, bar chart by question type, pie chart, radar chart, confidence distribution |
| F-06 | Model Card view | Full model documentation: details, intended use, limitations, ethics |
| F-07 | Authenticated REST API | JWT-secured FastAPI endpoints with OpenAPI docs at `/docs` |

---

## 4. User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| **US-001** | As an analyst, I want to paste a context paragraph and ask a question so that I can immediately view the highlighted answer span. | Answer highlighted in green; start/end char indices shown |
| **US-002** | As an analyst, I want to be alerted when a question cannot be answered from the provided text so that I do not rely on false assumptions. | Amber "Unanswerable" badge shown; answer field empty |
| **US-003** | As an NLP lead, I want to view EM and F1 metric breakdowns on the official dev split so that I can evaluate model quality before deployment. | Analytics dashboard shows EM%, F1%, sample count, and per-question-type breakdown |
| **US-004** | As an engineer, I want a documented REST API with token validation so that I can integrate extractive search into internal tools. | `/api/v1/qa/predict` returns correct JSON schema; OpenAPI spec at `/docs` |
| **US-005** | As a system administrator, I want basic JWT user auth so that unauthorized users cannot query internal inference endpoints. | Requests without valid bearer token return HTTP 401/403 |

---

## 5. Information Architecture

```
/ (Home)
├── /login
├── /workspace          [protected]  ← Context Search + Answer Highlighting
├── /analytics          [protected]  ← EM/F1 Charts Dashboard
└── /model-card         [protected]  ← Model Card Documentation
```

---

## 6. UX Screen Specifications

### 6.1 Context Search Screen
- **Dual-input workspace**: Context Passage (multiline textarea) + Question (single-line input)
- **Character counter** below context textarea (max 10,000 chars)
- **Action buttons**: Submit (primary), Clear (secondary), Load Example (secondary)
- **Validation**: Required field messages; disabled Submit when inputs are empty
- **Loading state**: Spinner + "Running BERT inference" message

### 6.2 Result & Highlighting Screen
- Render passage with `<mark>` wrapping `context[start_char:end_char]`
- **Green highlight** for valid answer spans
- **Amber/Red badge** for "Unanswerable Query"
- Output metadata: extracted string, start/end indices, confidence score, model version, execution time

### 6.3 Analytics Dashboard Screen
- **Summary cards**: Overall EM%, F1%, Total Validation Count, Null Threshold τ
- **Bar chart**: EM/F1 by question category (Who, What, When, Where, Why, How)
- **Donut pie chart**: Answerable vs Unanswerable distribution (~67% / ~33%)
- **Radar chart**: EM vs F1 per category
- **Bar chart**: Confidence score distribution by bucket
- **Data table**: Full dataset/model metadata

### 6.4 Model Card Screen
- Sections: Model Details, Intended Use, Out of Scope, Evaluation Results, Training Data, Training Protocol, Limitations, Ethical Considerations, Usage Guidelines, Technical Specifications

---

## 7. Accessibility Requirements

- Accessible colour contrast (WCAG AA minimum)
- Keyboard focus rings on all interactive elements
- Screen-reader semantic labels (`aria-label`, `role="alert"`, `aria-required`, `aria-describedby`)
- `role="progressbar"` on confidence bar with `aria-valuenow`

---

## 8. Required UI States

| State | Trigger | Visual |
|---|---|---|
| Empty | Initial load | Illustrated empty state with helper text |
| Loading | Request in-flight | Spinner + "Extracting answer…" |
| Answer found | `is_answerable=true` | Green highlight, answer text, confidence bar |
| Unanswerable detected | `is_answerable=false` | Amber badge, empty answer field, explanation text |
| API error | Non-2xx response | Red alert banner with error detail |
| Unauthorized (401/403) | No / invalid token | Redirect to `/login` |
| Service unavailable (503) | Model not loaded | Friendly error message |

---

## 9. Out of Scope

- Open-ended generative chat
- Multi-document retrieval
- Cross-passage reasoning
- Real-time collaboration features

---

*Document owner: ShaikhSofiyan Nisar · Advanced Data Science Track · Polaris*
