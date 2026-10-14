import React, { useState } from 'react';
import { apiService } from '../services/api';
import { AnswerSpan, QAResponse } from '../types';

const EXAMPLE_CONTEXT =
  'SQuAD 2.0 combines the 100,000 questions in SQuAD 1.1 with over 50,000 unanswerable questions written adversarially by crowdworkers to look like answerable ones. To do well on SQuAD 2.0, systems must not only answer questions when possible, but also determine when no answer is supported by the paragraph and abstain from answering.';

const EXAMPLE_QUESTION = 'How many unanswerable questions are in SQuAD 2.0?';

const MULTI_EXAMPLE_CONTEXT =
  'Apple Inc. was founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne to develop and sell Wozniaks Apple I personal computer. The company was incorporated in January 1977 in Cupertino, California.';

const MULTI_EXAMPLE_QUESTION = 'Who were the founders of Apple?';

const TABLE_EXAMPLE_CONTEXT =
  'Product, Category, Price, Stock\nMacBook Air, Laptop, $999, 45\niPhone 15 Pro, Smartphone, $1199, 120\nApple Watch Ultra, Wearable, $799, 30';

const TABLE_EXAMPLE_QUESTION = 'What is the price of iPhone 15 Pro?';

const COMPOUND_EXAMPLE_CONTEXT =
  'Amazon was founded by Jeff Bezos in Bellevue, Washington, on July 5, 1994. The company started as an online marketplace for books.';

const COMPOUND_EXAMPLE_QUESTION = 'Who founded Amazon and in what year?';

/* ── Highlighted passage renderer ─────────────────────────────────────── */
const HighlightedPassage: React.FC<{
  context: string;
  startChar: number;
  endChar: number;
  answers?: AnswerSpan[];
}> = ({ context, startChar, endChar, answers }) => {
  // If multiple answer spans are provided, highlight all non-overlapping spans
  if (answers && answers.length > 0) {
    const validSpans = answers
      .filter((a) => a.start_char >= 0 && a.end_char > a.start_char)
      .sort((a, b) => a.start_char - b.start_char);

    if (validSpans.length > 0) {
      const elements: React.ReactNode[] = [];
      let lastIndex = 0;
      validSpans.forEach((span, idx) => {
        if (span.start_char >= lastIndex && span.end_char <= context.length) {
          if (span.start_char > lastIndex) {
            elements.push(context.slice(lastIndex, span.start_char));
          }
          elements.push(
            <mark
              key={idx}
              className="bg-emerald-200 text-emerald-950 font-semibold px-1 py-0.5 rounded shadow-sm inline-block my-0.5"
              title={`Confidence: ${(span.confidence_score * 100).toFixed(1)}%`}
            >
              {context.slice(span.start_char, span.end_char)}
              {answers.length > 1 && (
                <span className="ml-1 text-[10px] bg-emerald-700 text-white rounded-full px-1.5 py-0.2 font-mono">
                  #{idx + 1}
                </span>
              )}
            </mark>
          );
          lastIndex = span.end_char;
        }
      });
      if (lastIndex < context.length) {
        elements.push(context.slice(lastIndex));
      }
      return <>{elements}</>;
    }
  }

  if (startChar < 0 || endChar < 0 || startChar >= endChar) {
    return <span>{context}</span>;
  }
  const before = context.slice(0, startChar);
  const answer = context.slice(startChar, endChar);
  const after = context.slice(endChar);
  return (
    <>
      {before}
      <mark
        className="bg-green-200 text-green-900 font-semibold px-0.5 rounded"
        aria-label={`Highlighted answer: ${answer}`}
      >
        {answer}
      </mark>
      {after}
    </>
  );
};

/* ── Confidence bar ────────────────────────────────────────────────────── */
const ConfidenceBar: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 font-medium">Confidence</span>
        <span className="font-semibold text-gray-900">{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-3 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/* ── Meta chip ─────────────────────────────────────────────────────────── */
const MetaChip: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{value}</p>
  </div>
);

/* ── Empty / Loading states ────────────────────────────────────────────── */
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    <svg
      className="w-14 h-14 mb-4 opacity-40"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
    <p className="text-base font-medium">Submit a question to see results</p>
    <p className="text-sm mt-1">Results, highlighting and metadata will appear here</p>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
    <div
      className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"
      role="status"
      aria-label="Loading"
    />
    <p className="text-base font-medium">Extracting answer…</p>
    <p className="text-sm mt-1">Running BERT inference</p>
  </div>
);

/* ── Main Workspace ────────────────────────────────────────────────────── */
const Workspace: React.FC = () => {
  const [context, setContext] = useState('');
  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState<number>(3);
  const [result, setResult] = useState<QAResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await apiService.predictAnswer({ context, question, top_k: topK });
      setResult(res);
    } catch (err: any) {
      if (err.response?.status === 503) {
        setError('Model is not loaded yet. Please try again in a moment.');
      } else {
        setError(err.response?.data?.detail || 'Prediction failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setContext('');
    setQuestion('');
    setResult(null);
    setError('');
  };

  const loadExample = (type: 'single' | 'multi' | 'compound' | 'table') => {
    if (type === 'multi') {
      setContext(MULTI_EXAMPLE_CONTEXT);
      setQuestion(MULTI_EXAMPLE_QUESTION);
      setTopK(3);
    } else if (type === 'compound') {
      setContext(COMPOUND_EXAMPLE_CONTEXT);
      setQuestion(COMPOUND_EXAMPLE_QUESTION);
      setTopK(2);
    } else if (type === 'table') {
      setContext(TABLE_EXAMPLE_CONTEXT);
      setQuestion(TABLE_EXAMPLE_QUESTION);
      setTopK(1);
    } else {
      setContext(EXAMPLE_CONTEXT);
      setQuestion(EXAMPLE_QUESTION);
      setTopK(1);
    }
    setResult(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">QA Workspace</h1>
            <p className="text-gray-500 mt-1">
              Extract single or multiple answer spans and query passages or tabular CSV data
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-gray-500 mr-1">Load Presets:</span>
            <button
              type="button"
              onClick={() => loadExample('single')}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              Single QA
            </button>
            <button
              type="button"
              onClick={() => loadExample('multi')}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              Multi-Answer
            </button>
            <button
              type="button"
              onClick={() => loadExample('compound')}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              Compound QA
            </button>
            <button
              type="button"
              onClick={() => loadExample('table')}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              Tabular CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Left: Input form ─────────────────────────────────────── */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">1</span>
              Input
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Context */}
              <div>
                <label
                  htmlFor="context"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Context Passage (Text or CSV Table) <span className="text-red-500" aria-hidden>*</span>
                </label>
                <textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="textarea-field font-mono text-sm"
                  rows={9}
                  placeholder="Paste text passage or CSV table here…"
                  required
                  maxLength={10000}
                  aria-required="true"
                  aria-describedby="context-hint"
                />
                <p id="context-hint" className="mt-1 text-xs text-gray-400 text-right">
                  {context.length} / 10,000 chars
                </p>
              </div>

              {/* Question */}
              <div>
                <label
                  htmlFor="question"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Question <span className="text-red-500" aria-hidden>*</span>
                </label>
                <input
                  id="question"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="input-field"
                  placeholder="What do you want to know?"
                  required
                  maxLength={500}
                  aria-required="true"
                />
              </div>

              {/* Top-K Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Max Answers to Extract
                  </label>
                  <span className="text-xs text-gray-500">Supports multi-span lists</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 5].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTopK(k)}
                      className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${
                        topK === k
                          ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {k === 1 ? '1 (Single)' : `${k} answers`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
                >
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading || !context.trim() || !question.trim()}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                      Processing…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Get Answer
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn-secondary"
                  aria-label="Clear all inputs"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* ── Right: Results ───────────────────────────────────────── */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">2</span>
              Result
            </h2>

            {!result && !loading && <EmptyState />}
            {loading && <LoadingState />}

            {result && (
              <div className="space-y-6 fade-in">
                {/* Answer + badge */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {result.answers && result.answers.length > 1 ? 'Extracted Answers' : 'Extracted Answer'}
                    </span>
                    {result.is_answerable ? (
                      <span className="badge-success flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        Answerable
                      </span>
                    ) : (
                      <span className="badge-warning flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Unanswerable
                      </span>
                    )}
                  </div>

                  <div className={`p-4 rounded-lg border ${result.is_answerable ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    {result.is_answerable ? (
                      <div>
                        <p className="text-xl font-bold text-green-900">{result.answer}</p>
                        {result.answers && result.answers.length > 1 && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-2">
                              Individual Discovered Spans ({result.answers.length}):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {result.answers.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 bg-white border border-green-300 text-green-900 px-2.5 py-1 rounded-md text-xs font-semibold shadow-xs"
                                >
                                  <span className="w-4 h-4 bg-green-700 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                                    {idx + 1}
                                  </span>
                                  <span>{item.answer}</span>
                                  <span className="text-[10px] text-green-600 bg-green-50 px-1 py-0.5 rounded">
                                    {(item.confidence_score * 100).toFixed(0)}%
                                  </span>
                                  {item.sub_question && (
                                    <span className="text-[10px] text-gray-500 font-normal italic ml-1">
                                      ({item.sub_question})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic text-sm">
                        No answer was found in the provided context. Try rephrasing or providing more relevant context.
                      </p>
                    )}
                  </div>
                </div>

                {/* Confidence */}
                <ConfidenceBar score={result.confidence_score} />

                {/* Highlighted passage */}
                {result.is_answerable && context && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Highlighted Context</p>
                    <div
                      className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap"
                      aria-label="Passage with highlighted answer"
                    >
                      <HighlightedPassage
                        context={context}
                        startChar={result.start_char}
                        endChar={result.end_char}
                        answers={result.answers}
                      />
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <MetaChip label="Model Version" value={result.model_version} />
                  <MetaChip label="Execution Time" value={`${result.execution_time_ms.toFixed(1)} ms`} />
                  {result.is_answerable && (
                    <>
                      <MetaChip label="Start Char" value={result.start_char} />
                      <MetaChip label="End Char" value={result.end_char} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-10 card bg-blue-50 border-blue-200">
          <h3 className="text-base font-semibold text-blue-900 mb-3">How It Works</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Your context and question are tokenised with <code className="bg-blue-100 px-1 rounded">BertTokenizerFast</code> across sliding window chunks.</li>
            <li>Tabular CSV or Markdown data is automatically linearized into natural language structures.</li>
            <li>The model generates start/end logits; Top-K Non-Maximum Suppression extracts distinct non-overlapping answer spans.</li>
            <li>If answers beat threshold τ, all detected spans are highlighted and returned with individual confidence scores.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
