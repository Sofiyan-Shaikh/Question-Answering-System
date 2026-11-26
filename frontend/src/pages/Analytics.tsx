import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { apiService } from '../services/api';
import { HealthResponse, HistoryStats, TaskHistoryItem } from '../types';

const CustomDarkTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0B0F17]/95 border border-white/15 rounded-xl shadow-2xl p-3 text-xs backdrop-blur-md">
        {label && <p className="font-bold text-white mb-1.5">{label}</p>}
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.payload?.color }}></span>
              <span>{p.name}:</span>
            </span>
            <span className="font-mono font-bold text-white">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const KPICard: React.FC<{
  label: string;
  value: string;
  sub?: string;
}> = ({ label, value, sub }) => (
  <div className="glass-card p-5 hover:border-emerald-500/30 transition-all duration-200">
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-3xl font-extrabold text-white mt-1.5 font-mono">{value}</p>
    {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
  </div>
);

const Analytics: React.FC = () => {
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTelemetry = async () => {
      setLoading(true);
      setError('');
      try {
        const [statsRes, historyRes, healthRes] = await Promise.all([
          apiService.getHistoryStats(),
          apiService.getHistory({ limit: 100, offset: 0 }),
          apiService.checkHealth().catch(() => null),
        ]);
        setStats(statsRes);
        setHistory(historyRes.history);
        setHealth(healthRes);
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to load analytics from the backend.');
      } finally {
        setLoading(false);
      }
    };
    loadTelemetry();
  }, []);

  const taskBreakdown = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Passage QA', value: stats.text_qa_count, color: '#10b981' },
      { name: 'PDF QA', value: stats.pdf_qa_count, color: '#06b6d4' },
      { name: 'PDF Extract', value: stats.pdf_extract_count, color: '#8b5cf6' },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const answerabilityData = useMemo(() => {
    const qaTasks = history.filter((t) => t.task_type === 'text_qa' || t.task_type === 'pdf_qa');
    const answered = qaTasks.filter((t) => t.is_answerable).length;
    const unanswerable = qaTasks.length - answered;
    return [
      { name: 'Answered', value: answered, color: '#10b981' },
      { name: 'No Answer Found', value: unanswerable, color: '#f59e0b' },
    ].filter((d) => d.value > 0);
  }, [history]);

  const confidenceBuckets = useMemo(() => {
    const qaTasks = history.filter((t) => t.task_type === 'text_qa' || t.task_type === 'pdf_qa');
    const buckets = [
      { range: '0–25%', count: 0 },
      { range: '25–50%', count: 0 },
      { range: '50–75%', count: 0 },
      { range: '75–100%', count: 0 },
    ];
    qaTasks.forEach((t) => {
      const pct = (t.confidence_score || 0) * 100;
      if (pct < 25) buckets[0].count += 1;
      else if (pct < 50) buckets[1].count += 1;
      else if (pct < 75) buckets[2].count += 1;
      else buckets[3].count += 1;
    });
    return buckets;
  }, [history]);

  const avgLatencyMs = useMemo(() => {
    if (history.length === 0) return 0;
    const total = history.reduce((sum, item) => sum + (item.execution_time_ms || 0), 0);
    return Math.round(total / history.length);
  }, [history]);

  const recentLatencyData = useMemo(() => {
    return history
      .slice(0, 10)
      .reverse()
      .map((item, idx) => ({
        query: `#${idx + 1}`,
        ms: Math.round(item.execution_time_ms || 0),
      }));
  }, [history]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0B0F17]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs font-mono">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header + Live Backend Status */}
        <div className="border-b border-white/10 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Usage Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Live metrics computed from your actual Q&A queries and uploaded documents.
            </p>
          </div>

          {health && (
            <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${health.model_loaded ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-slate-300">
                {health.model_version} ({health.device})
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 px-4 py-3 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Real KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Queries"
            value={String(stats?.total_tasks ?? 0)}
            sub={`${stats?.text_qa_count ?? 0} passage · ${stats?.pdf_qa_count ?? 0} PDF`}
          />
          <KPICard
            label="Uploaded Documents"
            value={String(stats?.total_documents ?? 0)}
            sub="Stored in document vault"
          />
          <KPICard
            label="Avg Confidence"
            value={`${((stats?.avg_confidence ?? 0) * 100).toFixed(1)}%`}
            sub="Across recorded Q&A runs"
          />
          <KPICard
            label="Avg Response Time"
            value={`${avgLatencyMs} ms`}
            sub={`Last ${history.length} queries`}
          />
        </div>

        {/* Empty State or Real Charts */}
        {!stats || stats.total_tasks === 0 ? (
          <div className="glass-card p-12 text-center space-y-4">
            <p className="text-base font-semibold text-white">No query data yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ask a question in the QA Workspace to start seeing real response times, confidence scores, and usage breakdowns here.
            </p>
            <Link to="/workspace" className="btn-primary inline-flex items-center gap-2 text-xs px-5 py-2.5">
              Open QA Workspace
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Type Breakdown */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white">Query Type Breakdown</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {taskBreakdown.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomDarkTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-300">
                {taskBreakdown.map((item) => (
                  <span key={item.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}: <strong className="font-mono">{item.value}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Answerability Breakdown */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white">Answered vs. No Answer Found</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={answerabilityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {answerabilityData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomDarkTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-300">
                {answerabilityData.map((item) => (
                  <span key={item.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}: <strong className="font-mono">{item.value}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Confidence Distribution */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white">Confidence Score Distribution</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confidenceBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="range" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<CustomDarkTooltip />} />
                    <Bar dataKey="count" name="Queries" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Query Latency */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white">Recent Query Latency (ms)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recentLatencyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="query" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip content={<CustomDarkTooltip />} />
                    <Bar dataKey="ms" name="Latency (ms)" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
