import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { ChatSessionItem, DocumentItem } from '../types';

interface SidebarProps {
  onSelectSession?: (session: ChatSessionItem) => void;
  onSelectVaultDoc?: (doc: DocumentItem) => void;
  onNewChat?: () => void;
  selectedSessionId?: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  onSelectSession,
  onSelectVaultDoc,
  onNewChat,
  selectedSessionId,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isWorkspace = location.pathname === '/workspace';

  const {
    sidebarOpen,
    setSidebarOpen,
    sessionsList,
    documentsList,
    historyLoading,
    historySearch,
    setHistorySearch,
    sidebarTab,
    setSidebarTab,
    activeSessionId,
    deleteSession,
  } = useSidebar();

  const currentSelectedId = selectedSessionId !== undefined ? selectedSessionId : activeSessionId;

  const handleStartNewQuestion = () => {
    if (isWorkspace && onNewChat) {
      onNewChat();
    } else {
      navigate('/workspace', { state: { newChat: true } });
    }
  };

  const handleSessionClick = (session: ChatSessionItem) => {
    if (isWorkspace && onSelectSession) {
      onSelectSession(session);
    } else {
      navigate(`/workspace?session=${encodeURIComponent(session.session_id)}`, {
        state: { session },
      });
    }
  };

  const handleVaultDocClick = (doc: DocumentItem) => {
    if (isWorkspace && onSelectVaultDoc) {
      onSelectVaultDoc(doc);
    } else {
      navigate(`/workspace?doc_id=${encodeURIComponent(doc.id)}`, {
        state: { doc },
      });
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteSession(sessionId);
  };

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-80' : 'w-0'
      } transition-all duration-300 ease-in-out bg-[#0B0F17] border-r border-white/10 flex flex-col h-full flex-shrink-0 overflow-hidden relative z-20 select-none`}
    >
      {/* ── Top Header Section (Clean & Minimal) ─────── */}
      <div className="flex-shrink-0 p-3 space-y-2 border-b border-white/5 bg-[#0B0F17]">
        {/* Top: New Question Button + Collapse Icon */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartNewQuestion}
            className="flex-1 flex items-center gap-2 px-3.5 py-2 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-semibold text-emerald-300 transition-all shadow-xs group"
            title="Start a new question"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
              +
            </span>
            <span>New Question</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Minimal Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-8 pr-7 py-1.5 bg-[#141C2E]/60 border border-white/5 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
          />
          {historySearch && (
            <button
              type="button"
              onClick={() => setHistorySearch('')}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Clean Segmented Tab Switcher */}
        <div className="flex gap-1 p-0.5 bg-[#141C2E]/50 rounded-lg border border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setSidebarTab('history')}
            className={`flex-1 py-1 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'history'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Chats</span>
            <span className={`text-[10px] px-1 rounded-full ${sidebarTab === 'history' ? 'bg-emerald-700/80' : 'bg-white/10'}`}>
              {sessionsList.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('documents')}
            className={`flex-1 py-1 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'documents'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Vault</span>
            <span className={`text-[10px] px-1 rounded-full ${sidebarTab === 'documents' ? 'bg-emerald-700/80' : 'bg-white/10'}`}>
              {documentsList.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('presets')}
            className={`py-1 px-2.5 rounded-md text-xs font-medium transition-all ${
              sidebarTab === 'presets'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Presets
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT (Scrollable, Simple & Uncluttered) ───────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 min-h-0">
        {/* TAB 1: CHATS (ChatGPT / Gemini Style Clean List) */}
        {sidebarTab === 'history' && (
          <div>
            {historyLoading && sessionsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <span>Loading history...</span>
              </div>
            ) : sessionsList.length === 0 ? (
              <div className="py-12 px-4 text-center text-xs text-slate-400 space-y-1.5">
                <span className="text-xl block opacity-60">💬</span>
                <p className="font-medium text-slate-300">No chats yet</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Ask a question to start a new thread.
                </p>
              </div>
            ) : (
              (() => {
                const filtered = sessionsList.filter((item) => {
                  if (!historySearch.trim()) return true;
                  const q = historySearch.toLowerCase();
                  return (
                    (item.title && item.title.toLowerCase().includes(q)) ||
                    (item.latest_question && item.latest_question.toLowerCase().includes(q)) ||
                    (item.latest_answer && item.latest_answer.toLowerCase().includes(q)) ||
                    (item.document_name && item.document_name.toLowerCase().includes(q))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No matches found
                    </div>
                  );
                }

                // Date bucket grouping
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const yesterdayMidnight = todayMidnight - 86400000;
                const sevenDaysMidnight = todayMidnight - 7 * 86400000;

                const groups: { [key: string]: typeof sessionsList } = {
                  Today: [],
                  Yesterday: [],
                  'Previous 7 Days': [],
                  Older: [],
                };

                filtered.forEach((item) => {
                  const t = new Date(item.updated_at).getTime();
                  if (t >= todayMidnight) groups.Today.push(item);
                  else if (t >= yesterdayMidnight) groups.Yesterday.push(item);
                  else if (t >= sevenDaysMidnight) groups['Previous 7 Days'].push(item);
                  else groups.Older.push(item);
                });

                return Object.entries(groups).map(([groupTitle, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={groupTitle} className="space-y-0.5 mb-3">
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {groupTitle}
                      </div>
                      {items.map((session) => {
                        const isSelected = currentSelectedId === session.session_id;
                        const title = session.latest_question || session.title || 'Untitled Passage';
                        return (
                          <div
                            key={session.session_id}
                            onClick={() => handleSessionClick(session)}
                            className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer text-xs ${
                              isSelected
                                ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                            title={title}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-6">
                              <span className="text-slate-500 group-hover:text-slate-300 shrink-0">
                                {session.task_type === 'pdf_qa' ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                  </svg>
                                )}
                              </span>
                              <span className="truncate font-normal">
                                {title}
                              </span>
                            </div>

                            {/* Hover Delete Button */}
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, session.session_id)}
                              className="absolute right-2 p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-white/10"
                              title="Delete chat"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* TAB 2: CLIENT DOCUMENT VAULT (Clean List) */}
        {sidebarTab === 'documents' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 text-xs">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Documents ({documentsList.length})
              </span>
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="cursor-pointer text-[11px] text-emerald-400 hover:underline font-medium"
              >
                + Manage
              </button>
            </div>

            {documentsList.length === 0 ? (
              <div className="py-12 px-4 text-center text-xs text-slate-400 space-y-1.5">
                <span className="text-xl block opacity-60">📁</span>
                <p className="font-medium text-slate-300">Vault is empty</p>
                <p className="text-[11px] text-slate-500">
                  Upload PDFs to query them anytime.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {documentsList.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleVaultDocClick(doc)}
                    className="group flex items-center justify-between px-2.5 py-2 rounded-xl transition-all cursor-pointer text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    title={doc.filename}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-teal-400 text-xs shrink-0">📄</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-normal">
                          {doc.filename}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {doc.page_count} pages · {Math.round(doc.file_size / 1024)} KB
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUICK PRESETS */}
        {sidebarTab === 'presets' && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
              Quick Prompts
            </p>
            {[
              { id: 'pdf-revenue', label: '📄 PDF Revenue Query', desc: 'Total revenue in FY24' },
              { id: 'apple', label: '👥 Apple Founders', desc: 'Multi-span extraction' },
              { id: 'table', label: '📊 CSV Price Check', desc: 'Price of iPhone 15 Pro' },
              { id: 'unanswerable', label: '🛡️ Abstention / Null Test', desc: 'Unanswerable query detection' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/workspace?preset=${p.id}`)}
                className="w-full text-left px-2.5 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-all"
              >
                <span className="font-medium block text-slate-200">{p.label}</span>
                <span className="text-[11px] text-slate-500 block truncate">{p.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Sidebar: Vault Manager Link */}
      <div className="p-2.5 border-t border-white/5 bg-[#0B0F17]">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Full History & Vault</span>
          </span>
          <span className="text-slate-500">→</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
