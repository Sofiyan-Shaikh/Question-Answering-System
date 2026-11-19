import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useSidebar } from '../context/SidebarContext';

const AppLayout: React.FC = () => {
  const location = useLocation();
  const isWorkspace = location.pathname === '/workspace';
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F17] text-slate-100 antialiased overflow-hidden">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Body: Sidebar + Page Canvas */}
      <div className="flex-1 flex h-full w-full overflow-hidden min-h-0 relative">
        {/* Unified Shared Sidebar */}
        <Sidebar />

        {/* Page Content Canvas */}
        <div className={`flex-1 h-full flex flex-col min-w-0 relative ${isWorkspace ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {/* Floating Expand Sidebar Button when collapsed on non-workspace pages */}
          {!isWorkspace && !sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="fixed bottom-6 left-6 z-30 p-2.5 bg-[#141C2E] hover:bg-[#1E293B] border border-white/10 hover:border-emerald-500/40 rounded-xl text-slate-300 hover:text-white shadow-xl transition-all flex items-center gap-2 text-xs font-medium"
              title="Open Sidebar"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>Sidebar</span>
            </button>
          )}

          <Outlet />

          {/* Footer on info pages */}
          {!isWorkspace && (
            <footer className="mt-auto bg-[#070A0F] border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between w-full">
              <span>BERT SQuAD 2.0 Extractive QA</span>
              <span className="text-[11px] text-slate-400 mt-1 sm:mt-0">FastAPI · PyTorch · React</span>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
