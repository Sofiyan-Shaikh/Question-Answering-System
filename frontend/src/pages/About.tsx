import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const About: React.FC = () => {
  const [copiedCurl, setCopiedCurl] = useState(false);

  const sampleCurl = `curl -X POST http://localhost:8000/api/v1/qa/predict \\
  -H "Content-Type: application/json" \\
  -d '{
    "context": "Apple Inc. was founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne in California.",
    "question": "Who founded Apple?",
    "top_k": 3
  }'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="ambient-glow-emerald w-96 h-96 top-10 left-1/4 -z-10 opacity-40"></div>
      <div className="ambient-glow-blue w-96 h-96 bottom-10 right-1/4 -z-10 opacity-30"></div>

      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header Breadcrumb / Title */}
        <div className="border-b border-white/10 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="badge-emerald font-mono">System Specifications & Architecture</span>
              <span className="text-xs text-slate-500 font-mono">v1.2.0</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              BERT SQuAD 2.0 Extractive Engine
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              End-to-end question answering pipeline combining <code className="text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded">bert-base-uncased</code>, sliding-window chunking, non-maximum suppression (NMS), and BM25 PDF document indexing.
            </p>
          </div>

          <Link
            to="/workspace"
            className="btn-primary self-start md:self-auto flex items-center gap-2"
          >
            <span>Open QA Workspace</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        {/* 1. Architecture Flow Pipeline */}
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              Extractive Question Answering Pipeline
            </h2>
            <span className="text-xs font-mono text-slate-400">Two-Stage Processing</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div className="bg-[#0F1523] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded">
                  STAGE 1
                </span>
                <h3 className="text-sm font-bold text-slate-200 mt-2">Input Preprocessing</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Raw passage text or PDF documents. PDF pages are parsed via PyMuPDF/pdfplumber and indexed with BM25 keyword retrieval.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-white/5 text-[11px] font-mono text-slate-500">
                BM25 Top-1 Passage
              </div>
            </div>

            <div className="bg-[#0F1523] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded">
                  STAGE 2
                </span>
                <h3 className="text-sm font-bold text-slate-200 mt-2">Sliding Window Tokenizer</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  <code className="text-cyan-300">BertTokenizerFast</code> with max length 512 and stride 128. Exact char offset mappings preserve document locations.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-white/5 text-[11px] font-mono text-slate-500">
                stride=128 · offset_mapping
              </div>
            </div>

            <div className="bg-[#0F1523] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded">
                  STAGE 3
                </span>
                <h3 className="text-sm font-bold text-slate-200 mt-2">BERT Neural Inference</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  12-layer bidirectional transformer outputs start and end logits. Linear classifier heads compute span log-likelihoods.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-white/5 text-[11px] font-mono text-slate-500">
                W ∈ ℝ¹ˣ⁷⁶⁸ · PyTorch
              </div>
            </div>

            <div className="bg-[#0F1523] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded">
                  STAGE 4
                </span>
                <h3 className="text-sm font-bold text-slate-200 mt-2">Multi-Span NMS & Null Decision</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Top-K Non-Maximum Suppression discards overlapping spans. If best score &lt; τ (-2.35), system abstains (unanswerable).
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-white/5 text-[11px] font-mono text-slate-500">
                Null Threshold τ = -2.35
              </div>
            </div>
          </div>
        </div>

        {/* 2. Key Technical Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg font-bold">
              🛡️
            </div>
            <h3 className="text-base font-bold text-white">SQuAD 2.0 Abstention</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unlike legacy QA models that hallucinate or force answers, our model is calibrated against 50,000+ adversarial unanswerable questions to cleanly abstain when context lacks evidence.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg font-bold">
              📄
            </div>
            <h3 className="text-base font-bold text-white">Multi-Page PDF BM25</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload multi-page PDFs directly. The system extracts text page-by-page, ranks the most relevant page using BM25 token frequencies, and extracts exact answer spans with page citations.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg font-bold">
              🧩
            </div>
            <h3 className="text-base font-bold text-white">Top-K Multi-Span Extraction</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extract multiple distinct answers in a single query (e.g. list of co-founders or multiple prices) using beam search span ranking and non-maximum suppression.
            </p>
          </div>
        </div>

        {/* 3. REST API Quick Reference */}
        <div className="glass-card p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">REST API Integration</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Query the FastAPI inference server programmatically via HTTP JSON requests.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCurl}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {copiedCurl ? (
                <span className="text-emerald-400 font-bold">✓ Copied</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy cURL</span>
                </>
              )}
            </button>
          </div>

          <pre className="bg-[#070A0F] border border-white/10 rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
            {sampleCurl}
          </pre>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="bg-[#0F1523] border border-white/5 rounded-lg p-3">
              <span className="text-slate-400">Endpoint:</span>
              <p className="font-mono text-white font-semibold mt-0.5">POST /api/v1/qa/predict</p>
            </div>
            <div className="bg-[#0F1523] border border-white/5 rounded-lg p-3">
              <span className="text-slate-400">PDF Endpoint:</span>
              <p className="font-mono text-white font-semibold mt-0.5">POST /api/v1/qa/predict-pdf</p>
            </div>
            <div className="bg-[#0F1523] border border-white/5 rounded-lg p-3">
              <span className="text-slate-400">Avg Response Time:</span>
              <p className="font-mono text-emerald-400 font-semibold mt-0.5">&lt; 180 ms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
