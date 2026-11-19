import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { ChatSessionItem, DocumentItem } from '../types';

interface SidebarContextType {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  sessionsList: ChatSessionItem[];
  setSessionsList: React.Dispatch<React.SetStateAction<ChatSessionItem[]>>;
  documentsList: DocumentItem[];
  setDocumentsList: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  historyLoading: boolean;
  historySearch: string;
  setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
  sidebarTab: 'history' | 'documents' | 'presets';
  setSidebarTab: React.Dispatch<React.SetStateAction<'history' | 'documents' | 'presets'>>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  fetchSidebarData: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('qa_sidebar_open') !== 'false';
    } catch {
      return true;
    }
  });

  const [sidebarTab, setSidebarTab] = useState<'history' | 'documents' | 'presets'>('history');
  const [sessionsList, setSessionsList] = useState<ChatSessionItem[]>([]);
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('qa_sidebar_open', String(next));
      } catch {}
      return next;
    });
  }, []);

  const fetchSidebarData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setHistoryLoading(true);
      const [sessRes, docRes] = await Promise.all([
        apiService.getChatSessions({ limit: 100 }),
        apiService.getDocuments({ limit: 50 }),
      ]);
      setSessionsList(sessRes.sessions);
      setDocumentsList(docRes.documents);
    } catch (err) {
      console.error('Error fetching sidebar history/documents:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSidebarData();
  }, [fetchSidebarData]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiService.deleteChatSession(sessionId);
      setSessionsList((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    } catch (err) {
      console.error('Failed to delete chat session:', err);
    }
  }, [activeSessionId]);

  return (
    <SidebarContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        sessionsList,
        setSessionsList,
        documentsList,
        setDocumentsList,
        historyLoading,
        historySearch,
        setHistorySearch,
        sidebarTab,
        setSidebarTab,
        activeSessionId,
        setActiveSessionId,
        fetchSidebarData,
        deleteSession,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
