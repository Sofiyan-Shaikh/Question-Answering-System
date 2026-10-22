import axios, { AxiosInstance } from 'axios';
import { QARequest, QAResponse, LoginRequest, AuthToken, HealthResponse, MetricsResponse, PDFQAResponse, PDFExtractResponse } from '../types';

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
      async (config) => {
        let token = localStorage.getItem('token');
        if (!token) {
          try {
            const resp = await axios.post(`${API_BASE_URL}${API_V1_PREFIX}/auth/login`, {
              username: 'analyst',
              password: 'password123',
            });
            const fetchedToken = resp.data?.access_token;
            if (fetchedToken) {
              token = fetchedToken;
              localStorage.setItem('token', fetchedToken);
              localStorage.setItem('username', 'analyst');
            }
          } catch (e) {
            // ignore
          }
        }
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling without login redirects
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (
          error.response?.status === 401 &&
          !originalRequest?._retry &&
          !originalRequest?.url?.includes('/auth/login')
        ) {
          originalRequest._retry = true;
          try {
            const resp = await axios.post(`${API_BASE_URL}${API_V1_PREFIX}/auth/login`, {
              username: 'analyst',
              password: 'password123',
            });
            const newToken = resp.data.access_token;
            localStorage.setItem('token', newToken);
            localStorage.setItem('username', 'analyst');
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.api(originalRequest);
          } catch (loginErr) {
            return Promise.reject(loginErr);
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

  // Question Answering
  async predictAnswer(request: QARequest): Promise<QAResponse> {
    const response = await this.api.post(`${API_V1_PREFIX}/qa/predict`, request);
    return response.data;
  }

  // PDF Question Answering
  async predictPdfAnswer(file: File, question: string, topK: number = 1): Promise<PDFQAResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', question);
    formData.append('top_k', topK.toString());

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
}

export const apiService = new ApiService();
