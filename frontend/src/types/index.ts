// Type definitions for the QA System

export interface AnswerSpan {
  answer: string;
  descriptive_answer?: string;
  confidence_score: number;
  start_char: number;
  end_char: number;
  sub_question?: string;
}

export interface QARequest {
  context: string;
  question: string;
  top_k?: number;
  session_id?: string;
}

export interface QAResponse {
  answer: string;
  descriptive_answer?: string;
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
  descriptive_answer?: string;
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

export interface SendOTPRequest {
  email: string;
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  email: string;
  expires_in_seconds: number;
  cooldown_seconds: number;
  dev_otp?: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  email?: string;
  username?: string;
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
  email?: string;
  token: string;
}

export interface DocumentItem {
  id: string;
  user_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  page_count: number;
  sha256?: string;
  created_at: string;
  task_count?: number;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TaskHistoryItem {
  id: string;
  user_id: string;
  session_id?: string;
  task_type: 'text_qa' | 'pdf_qa' | 'pdf_extract' | 'document_upload' | string;
  document_id?: string;
  document_name?: string;
  question?: string;
  context_preview?: string;
  answer?: string;
  descriptive_answer?: string;
  is_answerable: boolean;
  confidence_score: number;
  page_number?: number;
  citations?: any;
  execution_time_ms: number;
  created_at: string;
}

export interface TaskHistoryListResponse {
  history: TaskHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface HistoryStats {
  total_tasks: number;
  text_qa_count: number;
  pdf_qa_count: number;
  pdf_extract_count: number;
  avg_confidence: number;
  total_documents: number;
  latest_task_at?: string;
}

export interface ChatSessionItem {
  session_id: string;
  title: string;
  task_type: 'text_qa' | 'pdf_qa' | 'pdf_extract' | string;
  document_id?: string;
  document_name?: string;
  context_preview?: string;
  messages_count: number;
  latest_question?: string;
  latest_answer?: string;
  latest_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionListResponse {
  sessions: ChatSessionItem[];
  total: number;
}


