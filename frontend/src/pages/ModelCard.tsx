import React, { useState } from 'react';

const KeyValueRow: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-3 border-b border-white/5 last:border-0 text-xs">
    <span className="font-mono text-slate-400 font-semibold">{k}</span>
    <span className="sm:col-span-2 text-slate-200 font-sans">{v}</span>
  </div>
);

const ModelCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'training' | 'ethics'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);

  const pythonSnippet = `from transformers import BertTokenizerFast, BertForQuestionAnswering
import torch

tokenizer = BertTokenizerFast.from_pretrained('bert-base-uncased')
model = BertForQuestionAnswering.from_pretrained('./qa_model.pkl')

inputs = tokenizer(
    "Who founded Apple?",
    "Apple Inc. was founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne.",
    return_tensors="pt"
)
outputs = model(**inputs)
start_scores, end_scores = outputs.start_logits, outputs.end_logits
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="ambient-glow-emerald w-96 h-96 top-10 left-1/3 -z-10 opacity-30"></div>
      <div className="ambient-glow-blue w-96 h-96 bottom-10 right-1/4 -z-10 opacity-20"></div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Card */}
        <div className="glass-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge-emerald font-mono text-[10px]">MODEL CARD SPECIFICATION</span>
                <span className="text-xs font-mono text-slate-500">HuggingFace / PyTorch</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                BERT SQuAD 2.0 Extractive QA
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                bert-base-uncased · 110M Parameters · PyTorch 2.0+ · SQuAD 2.0 Finetuned
              </p>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white text-2xl font-extrabold shadow-xl shadow-emerald-950/60 flex-shrink-0">
              Q
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-8 border-b border-white/10 pb-2 overflow-x-auto text-xs">
            {[
              { id: 'overview', label: '1. Model Overview' },
              { id: 'architecture', label: '2. Neural Architecture' },
              { id: 'training', label: '3. Training & SQuAD 2.0' },
              { id: 'ethics', label: '4. Limitations & Ethics' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 fade-in">
            <div className="glass-card p-6 sm:p-8 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Core Technical Metadata
              </h2>
              <div className="divide-y divide-white/5">
                <KeyValueRow k="Model Class" v="Transformer-based Extractive Question Answering" />
                <KeyValueRow k="Base Checkpoint" v="bert-base-uncased (12 layers, 768 hidden, 12 heads, 110M parameters)" />
                <KeyValueRow k="Head Architecture" v="BertForQuestionAnswering (Linear classification heads with W ∈ ℝ¹ˣ⁷⁶⁸)" />
                <KeyValueRow k="Language" v="English (Lowercased / Uncased vocabulary)" />
                <KeyValueRow k="Input Context Window" v="512 maximum tokens with 128 doc_stride sliding window chunking" />
                <KeyValueRow k="Null Threshold (τ)" v="-2.35 (Calibrated on SQuAD 2.0 official dev split to maximize macro F1)" />
                <KeyValueRow k="Framework" v="PyTorch + Hugging Face Transformers ≥ 4.30" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <span>✓</span>
                  <span>Intended Use Cases</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Enterprise internal search across policy documents and manuals.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Customer support FAQ grounding without conversational hallucination.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Audit and financial reports verification with multi-page PDF citation.</span>
                  </li>
                </ul>
              </div>

              <div className="glass-card p-6 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                  <span>⚠</span>
                  <span>Out of Scope & Abstention</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>Generative multi-turn open-domain chatter or story synthesis.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>Contexts not written in English or containing complex math symbols.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>Queries where user intent requires external world knowledge beyond provided text.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Architecture */}
        {activeTab === 'architecture' && (
          <div className="space-y-6 fade-in">
            <div className="glass-card p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-base font-bold text-white">Neural Tensor Pipeline</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Flow diagram illustrating tensor shapes from input tokens to start/end logits and span extraction.
                </p>
              </div>

              {/* Tensor Architecture Flow */}
              <div className="bg-[#070A0F] border border-white/10 rounded-2xl p-6 font-mono text-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#0F1523] rounded-xl border border-white/5">
                  <span className="text-slate-400">1. Input Encoding:</span>
                  <span className="text-emerald-400 font-bold">[CLS] Question [SEP] Context Chunk [SEP]</span>
                  <span className="text-slate-500 text-[10px]">Shape: [Batch, 512]</span>
                </div>

                <div className="text-center text-slate-600 text-base font-bold">↓</div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#0F1523] rounded-xl border border-white/5">
                  <span className="text-slate-400">2. BERT Backbone:</span>
                  <span className="text-cyan-400 font-bold">12 Self-Attention Layers (768 Hidden Dim)</span>
                  <span className="text-slate-500 text-[10px]">Shape: [Batch, 512, 768]</span>
                </div>

                <div className="text-center text-slate-600 text-base font-bold">↓</div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#0F1523] rounded-xl border border-white/5">
                  <span className="text-slate-400">3. Classification Heads:</span>
                  <span className="text-purple-400 font-bold">Linear Start / End Logits (W_start, W_end)</span>
                  <span className="text-slate-500 text-[10px]">Shape: [Batch, 512, 2]</span>
                </div>

                <div className="text-center text-slate-600 text-base font-bold">↓</div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#0F1523] rounded-xl border border-white/5">
                  <span className="text-slate-400">4. Top-K NMS & Null Threshold:</span>
                  <span className="text-amber-400 font-bold">Score = (s_start + s_end) - 2 * score([CLS])</span>
                  <span className="text-slate-500 text-[10px]">Abstain if Score &lt; -2.35</span>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">Python Quickstart Snippet:</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-mono"
                  >
                    {copiedCode ? '✓ Copied' : 'Copy Code'}
                  </button>
                </div>
                <pre className="bg-[#070A0F] border border-white/10 rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                  {pythonSnippet}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Training & SQuAD 2.0 */}
        {activeTab === 'training' && (
          <div className="space-y-6 fade-in">
            <div className="glass-card p-6 sm:p-8 space-y-4">
              <h2 className="text-base font-bold text-white border-b border-white/10 pb-3">
                Training Hyperparameters & Fine-Tuning Recipe
              </h2>
              <div className="divide-y divide-white/5">
                <KeyValueRow k="Optimizer" v="AdamW (β1 = 0.9, β2 = 0.999, ε = 1e-8, weight decay = 0.01)" />
                <KeyValueRow k="Peak Learning Rate" v="3e-5 with Linear Warmup (10% of total training steps)" />
                <KeyValueRow k="Batch Size" v="32 (Effective batch size via gradient accumulation)" />
                <KeyValueRow k="Epochs" v="3 full epochs over SQuAD 2.0 training dataset (130,319 examples)" />
                <KeyValueRow k="Loss Function" v="Cross-Entropy over start and end logits: L = (L_start + L_end) / 2" />
                <KeyValueRow k="Hardware" v="Fine-tuned on NVIDIA A100-SXM4-80GB GPU" />
              </div>
            </div>

            <div className="glass-card p-6 space-y-3">
              <h3 className="text-sm font-bold text-white">Why SQuAD 2.0 Matters</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Stanford Question Answering Dataset (SQuAD 2.0) combines 100,000 questions from SQuAD 1.1 with over 50,000 adversarial unanswerable questions written by crowdworkers. The questions look superficially plausible but cannot be answered based on the paragraph. Systems must predict when a question is unanswerable by mapping the answer to the [CLS] index.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Ethics & Bias */}
        {activeTab === 'ethics' && (
          <div className="space-y-6 fade-in">
            <div className="glass-card p-6 sm:p-8 space-y-4">
              <h2 className="text-base font-bold text-white border-b border-white/10 pb-3">
                Ethical Considerations, Data Biases, & Limitations
              </h2>
              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div>
                  <h4 className="font-bold text-white mb-1">Source Text Dependency</h4>
                  <p>
                    Because this model is purely extractive, any incorrect facts, historical biases, or offensive statements contained in the user-provided context will be verbatim extracted if they correlate with the question query.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-white mb-1">Wikipedia Data Bias</h4>
                  <p>
                    The SQuAD 2.0 dataset is derived exclusively from English Wikipedia articles. Consequently, formal journalistic and encyclopedic prose is well represented, whereas slang, medical jargon, and legalese may show slightly degraded accuracy.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-white mb-1">Human-in-the-Loop Recommendation</h4>
                  <p>
                    For mission-critical tasks (financial audits, medical questions, legal compliance), model outputs should be presented alongside the original highlighted source document for human verification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelCard;
