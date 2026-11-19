import axios, { AxiosInstance } from 'axios';
import {
  QARequest,
  QAResponse,
  LoginRequest,
  AuthToken,
  SendOTPResponse,
  HealthResponse,
  MetricsResponse,
  PDFQAResponse,
  PDFExtractResponse,
  DocumentItem,
  DocumentListResponse,
  TaskHistoryItem,
  TaskHistoryListResponse,
  HistoryStats,
  ChatSessionListResponse,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const API_V1_PREFIX = '/api/v1';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for 401 handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('email');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async checkHealth(): Promise<HealthResponse> {
    const response = await this.api.get(`${API_V1_PREFIX}/health`);
    return response.data;
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthToken> {
    const response = await this.api.post(`${API_V1_PREFIX}/auth/login`, credentials);
    return response.data;
  }

  // Email OTP Authentication
  async sendOtp(email: string): Promise<SendOTPResponse> {
    const response = await this.api.post(`${API_V1_PREFIX}/auth/send-otp`, { email });
    return response.data;
  }

  async verifyOtp(email: string, otp: string): Promise<AuthToken> {
    const response = await this.api.post(`${API_V1_PREFIX}/auth/verify-otp`, { email, otp });
    return response.data;
  }

  // Question Answering
  async predictAnswer(request: QARequest): Promise<QAResponse> {
    const response = await this.api.post(`${API_V1_PREFIX}/qa/predict`, request);
    return response.data;
  }

  // PDF Question Answering
  async predictPdfAnswer(file: File, question: string, topK: number = 1, sessionId?: string): Promise<PDFQAResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', question);
    formData.append('top_k', topK.toString());
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    const response = await this.api.post(`${API_V1_PREFIX}/qa/predict-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // PDF Text Extraction
  async extractPdfText(file: File): Promise<PDFExtractResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post(`${API_V1_PREFIX}/qa/extract-pdf-text`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Analytics
  async getMetrics(): Promise<MetricsResponse> {
    const response = await this.api.get(`${API_V1_PREFIX}/analytics/metrics`);
    return response.data;
  }

  // ── User Task History ──────────────────────────────────────────────────────
  async getHistory(params?: {
    task_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskHistoryListResponse> {
    const response = await this.api.get(`${API_V1_PREFIX}/history`, { params });
    return response.data;
  }

  async getHistoryStats(): Promise<HistoryStats> {
    const response = await this.api.get(`${API_V1_PREFIX}/history/stats`);
    return response.data;
  }

  async deleteHistoryItem(historyId: string): Promise<any> {
    const response = await this.api.delete(`${API_V1_PREFIX}/history/${historyId}`);
    return response.data;
  }

  async clearHistory(): Promise<any> {
    const response = await this.api.delete(`${API_V1_PREFIX}/history`);
    return response.data;
  }

  // ── Passage & Document Grouped Sessions ────────────────────────────────────
  async getChatSessions(params?: { limit?: number; offset?: number }): Promise<ChatSessionListResponse> {
    const response = await this.api.get(`${API_V1_PREFIX}/history/sessions`, { params });
    return response.data;
  }

  async getSessionMessages(sessionId: string): Promise<TaskHistoryItem[]> {
    const response = await this.api.get(`${API_V1_PREFIX}/history/sessions/${sessionId}`);
    return response.data;
  }

  async deleteChatSession(sessionId: string): Promise<any> {
    const response = await this.api.delete(`${API_V1_PREFIX}/history/sessions/${sessionId}`);
    return response.data;
  }

  // ── Client Document Vault ──────────────────────────────────────────────────
  async getDocuments(params?: { limit?: number; offset?: number }): Promise<DocumentListResponse> {
    const response = await this.api.get(`${API_V1_PREFIX}/documents`, { params });
    return response.data;
  }

  async uploadDocument(file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post(`${API_V1_PREFIX}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async downloadDocument(docId: string, filename: string): Promise<void> {
    const response = await this.api.get(`${API_V1_PREFIX}/documents/${docId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async getDocumentBlob(docId: string): Promise<Blob> {
    const response = await this.api.get(`${API_V1_PREFIX}/documents/${docId}/download`, {
      responseType: 'blob',
    });
    return new Blob([response.data]);
  }

  async deleteDocument(docId: string): Promise<any> {
    const response = await this.api.delete(`${API_V1_PREFIX}/documents/${docId}`);
    return response.data;
  }
}

export const apiService = new ApiService();
