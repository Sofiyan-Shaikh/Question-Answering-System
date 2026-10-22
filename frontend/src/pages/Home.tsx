import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    badge: '< 180 ms',
    title: 'High-Throughput Extractive QA',
    desc: 'Extracts exact verbatim answer spans in <180 ms with 75.8% F1 on SQuAD 2.0 official evaluation split.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    badge: 'τ = -2.35',
    title: 'Adversarial Abstention',
    desc: 'Calibrated null-threshold prevents hallucination, explicitly determining when no supported answer exists in context.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    badge: 'Top-K NMS',
    title: 'Multi-Span Non-Maximum Suppression',
    desc: 'Discovers and isolates multiple distinct answers in complex passages without overlapping duplicate text.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    badge: 'BM25 Index',
    title: 'Multi-Page PDF Processing',
    desc: 'Direct PDF parsing and two-stage retrieval indexes document pages to deliver citations and page coordinates.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    badge: 'JWT Bearer',
    title: 'Enterprise REST Security',
    desc: 'FastAPI microservice secured with JWT OAuth2 bearer tokens, rate-limiting, and Pydantic validation schemas.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    badge: 'Sliding Window',
    title: 'Token-Stride Chunking',
    desc: 'Fast tokenizers slice lengthy documents into 512-token chunks with 128 stride, preserving full passage context.',
  },
];

const stack = [
  { emoji: '🤖', name: 'BERT Base', sub: 'Transformers' },
  { emoji: '⚡', name: 'FastAPI', sub: 'Async REST' },
  { emoji: '⚛️', name: 'React 18', sub: 'TypeScript' },
  { emoji: '🔥', name: 'PyTorch', sub: 'Deep Learning' },
  { emoji: '🎨', name: 'TailwindCSS', sub: 'Glassmorphism' },
  { emoji: '📊', name: 'Recharts', sub: 'Telemetry' },
];

const Home: React.FC = () => {
  const [demoSelection, setDemoSelection] = useState<number>(0);

  const demoExamples = [
    {
      q: 'Who founded Apple and in what year?',
      context: 'Apple Inc. was founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne in Cupertino, California.',
      answer: 'Steve Jobs, Steve Wozniak, and Ronald Wayne',
      confidence: 94.2,
      latency: 142,
      type: 'Multi-Span',
    },
    {
      q: 'What was the fiscal revenue in 2024?',
      context: 'Annual report: The company achieved total revenue of $4.8 billion in fiscal year 2024 with a 14% year-over-year increase.',
      answer: '$4.8 billion',
      confidence: 98.1,
      latency: 135,
      type: 'Financial Span',
    },
    {
      q: 'What caused the recent earthquake?',
      context: 'The software architecture features microservices containerized with Docker and orchestrated using Kubernetes.',
      answer: 'Abstained (Unanswerable query)',
      confidence: 0,
      latency: 110,
      type: 'SQuAD Abstention',
    },
  ];

  const activeDemo = demoExamples[demoSelection];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="ambient-glow-emerald w-[500px] h-[500px] -top-20 left-1/3 -z-10 opacity-30"></div>
      <div className="ambient-glow-blue w-[600px] h-[600px] top-96 -right-20 -z-10 opacity-25"></div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center relative z-10">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141C2E] border border-emerald-500/30 mb-8 shadow-lg shadow-emerald-950/40">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono font-semibold text-emerald-300">
            BERT-Base · SQuAD 2.0 · PyTorch · 75.8% F1
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
          Precision Question Answering <br />
          <span className="text-gradient-emerald">Without Hallucination</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          Production-grade Extractive QA trained on SQuAD 2.0. Isolates verbatim answer spans from passages, tabular CSVs, and multi-page PDFs with calibrated null-threshold abstention.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link
            to="/workspace"
            className="btn-primary text-base px-8 py-3.5 rounded-xl shadow-xl shadow-emerald-950/70 flex items-center gap-2.5 w-full sm:w-auto"
          >
            <span>Launch QA Workspace</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

          <Link
            to="/analytics"
            className="btn-secondary text-base px-7 py-3.5 rounded-xl w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <span>View Performance Analytics</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-20">
          {[
            { value: '72.4%', label: 'Exact Match (EM)', sub: 'SQuAD 2.0 Dev' },
            { value: '75.8%', label: 'F1 Score', sub: 'Macro Average' },
            { value: '< 180 ms', label: 'Inference Latency', sub: 'PyTorch CPU' },
            { value: '150,000+', label: 'Training Examples', sub: 'SQuAD 2.0 Corpus' },
          ].map((s, idx) => (
            <div
              key={idx}
              className="bg-[#141C2E]/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md text-left shadow-lg"
            >
              <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono text-emerald-400">
                {s.value}
              </p>
              <p className="text-xs font-semibold text-slate-200 mt-1">{s.label}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Interactive Live Preview Playground ── */}
        <div className="max-w-4xl mx-auto text-left">
          <div className="glass-card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="badge-emerald font-mono text-[10px]">LIVE DEMO PREVIEW</span>
                <h3 className="text-lg font-bold text-white mt-1">Interactive Extractive QA Test</h3>
              </div>
              <div className="flex gap-2">
                {demoExamples.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDemoSelection(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      demoSelection === idx
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-[#0B0F17] text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    Demo #{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Context snippet */}
            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Source Passage:
              </p>
              <div className="bg-[#0B0F17] border border-white/10 rounded-xl p-3.5 text-xs text-slate-300 font-sans leading-relaxed">
                {activeDemo.context}
              </div>
            </div>

            {/* Question & Answer Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0B0F17]/70 border border-white/10 rounded-xl p-4 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Input Query:</span>
                <p className="text-sm font-semibold text-white">{activeDemo.q}</p>
              </div>

              <div className="bg-[#0B0F17]/70 border border-emerald-500/30 rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                    Extracted Answer:
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">⚡ {activeDemo.latency} ms</span>
                </div>
                <p className="text-base font-bold text-white">{activeDemo.answer}</p>
                {activeDemo.confidence > 0 ? (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${activeDemo.confidence}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-300 font-bold">
                      {activeDemo.confidence}% confidence
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] font-mono text-amber-400">
                    🛡️ Calibrated Null-Threshold Abstention
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Link
                to="/workspace"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5"
              >
                <span>Try asking your own documents in Workspace</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature Cards Section ── */}
      <section className="py-20 border-t border-white/10 bg-[#070A0F]/90 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge-emerald font-mono mb-3">ENGINEERING ARCHITECTURE</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built for Grounded Intelligence
            </h2>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              Every design decision prioritizes verbatim fidelity to source texts, fast latency, and strict abstention when unanswerable questions are encountered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, idx) => (
              <div
                key={idx}
                className="glass-card p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[#0B0F17] border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                      {f.icon}
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                      {f.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technology Stack ── */}
      <section className="py-16 border-t border-white/10 bg-[#0B0F17]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-8">
            Engineered with Modern Deep Learning & Cloud Stack
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 max-w-4xl mx-auto">
            {stack.map((item) => (
              <div
                key={item.name}
                className="bg-[#141C2E]/60 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-white/20 transition-all"
              >
                <span className="text-3xl mb-2">{item.emoji}</span>
                <p className="text-xs font-bold text-white">{item.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
