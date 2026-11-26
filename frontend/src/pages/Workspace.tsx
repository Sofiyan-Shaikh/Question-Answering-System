import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { AnswerSpan, QAResponse, PDFQAResponse, DocumentItem, ChatSessionItem } from '../types';
import Sidebar from '../components/Sidebar';
import { useSidebar } from '../context/SidebarContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  question?: string;
  mode: 'passage' | 'pdf';
  targetDocName: string;
  result?: QAResponse | PDFQAResponse;
  timestamp: string;
}

/* ── Highlighted Passage Component ────────────────────────────────────── */
const HighlightedText: React.FC<{
  context: string;
  startChar?: number;
  endChar?: number;
  answers?: AnswerSpan[];
  highlightText?: string;
}> = ({ context, startChar, endChar, answers, highlightText }) => {
  if (highlightText && highlightText.trim().length > 0) {
    const idx = context.toLowerCase().indexOf(highlightText.toLowerCase());
    if (idx !== -1) {
      const before = context.slice(0, idx);
      const matched = context.slice(idx, idx + highlightText.length);
      const after = context.slice(idx + highlightText.length);
      return (
        <span className="leading-relaxed">
          {before}
          <mark className="bg-emerald-500/30 text-emerald-200 border-b-2 border-emerald-400 font-bold px-1 py-0.5 rounded shadow-xs">
            {matched}
          </mark>
          {after}
        </span>
      );
    }
  }

  if (answers && answers.length > 0) {
    const validSpans = answers
      .filter((a) => a.start_char >= 0 && a.end_char > a.start_char)
      .sort((a, b) => a.start_char - b.start_char);

    if (validSpans.length > 0) {
      const elements: React.ReactNode[] = [];
      let lastIndex = 0;
      validSpans.forEach((span, idx) => {
        if (span.start_char >= lastIndex && span.end_char <= context.length) {
          if (span.start_char > lastIndex) {
            elements.push(context.slice(lastIndex, span.start_char));
          }
          elements.push(
            <mark
              key={idx}
              className="bg-emerald-500/30 text-emerald-200 border-b border-emerald-400 font-semibold px-1 py-0.5 rounded inline-block my-0.5"
            >
              {context.slice(span.start_char, span.end_char)}
              {answers.length > 1 && (
                <span className="ml-1 text-[10px] bg-emerald-600 text-white rounded-full px-1.5 py-0.2 font-mono">
                  #{idx + 1}
                </span>
              )}
            </mark>
          );
          lastIndex = span.end_char;
        }
      });
      if (lastIndex < context.length) {
        elements.push(context.slice(lastIndex));
      }
      return <span className="leading-relaxed">{elements}</span>;
    }
  }

  if (startChar !== undefined && endChar !== undefined && startChar >= 0 && endChar > startChar) {
    const before = context.slice(0, startChar);
    const answer = context.slice(startChar, endChar);
    const after = context.slice(endChar);
    return (
      <span className="leading-relaxed">
        {before}
        <mark className="bg-emerald-500/30 text-emerald-200 border-b-2 border-emerald-400 font-bold px-1 py-0.5 rounded">
          {answer}
        </mark>
        {after}
      </span>
    );
  }

  return <span className="leading-relaxed">{context}</span>;
};

/* ── Main Clean Workspace ─────────────────────────────────────────────── */
const Workspace: React.FC = () => {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, fetchSidebarData } = useSidebar();

  // Mode & Context
  const [mode, setMode] = useState<'passage' | 'pdf'>('passage');
  const [context, setContext] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeDocumentName, setActiveDocumentName] = useState<string | null>(null);
  const [isEditingContext, setIsEditingContext] = useState(false);

  // Interaction
  const [question, setQuestion] = useState<string>('');
  const [topK, setTopK] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // ChatGPT-style Passage Session State
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => 'sess_' + Date.now().toString(36));
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Audio Speech Synthesis
  const handleSpeak = (text: string, id: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleNewChat = () => {
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
    setMessages([]);
    setQuestion('');
    setSelectedSessionId(null);
    setCurrentSessionId('sess_' + Date.now().toString(36));
  };

  // Continue working from a previous passage session tab (restores entire thread of all questions)
  const handleSelectSession = async (session: ChatSessionItem) => {
    setSelectedSessionId(session.session_id);
    setCurrentSessionId(session.session_id);

    // 1. Set mode and context/document
    if (session.task_type === 'pdf_qa' || session.task_type === 'pdf_extract') {
      setMode('pdf');
      if (session.document_id) {
        try {
          const blob = await apiService.getDocumentBlob(session.document_id);
          const file = new File([blob], session.document_name || 'document.pdf', {
            type: 'application/pdf',
          });
          setPdfFile(file);
        } catch {
          if (session.document_name) {
            setPdfFile(new File([''], session.document_name, { type: 'application/pdf' }));
          }
        }
      } else if (session.document_name) {
        setPdfFile(new File([''], session.document_name, { type: 'application/pdf' }));
      }
    } else {
      setMode('passage');
      if (session.context_preview) {
        setContext(session.context_preview);
      }
    }

    // 2. Load all past questions & answers in this passage session thread
    try {
      setLoading(true);
      const tasks = await apiService.getSessionMessages(session.session_id);
      const chatMsgs: ChatMessage[] = [];
      tasks.forEach((t) => {
        chatMsgs.push({
          id: 'user-' + t.id,
          role: 'user',
          question: t.question,
          mode: t.task_type === 'pdf_qa' ? 'pdf' : 'passage',
          targetDocName: t.document_name || 'Passage Context',
          timestamp: new Date(t.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });

        chatMsgs.push({
          id: 'resp-' + t.id,
          role: 'assistant',
          mode: t.task_type === 'pdf_qa' ? 'pdf' : 'passage',
          targetDocName: t.document_name || 'Passage Context',
          result: {
            answer: t.answer || '',
            descriptive_answer: t.descriptive_answer,
            answers: t.citations,
            is_answerable: t.is_answerable,
            confidence_score: t.confidence_score,
            page_number: t.page_number,
            total_pages: 1,
            matched_passage: t.context_preview,
            filename: t.document_name || '',
            start_char: 0,
            end_char: 0,
            model_version: 'squad2.0',
            execution_time_ms: t.execution_time_ms,
          } as any,
          timestamp: new Date(t.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      });
      setMessages(chatMsgs);
      setQuestion(session.latest_question || '');
    } catch (err) {
      console.error('Failed to load session conversation thread:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load document from vault into workspace for active questioning (no re-download/re-upload needed)
  const handleSelectVaultDoc = async (doc: DocumentItem) => {
    setPdfFile(null);
    setActiveDocumentId(doc.id);
    setActiveDocumentName(doc.filename);
    setMode('pdf');
    setSelectedSessionId(null);
    setQuestion('');
    setMessages([
      {
        id: 'doc-loaded-' + Date.now(),
        role: 'assistant',
        mode: 'pdf',
        targetDocName: doc.filename,
        result: {
          answer: `Loaded "${doc.filename}" (${doc.page_count} pages). Ask any question below.`,
          is_answerable: true,
          confidence_score: 1.0,
          start_char: 0,
          end_char: 0,
          model_version: 'vault-loader',
          execution_time_ms: 0,
        } as any,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Listen for navigation state when arriving from other pages
  useEffect(() => {
    if (location.state?.session) {
      handleSelectSession(location.state.session);
    } else if (location.state?.doc) {
      handleSelectVaultDoc(location.state.doc);
    } else if (location.state?.newChat) {
      handleNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setPdfFile(file);
        setActiveDocumentId(null);
        setActiveDocumentName(file.name);
        setMode('pdf');
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setPdfFile(file);
        setActiveDocumentId(null);
        setActiveDocumentName(file.name);
        setMode('pdf');
      }
    }
  };

  // Execute QA Inference
  const handleSend = async (qToSend?: string) => {
    const q = (qToSend || question).trim();
    if (!q || loading) return;

    if (mode === 'passage' && !context.trim()) {
      setIsEditingContext(true);
      return;
    }
    if (mode === 'pdf' && !pdfFile && !activeDocumentId) {
      fileInputRef.current?.click();
      return;
    }

    const targetDoc = mode === 'pdf' ? (activeDocumentName || pdfFile?.name || 'document.pdf') : 'Passage Context';
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      question: q,
      mode,
      targetDocName: targetDoc,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);

    try {
      if (mode === 'passage') {
        const res = await apiService.predictAnswer({
          context,
          question: q,
          top_k: topK,
          session_id: currentSessionId,
        });
        const assistantMsg: ChatMessage = {
          id: 'resp-' + Date.now(),
          role: 'assistant',
          mode: 'passage',
          targetDocName: targetDoc,
          result: res,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const res = activeDocumentId
          ? await apiService.predictDocumentAnswer(activeDocumentId, q, topK, currentSessionId)
          : await apiService.predictPdfAnswer(pdfFile!, q, topK, currentSessionId);

        if (res.document_id && !activeDocumentId) {
          setActiveDocumentId(res.document_id);
          setActiveDocumentName(res.filename);
        }
        const assistantMsg: ChatMessage = {
          id: 'resp-' + Date.now(),
          role: 'assistant',
          mode: 'pdf',
          targetDocName: targetDoc,
          result: res,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      const assistantMsg: ChatMessage = {
        id: 'resp-' + Date.now(),
        role: 'assistant',
        mode,
        targetDocName: targetDoc,
        result: {
          answer: 'Unable to extract answer. Please check backend connection.',
          is_answerable: false,
          confidence_score: 0.0,
          start_char: -1,
          end_char: -1,
          model_version: 'error',
          execution_time_ms: 0,
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
      fetchSidebarData();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Export conversation as Markdown
  const handleExportSession = () => {
    if (messages.length === 0) return;

    let md = `# QA Session Export\n`;
    md += `Date: ${new Date().toLocaleString()}\n`;
    md += `Document: ${mode === 'pdf' ? pdfFile?.name : 'Passage Context'}\n\n---\n\n`;

    messages.forEach((m) => {
      if (m.role === 'user') {
        md += `**Question**: ${m.question}\n\n`;
      } else {
        md += `**Answer**: ${m.result?.answer}\n`;
        if (m.result?.confidence_score) {
          md += `*Confidence*: ${(m.result.confidence_score * 100).toFixed(1)}%\n\n`;
        }
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qa_session_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className="flex-1 flex h-full w-full overflow-hidden relative bg-[#070A0F] text-slate-100 min-h-0"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#070A0F]/90 backdrop-blur-md border-2 border-dashed border-emerald-500 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-lg font-bold text-white">Drop PDF document here</p>
        </div>
      )}

      {/* ── Left Sidebar (ChatGPT-Style Preserved History & Vault) ─── */}
      <Sidebar
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
        onSelectVaultDoc={handleSelectVaultDoc}
        onNewChat={handleNewChat}
      />

      {/* ── Main Chat Canvas ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#070A0F] relative min-w-0 min-h-0">
        {/* Top Header Bar */}
        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-[#0B0F17]/90 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>

            {!sidebarOpen && (
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141C2E] hover:bg-[#1C263D] border border-white/10 rounded-lg text-xs font-medium text-slate-200 transition-colors"
                title="New Question"
              >
                <span className="text-emerald-400 font-bold">+</span>
                <span className="hidden sm:inline">New Question</span>
              </button>
            )}

            {/* Active Document Indicator Pill */}
            <button
              type="button"
              onClick={() => {
                if (mode === 'passage') setIsEditingContext(true);
                else fileInputRef.current?.click();
              }}
              className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white bg-[#141C2E] hover:bg-[#1E293B] border border-white/10 px-3 py-1 rounded-full transition-colors"
            >
              <span>{mode === 'pdf' ? '📄' : '📝'}</span>
              <span className="truncate max-w-xs">{mode === 'pdf' ? (activeDocumentName || pdfFile?.name || 'Select PDF') : 'Passage Context'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Top-K Selector */}
            <div className="flex items-center gap-1 bg-[#141C2E] border border-white/10 rounded-lg p-0.5 text-xs">
              <span className="text-[10px] text-slate-400 px-1.5">Top-K:</span>
              {[1, 2, 3].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTopK(k)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    topK === k
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'hover:bg-white/5 text-slate-400'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Export session */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleExportSession}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Export session"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Empty State */}
            {messages.length === 0 && (
              <div className="pt-20 pb-6 flex flex-col items-center text-center fade-in">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white text-xl font-bold shadow-lg mb-4">
                  Q
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Ask a question about your document
                </h2>
                <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                  Paste a text passage or upload a PDF file below, then type your question to extract the exact answer.
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('passage');
                      setIsEditingContext(true);
                    }}
                    className="px-4 py-2 bg-[#141C2E] hover:bg-[#1E293B] border border-white/10 rounded-xl text-xs font-medium text-slate-200 transition-all"
                  >
                    Paste Text Passage
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#141C2E] hover:bg-[#1E293B] border border-white/10 rounded-xl text-xs font-medium text-slate-200 transition-all"
                  >
                    Upload PDF Document
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-3 fade-in">
                {msg.role === 'user' ? (
                  /* User Bubble */
                  <div className="flex justify-end items-start gap-2.5">
                    <div className="max-w-xl bg-[#1C273E] text-slate-100 rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-md border border-white/10">
                      <p className="text-sm font-medium">{msg.question}</p>
                    </div>
                  </div>
                ) : (
                  /* Assistant Card */
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      ✨
                    </div>

                    <div className="flex-1 bg-[#141C2E]/70 border border-white/10 rounded-2xl rounded-tl-xs p-4 shadow-lg space-y-3">
                      {/* Status & Actions Header */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {msg.result?.is_answerable ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              {msg.result?.confidence_score !== undefined
                                ? `${(msg.result.confidence_score * 100).toFixed(0)}% Match`
                                : 'Answerable'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Abstained (No Answer in Context)
                            </span>
                          )}

                          {msg.result?.execution_time_ms !== undefined && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              • {msg.result.execution_time_ms.toFixed(0)}ms
                            </span>
                          )}
                        </div>

                        {/* Minimal Actions */}
                        <div className="flex items-center gap-2">
                          {msg.result?.is_answerable && (
                            <button
                              type="button"
                              onClick={() => handleSpeak(msg.result?.descriptive_answer || msg.result?.answer || '', msg.id)}
                              className={`p-1 rounded hover:bg-white/5 transition-colors ${
                                speakingId === msg.id ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                              }`}
                              title="Read aloud descriptive answer"
                            >
                              🔊
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.result?.descriptive_answer || msg.result?.answer || '', msg.id)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-xs font-mono"
                            title="Copy descriptive answer"
                          >
                            {copiedId === msg.id ? (
                              <span className="text-emerald-400 font-bold">✓</span>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Main Answer Text */}
                      <div>
                        {msg.result?.is_answerable ? (
                          <div className="space-y-3">
                            {/* Descriptive Answer Card */}
                            {msg.result.descriptive_answer ? (
                              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-[#162238] to-[#121a2c] border border-emerald-500/25 shadow-inner">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Descriptive Answer
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-sans">
                                    Full sentence context
                                  </span>
                                </div>
                                <p className="text-sm sm:text-[15px] text-slate-100 font-normal leading-relaxed">
                                  {msg.result.descriptive_answer}
                                </p>
                              </div>
                            ) : null}

                            {/* Direct Key Fact Span */}
                            <div className="flex items-baseline gap-2 pt-0.5">
                              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide flex-shrink-0">
                                Direct Answer:
                              </span>
                              <span className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                                {msg.result.answer}
                              </span>
                            </div>

                            {/* Multi-span chips if multiple */}
                            {msg.result.answers && msg.result.answers.length > 1 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {msg.result.answers.map((ans, aIdx) => (
                                  <span
                                    key={aIdx}
                                    className="inline-flex items-center gap-1.5 bg-[#0B0F17] border border-white/10 text-slate-200 px-2 py-0.5 rounded text-[11px] font-medium"
                                  >
                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                                      {aIdx + 1}
                                    </span>
                                    <span>{ans.answer}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            No answer supported by the context. The model abstained based on the SQuAD 2.0 null threshold.
                          </p>
                        )}
                      </div>

                      {/* PDF Citation or Snippet toggle */}
                      {msg.result?.is_answerable && (
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                          {msg.mode === 'pdf' && (msg.result as PDFQAResponse)?.page_number ? (
                            <span>Page {(msg.result as PDFQAResponse).page_number} in {(msg.result as PDFQAResponse).filename}</span>
                          ) : (
                            <span>Extracted from passage</span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSnippetId(expandedSnippetId === msg.id ? null : msg.id)
                            }
                            className="text-emerald-400 hover:underline"
                          >
                            {expandedSnippetId === msg.id ? 'Hide context' : 'View context'}
                          </button>
                        </div>
                      )}

                      {/* In-context expanded snippet */}
                      {expandedSnippetId === msg.id && msg.result?.is_answerable && (
                        <div className="p-3 text-xs text-slate-300 bg-[#0B0F17] rounded-xl border border-white/5 max-h-40 overflow-y-auto leading-relaxed">
                          {msg.mode === 'pdf' && (msg.result as PDFQAResponse)?.matched_passage ? (
                            <HighlightedText
                              context={(msg.result as PDFQAResponse).matched_passage!}
                              highlightText={msg.result.answer}
                            />
                          ) : (
                            <HighlightedText
                              context={context}
                              startChar={(msg.result as QAResponse)?.start_char}
                              endChar={(msg.result as QAResponse)?.end_char}
                              answers={msg.result.answers}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex items-center gap-3 text-xs text-slate-400 fade-in pl-10">
                <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Finding exact answer…</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* ── Bottom Input Pill (FROZEN / PINNED LIKE GEMINI) ─────────── */}
        <div className="flex-shrink-0 relative bg-[#070A0F] pt-2 pb-4 px-4 z-20">
          {/* Soft upward gradient overlay so messages smoothly disappear behind the frozen search box */}
          <div className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-[#070A0F] to-transparent" />

          <div className="max-w-3xl mx-auto space-y-2">
            <div className="relative bg-[#141C2E]/95 backdrop-blur-xl border border-white/10 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-[28px] shadow-2xl transition-all p-2 flex items-center gap-2">
              {/* Attachment */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors shrink-0"
                title="Upload PDF document"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Input */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'pdf'
                    ? (activeDocumentName || pdfFile)
                      ? `Ask anything about ${activeDocumentName || pdfFile?.name}…`
                      : 'Upload a PDF to ask questions…'
                    : 'Ask anything about the passage context…'
                }
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 resize-none focus:outline-none px-2 py-1.5 max-h-32"
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !question.trim()}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  question.trim() && !loading
                    ? 'bg-emerald-500 text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 opacity-40 cursor-not-allowed'
                }`}
                aria-label="Send query"
              >
                <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Minimal Context Editor Modal ─────────────────────────────── */}
      {isEditingContext && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
          <div className="bg-[#0F1523] border border-white/15 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white">Edit Passage Context</h3>
              <button
                type="button"
                onClick={() => setIsEditingContext(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={8}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full bg-[#070A0F] border border-white/10 rounded-xl p-3 text-xs text-slate-200 font-sans focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              placeholder="Paste context passage or CSV table here…"
            />

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>{context.length} characters</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContext('')}
                  className="px-3 py-1 bg-[#141C2E] hover:bg-[#1E293B] rounded-lg text-slate-300"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingContext(false)}
                  className="btn-primary text-xs py-1 px-4"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
