import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="text-xl font-bold text-gray-900 pb-2 mb-4 border-b-2 border-primary-500">
      {title}
    </h2>
    {children}
  </section>
);

const KeyValue: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100 last:border-0 text-sm">
    <span className="font-medium text-gray-700">{k}</span>
    <span className="col-span-2 text-gray-600">{v}</span>
  </div>
);

const AlertBox: React.FC<{
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  items: string[];
}> = ({ type, title, items }) => {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    danger:  'bg-red-50  border-red-200  text-red-900',
    info:    'bg-blue-50 border-blue-200 text-blue-900',
  };
  const icons = {
    success: '✓',
    warning: '⚠',
    danger:  '✗',
    info:    'ℹ',
  };
  return (
    <div className={`rounded-lg border p-4 ${styles[type]}`}>
      <p className="font-semibold mb-2">{icons[type]} {title}</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
};

const ModelCard: React.FC = () => (
  <div className="min-h-screen bg-gray-50 py-8">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="card shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-1 rounded">
              Model Card
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900 mt-2">
              BERT SQuAD 2.0 Extractive QA
            </h1>
            <p className="text-gray-500 mt-1">bert-base-uncased · PyTorch · Hugging Face Transformers</p>
          </div>
          <div className="w-14 h-14 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-extrabold text-2xl">Q</span>
          </div>
        </div>

        {/* Model Details */}
        <Section title="Model Details">
          <div className="divide-y divide-gray-100">
            <KeyValue k="Model Type"    v="Transformer-based Extractive Question Answering" />
            <KeyValue k="Base Model"    v="bert-base-uncased (BERT Base, Uncased)" />
            <KeyValue k="Architecture" v="BertForQuestionAnswering — linear start/end classifier heads (W ∈ ℝ¹ˣ⁷⁶⁸)" />
            <KeyValue k="Language"     v="English" />
            <KeyValue k="Version"      v="bert-base-squad2-v1" />
            <KeyValue k="Framework"    v="PyTorch + Hugging Face Transformers ≥ 4.30" />
            <KeyValue k="Max Tokens"   v="512 (sliding window doc_stride=128 for long contexts)" />
          </div>
        </Section>

        {/* Intended Use */}
        <Section title="Intended Use">
          <p className="text-sm text-gray-700 mb-4">
            Isolate exact verbatim text spans from user-provided context passages to answer natural
            language questions in enterprise search and knowledge management tools. The model
            explicitly detects when a question cannot be answered from the passage.
          </p>
          <AlertBox
            type="success"
            title="Suitable For"
            items={[
              'Enterprise knowledge management & internal document search',
              'FAQ systems where answers must be grounded in source text',
              'Extractive information retrieval from reports and manuals',
              'Decision-support tools where human verification is downstream',
            ]}
          />
        </Section>

        {/* Out of Scope */}
        <Section title="Out of Scope">
          <AlertBox
            type="danger"
            title="Not Suitable For"
            items={[
              'Open-ended generative conversational chat or summarization',
              'Multi-document retrieval across unprovided sources',
              'Questions requiring external knowledge or multi-step reasoning',
              'Ungrounded factual generation or hallucination-prone tasks',
            ]}
          />
        </Section>

        {/* Evaluation */}
        <Section title="Evaluation Results — Official Dev Split">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Metric', 'Score', 'Dataset', 'Notes'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Exact Match (EM)', '~72.4%', 'SQuAD 2.0 Dev', 'Binary — exact string match after normalisation'],
                  ['F1 Score',         '~75.8%', 'SQuAD 2.0 Dev', 'Token-level harmonic mean of precision & recall'],
                  ['Null Threshold τ', '-2.35',  'SQuAD 2.0 Dev', 'Grid-searched on dev predictions to maximise F1'],
                ].map(([m, s, d, n]) => (
                  <tr key={m} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{m}</td>
                    <td className="px-4 py-3 font-bold text-primary-700">{s}</td>
                    <td className="px-4 py-3 text-gray-600">{d}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Training Data */}
        <Section title="Training Data">
          <div className="divide-y divide-gray-100 text-sm">
            <KeyValue k="Dataset"       v="SQuAD 2.0 (Stanford Question Answering Dataset 2.0)" />
            <KeyValue k="Size"          v="100,000+ answerable + 50,000+ adversarially crafted unanswerable questions" />
            <KeyValue k="Source"        v="Wikipedia articles (English)" />
            <KeyValue k="Unanswerable" v="~33% of questions per split are unanswerable" />
            <KeyValue k="Reference"    v="Rajpurkar et al., EMNLP 2016 & Rajpurkar et al., ACL 2018" />
          </div>
        </Section>

        {/* Training Protocol */}
        <Section title="Training Protocol & Hyperparameters">
          <div className="divide-y divide-gray-100 text-sm">
            <KeyValue k="Optimizer"     v="AdamW — lr=3×10⁻⁵, β₁=0.9, β₂=0.999, weight_decay=0.01" />
            <KeyValue k="Schedule"      v="Linear warmup over first 10% steps → linear decay" />
            <KeyValue k="Epochs"        v="2–3 epochs on SQuAD 2.0 training split" />
            <KeyValue k="Batch Size"    v="16 (or 8 with gradient accumulation ×2)" />
            <KeyValue k="Tokenizer"     v="BertTokenizerFast with return_offsets_mapping=True" />
            <KeyValue k="Unanswerable" v="Ground-truth targets set to s=0, e=0 ([CLS]) for unanswerable samples" />
            <KeyValue k="Hardware"      v="CUDA-enabled GPU recommended (NVIDIA T4/V100/A10G); CPU viable for inference" />
          </div>
        </Section>

        {/* Limitations */}
        <Section title="Limitations & Risks">
          <div className="space-y-4">
            <AlertBox
              type="warning"
              title="Technical Limitations"
              items={[
                'Context truncation for passages > 512 tokens (mitigated by sliding window)',
                'Potential miscalibration of threshold τ on out-of-domain text',
                'Domain shift between Wikipedia training data and enterprise documentation',
                'Span boundary errors near punctuation and subword tokenisation boundaries',
              ]}
            />
            <AlertBox
              type="danger"
              title="Operational Risks"
              items={[
                'User over-reliance on extractive spans without human verification',
                'Cannot synthesise information across multiple passages',
                'Does not perform external retrieval — answer must exist in provided context',
              ]}
            />
          </div>
        </Section>

        {/* Ethical Considerations */}
        <Section title="Ethical Considerations & Responsible Use">
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <span className="font-semibold text-gray-900">Human Verification Required: </span>
              Predictions must be shown alongside highlighted source spans so analysts can verify facts before acting.
            </p>
            <p>
              <span className="font-semibold text-gray-900">Explicit Uncertainty: </span>
              The model returns <code className="bg-gray-100 px-1 rounded">is_answerable=false</code> and a confidence score — never force an answer.
            </p>
            <p>
              <span className="font-semibold text-gray-900">Privacy: </span>
              Avoid submitting confidential PII-containing documents to demo environments. Strip sensitive content from logs (<code className="bg-gray-100 px-1 rounded">logging_hygiene</code> enforced in backend).
            </p>
            <p>
              <span className="font-semibold text-gray-900">Access Control: </span>
              JWT-secured endpoints prevent unauthorised inference. Rotate secrets in production.
            </p>
          </div>
        </Section>

        {/* Usage Guidelines */}
        <Section title="Usage Guidelines">
          <AlertBox
            type="info"
            title="Best Practices"
            items={[
              'Provide sufficient, relevant context — at least 2–3 sentences around the expected answer',
              'Review highlighted spans to confirm model reasoning before trusting the output',
              'Treat confidence < 40% as uncertain — seek additional context',
              'Use the unanswerable flag as a signal to reformulate the question or expand the passage',
              'Keep passages under 512 tokens for optimal single-window accuracy',
              'Always present model version and execution time to end users',
            ]}
          />
        </Section>

        {/* Product Principles */}
        <Section title="Product Principles">
          <p className="text-sm text-gray-700 italic border-l-4 border-primary-400 pl-4 bg-primary-50 py-3 rounded-r-lg">
            "Extract first, verify second; explicit uncertainty over guessing; preserve original text formatting;
            version every model artifact; do not present predicted spans as absolute truth."
          </p>
        </Section>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-xs text-gray-400 flex flex-wrap justify-between gap-2">
          <span>QA System · bert-base-squad2-v1 · SQuAD 2.0</span>
          <span>Advanced Data Science Track · Polaris Documentation</span>
        </div>
      </div>
    </div>
  </div>
);

export default ModelCard;
