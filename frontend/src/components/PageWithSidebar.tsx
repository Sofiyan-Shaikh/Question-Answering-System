import React from 'react';
import Sidebar from './Sidebar';
import { useSidebar } from '../context/SidebarContext';

interface PageWithSidebarProps {
  children: React.ReactNode;
}

const PageWithSidebar: React.FC<PageWithSidebarProps> = ({ children }) => {
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  return (
    <div className="flex-1 flex h-full w-full overflow-hidden min-h-0 relative bg-[#070A0F] text-slate-100">
      {/* Unified Sidebar */}
      <Sidebar />

      {/* Main Page Scroll Canvas */}
      <div className="flex-1 h-full overflow-y-auto relative min-w-0 flex flex-col">
        {/* Floating Sidebar Toggle Button when sidebar is collapsed */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="fixed bottom-6 left-6 z-40 p-2.5 bg-[#141C2E] hover:bg-[#1E293B] border border-white/10 hover:border-emerald-500/40 rounded-xl text-slate-300 hover:text-white shadow-2xl transition-all flex items-center gap-2 text-xs font-semibold group"
            title="Open Sidebar"
          >
            <svg className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span>Open Sidebar</span>
          </button>
        )}

        <div className="flex-1 w-full">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageWithSidebar;
