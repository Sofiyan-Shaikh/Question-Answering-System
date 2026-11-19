import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Workspace from './pages/Workspace';
import Analytics from './pages/Analytics';
import ModelCard from './pages/ModelCard';
import About from './pages/About';
import History from './pages/History';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isAppPage = location.pathname !== '/' && location.pathname !== '/login';

  return (
    <div className={`flex flex-col bg-[#0B0F17] text-slate-100 antialiased ${isAppPage ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <Navbar />
      <main className="flex-1 flex flex-col overflow-hidden min-h-0 w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <Workspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/model-card"
            element={
              <ProtectedRoute>
                <ModelCard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/about"
            element={
              <ProtectedRoute>
                <About />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAppPage && (
        <footer className="bg-[#070A0F] border-t border-white/5 py-3 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full">
          <span>BERT SQuAD 2.0 Extractive QA</span>
          <span className="text-[11px] text-slate-400 mt-1 sm:mt-0">FastAPI · PyTorch · React</span>
        </footer>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <SidebarProvider>
          <AppContent />
        </SidebarProvider>
      </Router>
    </AuthProvider>
  );
};

export default App;

