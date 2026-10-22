// Type definitions for the QA System

export interface AnswerSpan {
  answer: string;
  confidence_score: number;
  start_char: number;
  end_char: number;
  sub_question?: string;
}

export interface QARequest {
  context: string;
  question: string;
  top_k?: number;
}

export interface QAResponse {
  answer: string;
  answers?: AnswerSpan[];
  is_answerable: boolean;
  confidence_score: number;
  start_char: number;
  end_char: number;
  model_version: string;
  execution_time_ms: number;
}

export interface PDFPageData {
  page_number: number;
  text: string;
  char_count: number;
}

export interface PDFExtractResponse {
  filename: string;
  total_pages: number;
  text: string;
  pages: PDFPageData[];
}

export interface PDFQAResponse {
  answer: string;
  answers?: AnswerSpan[];
  is_answerable: boolean;
  confidence_score: number;
  page_number?: number;
  total_pages: number;
  matched_passage?: string;
  filename: string;
  model_version: string;
  execution_time_ms: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_version: string;
  device: string;
}

export interface MetricsResponse {
  dataset: string;
  exact_match: number;
  f1_score: number;
  null_threshold: number;
  total_samples: number;
}

export interface User {
  username: string;
  token: string;
}
