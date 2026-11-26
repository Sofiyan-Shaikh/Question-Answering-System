import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0B0F17] text-slate-100 px-4 py-16">
      <div className="max-w-xl w-full text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white text-2xl font-extrabold shadow-xl shadow-emerald-950/60">
          Q
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
          Question Answering System
        </h1>

        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
          Paste any passage or upload a PDF document to extract exact answers with confidence scores and page citations.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/login"
            className="btn-primary px-8 py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <span>Sign In to Workspace</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
