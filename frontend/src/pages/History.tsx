import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { TaskHistoryItem, DocumentItem, HistoryStats } from '../types';

const History: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'history' | 'documents'>('history');

  // Stats state
  const [stats, setStats] = useState<HistoryStats | null>(null);

  // History state
  const [historyItems, setHistoryItems] = useState<TaskHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskHistoryItem | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal states
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await apiService.getHistoryStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Load history items
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiService.getHistory({
        task_type: taskTypeFilter === 'all' ? undefined : taskTypeFilter,
        search: debouncedSearch || undefined,
        limit: 100,
        offset: 0,
      });
      setHistoryItems(res.history);
      setHistoryTotal(res.total);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [taskTypeFilter, debouncedSearch]);

  // Load documents
  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await apiService.getDocuments({ limit: 100, offset: 0 });
      setDocuments(res.documents);
      setDocTotal(res.total);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Show temporary action toast
  const showToast = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Handle single history delete
  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiService.deleteHistoryItem(id);
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      setHistoryTotal((prev) => Math.max(0, prev - 1));
      if (selectedTask?.id === id) {
        setSelectedTask(null);
      }
      fetchStats();
      showToast('success', 'Task record removed from history');
    } catch (err) {
      showToast('error', 'Failed to delete history record');
    }
  };

  // Handle clear all history
  const handleClearHistory = async () => {
    try {
      await apiService.clearHistory();
      setHistoryItems([]);
      setHistoryTotal(0);
      setSelectedTask(null);
      setConfirmClearOpen(false);
      fetchStats();
      showToast('success', 'User task history cleared successfully');
    } catch (err) {
      showToast('error', 'Failed to clear history');
    }
  };

  // Handle document upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF documents are supported (.pdf)');
      return;
    }

    setUploadingDoc(true);
    setUploadError(null);
    try {
      const newDoc = await apiService.uploadDocument(file);
      setDocuments((prev) => [newDoc, ...prev]);
      setDocTotal((prev) => prev + 1);
      fetchStats();
      fetchHistory();
      showToast('success', `Saved "${file.name}" into document vault`);
      e.target.value = '';
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Handle document download
  const handleDownloadDoc = async (doc: DocumentItem) => {
    try {
      await apiService.downloadDocument(doc.id, doc.filename);
      showToast('success', `Downloading ${doc.filename}`);
    } catch (err) {
      showToast('error', 'Failed to download document file');
    }
  };

  // Handle document delete
  const handleDeleteDoc = async (docId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to remove "${filename}" from the vault?`)) {
      return;
    }
    try {
      await apiService.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setDocTotal((prev) => Math.max(0, prev - 1));
      fetchStats();
      showToast('success', `Removed "${filename}" from document vault`);
    } catch (err) {
      showToast('error', 'Failed to delete document');
    }
  };

  const getTaskBadge = (type: string) => {
    switch (type) {
      case 'text_qa':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Text QA
          </span>
        );
      case 'pdf_qa':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF QA
          </span>
        );
      case 'pdf_extract':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            PDF Extract
          </span>
        );
      case 'document_upload':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Vault Upload
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            {type}
          </span>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-full flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 transition-all transform animate-bounce ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current"></span>
          <span className="text-sm font-medium">{actionMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                User Task History & Document Vault
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Preserve client documents, audit past QA questions, and review confidence metrics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="btn-primary cursor-pointer px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 hover:scale-105 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{uploadingDoc ? 'Saving Document...' : 'Upload Client PDF'}</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploadingDoc}
            />
          </label>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Top Aggregate Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#111827]/70 backdrop-blur-xl border border-white/10 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Tasks Executed</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2 font-mono">
            {stats?.total_tasks ?? '—'}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Preserved across all sessions</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111827]/70 backdrop-blur-xl border border-white/10 hover:border-teal-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Client Documents Vault</span>
            <span className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-extrabold text-teal-300 mt-2 font-mono">
            {stats?.total_documents ?? '—'}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">PDF files saved with checksums</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111827]/70 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">PDF Inferences</span>
            <span className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-extrabold text-cyan-300 mt-2 font-mono">
            {stats?.pdf_qa_count ?? '—'}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">BM25 + BERT span extractions</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111827]/70 backdrop-blur-xl border border-white/10 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Average Confidence</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2 font-mono">
            {stats?.avg_confidence ? `${(stats.avg_confidence * 100).toFixed(1)}%` : '—'}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Historical model certainty</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Task History ({historyTotal})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'documents'
                ? 'border-emerald-500 text-emerald-400 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Client Documents Vault ({docTotal})</span>
          </button>
        </div>

        {activeTab === 'history' && historyItems.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-rose-950/30 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* ── TAB 1: TASK HISTORY ───────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history by question, answer, or document..."
                className="w-full pl-10 pr-4 py-2 bg-[#111827]/80 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={taskTypeFilter}
                onChange={(e) => setTaskTypeFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2 bg-[#111827]/80 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">All Task Types</option>
                <option value="text_qa">Text QA</option>
                <option value="pdf_qa">PDF QA</option>
                <option value="pdf_extract">PDF Extraction</option>
                <option value="document_upload">Vault Upload</option>
              </select>
            </div>
          </div>

          {/* History List */}
          {historyLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs">Loading preserved task history...</p>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-[#111827]/40 border border-white/10 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-300">No Task History Found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchQuery || taskTypeFilter !== 'all'
                  ? 'No task history matched your search criteria.'
                  : 'Start asking questions or analyzing documents in the QA Workspace to see your activity recorded here automatically.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/workspace')}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold mt-2"
              >
                Go to QA Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedTask(item)}
                  className={`p-4 rounded-2xl bg-[#111827]/70 backdrop-blur-xl border transition-all cursor-pointer hover:border-emerald-500/40 hover:bg-[#131d31]/80 ${
                    selectedTask?.id === item.id ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-white/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTaskBadge(item.task_type)}
                      {item.document_name && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-300 bg-teal-950/40 px-2 py-0.5 rounded-lg border border-teal-500/20">
                          <svg className="w-3 h-3 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          {item.document_name}
                          {item.page_number && <span className="text-teal-400">· p.{item.page_number}</span>}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{formatDate(item.created_at)}</span>
                      {item.execution_time_ms > 0 && (
                        <span className="font-mono text-slate-400">{item.execution_time_ms.toFixed(0)}ms</span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistory(item.id, e)}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Delete task record"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Question */}
                  {item.question && (
                    <p className="text-xs sm:text-sm font-semibold text-slate-100 mt-1 line-clamp-2">
                      Q: {item.question}
                    </p>
                  )}

                  {/* Answer & Confidence */}
                  <div className="mt-2.5 pt-2.5 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-xs font-bold text-emerald-400 shrink-0">Answer:</span>
                      <p className="text-xs text-slate-200 font-medium line-clamp-2">
                        {item.answer || 'No direct span extracted'}
                      </p>
                    </div>

                    {item.confidence_score > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-slate-400">Confidence:</span>
                        <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              item.confidence_score > 0.7
                                ? 'bg-emerald-400'
                                : item.confidence_score > 0.4
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${Math.min(100, item.confidence_score * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-emerald-300 font-bold">
                          {(item.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: CLIENT DOCUMENT VAULT ───────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-[#111827]/70 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-emerald-300">Client Document Repository</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every PDF analyzed or uploaded by clients is safely stored here. You can download or review them anytime.
              </p>
            </div>
            <label className="btn-primary cursor-pointer px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md self-start sm:self-auto">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>{uploadingDoc ? 'Uploading...' : 'Add Client Document'}</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingDoc}
              />
            </label>
          </div>

          {docsLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs">Loading stored client documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-[#111827]/40 border border-white/10 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-300">No Client Documents Stored Yet</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Documents uploaded during PDF Question Answering or directly uploaded to the vault will be preserved here permanently.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-2xl bg-[#111827]/70 backdrop-blur-xl border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                        {formatFileSize(doc.file_size)}
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-semibold text-white mt-3 truncate" title={doc.filename}>
                      {doc.filename}
                    </h3>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span>{doc.page_count} pages</span>
                      <span>•</span>
                      <span>{doc.task_count || 0} queries run</span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-2 font-mono">
                      Uploaded {formatDate(doc.created_at)}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadDoc(doc)}
                      className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate('/workspace')}
                        className="px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all"
                        title="Query in Workspace"
                      >
                        Ask QA
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                        title="Delete from vault"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0F172A] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {getTaskBadge(selectedTask.task_type)}
                <span className="text-xs text-slate-400 font-mono">
                  ID: {selectedTask.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                User Question
              </label>
              <p className="text-sm font-semibold text-white mt-1">
                {selectedTask.question || '—'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Extracted Answer
              </label>
              <p className="text-sm font-bold text-white">
                {selectedTask.answer || 'No direct span extracted'}
              </p>
              {selectedTask.descriptive_answer && (
                <p className="text-xs text-slate-300 italic pt-1 border-t border-emerald-500/20">
                  "{selectedTask.descriptive_answer}"
                </p>
              )}
            </div>

            {selectedTask.context_preview && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Context Passage / Excerpt
                </label>
                <div className="mt-1 p-3 bg-black/30 border border-white/5 rounded-xl text-xs text-slate-300 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">
                  {selectedTask.context_preview}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-xs text-slate-400">
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Confidence</span>
                <span className="font-mono font-bold text-emerald-300">
                  {(selectedTask.confidence_score * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Latency</span>
                <span className="font-mono text-white">
                  {selectedTask.execution_time_ms.toFixed(1)} ms
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Page Citation</span>
                <span className="font-mono text-white">
                  {selectedTask.page_number ? `Page ${selectedTask.page_number}` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Executed At</span>
                <span className="font-mono text-white">
                  {formatDate(selectedTask.created_at)}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0F172A] border border-rose-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-rose-400">⚠️</span>
              Clear All Task History?
            </h3>
            <p className="text-xs text-slate-300">
              This will permanently remove all your past Q&A queries and answers from the history log. Stored client documents will remain in the vault.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 transition-all"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
