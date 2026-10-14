import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    bg: 'bg-blue-100',
    title: 'Fast & Accurate',
    desc: 'Extracts precise answers in <200 ms with 75%+ F1 on SQuAD 2.0 official dev split.',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: 'bg-green-100',
    title: 'Unanswerable Detection',
    desc: 'Calibrated null-threshold (τ) explicitly flags when a question cannot be answered from context.',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    bg: 'bg-purple-100',
    title: 'Dynamic Highlighting',
    desc: 'Character-level span highlighting marks the exact answer in the passage using offset mapping.',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    bg: 'bg-amber-100',
    title: 'Analytics Dashboard',
    desc: 'EM/F1 breakdown by question type (Who, What, When, Where, Why, How) with confidence charts.',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    bg: 'bg-red-100',
    title: 'JWT Authentication',
    desc: 'Secure REST API with JWT bearer tokens. Only authorized users can query inference endpoints.',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    bg: 'bg-teal-100',
    title: 'BERT Fine-Tuned',
    desc: 'bert-base-uncased fine-tuned on SQuAD 2.0 with AdamW optimizer and sliding window chunking.',
  },
];

const stack = [
  { emoji: '🤖', name: 'BERT', sub: 'Transformer Model' },
  { emoji: '⚡', name: 'FastAPI', sub: 'REST Backend' },
  { emoji: '⚛️', name: 'React', sub: 'Frontend UI' },
  { emoji: '🔥', name: 'PyTorch', sub: 'Deep Learning' },
  { emoji: '🎨', name: 'Tailwind', sub: 'CSS Framework' },
  { emoji: '🐳', name: 'Docker', sub: 'Containerization' },
];

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-blue-50 to-indigo-100">
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-extrabold text-4xl">Q</span>
          </div>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Question Answering <br />
          <span className="text-primary-600">System</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
          BERT-based Extractive QA fine-tuned on SQuAD 2.0 — extracts precise answer spans
          from context passages and detects unanswerable queries with confidence scoring.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isAuthenticated ? (
            <>
              <Link
                to="/workspace"
                className="btn-primary text-lg px-8 py-3 inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Open Workspace
              </Link>
              <Link to="/analytics" className="btn-secondary text-lg px-8 py-3">
                View Analytics
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="btn-primary text-lg px-8 py-3 inline-flex items-center justify-center gap-2"
            >
              Get Started
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>

        {/* Stats bar */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { value: '~72.4%', label: 'Exact Match' },
            { value: '~75.8%', label: 'F1 Score' },
            { value: '100K+', label: 'SQuAD Questions' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow">
              <p className="text-3xl font-bold text-primary-600">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="bg-white py-20 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div
                key={f.title}
                className="card hover:shadow-lg transition-shadow duration-300 flex flex-col gap-3"
              >
                <div className={`w-12 h-12 ${f.bg} rounded-lg flex items-center justify-center`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="py-20 bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Technology Stack</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
            {stack.map((s) => (
              <div key={s.name} className="text-center">
                <div className="text-4xl mb-2">{s.emoji}</div>
                <p className="font-semibold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lifecycle */}
      <div className="py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Core Lifecycle</h2>
          <div className="flex flex-wrap justify-center items-center gap-2 text-sm font-medium">
            {[
              'Data Cleaning',
              'EDA',
              'Tokenization / Offsets',
              'Training',
              'Validation',
              'Threshold Calibration',
              'Evaluation',
              'Deployment',
            ].map((step, i, arr) => (
              <React.Fragment key={step}>
                <span className="bg-primary-100 text-primary-800 px-4 py-2 rounded-full">{step}</span>
                {i < arr.length - 1 && (
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
