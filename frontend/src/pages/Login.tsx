import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

const Login: React.FC = () => {
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiService.login({ username, password });
      login(username, response.access_token);
      navigate('/workspace');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = 'Login failed. Please check your credentials.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = detail[0]?.msg || msg;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] text-slate-100 px-4 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="ambient-glow-emerald w-[500px] h-[500px] -top-20 left-1/4 -z-10 opacity-30"></div>
      <div className="ambient-glow-blue w-[500px] h-[500px] bottom-10 right-1/4 -z-10 opacity-20"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="glass-card p-8 shadow-2xl fade-in">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center mb-4 group">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white text-3xl font-extrabold shadow-xl shadow-emerald-950/70 group-hover:scale-105 transition-transform duration-200">
                  Q
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-emerald-500/25 blur-md -z-10"></div>
              </div>
            </Link>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Welcome to QA System
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Sign in to query the BERT SQuAD 2.0 Engine
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs fade-in"
              >
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="glass-input w-full text-xs"
                placeholder="e.g. analyst"
                required
                autoComplete="username"
                aria-label="Username"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full text-xs font-mono"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                aria-label="Password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full btn-primary py-3 text-xs mt-2"
            >
              {loading ? (
                <>
                  <span
                    className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>Sign In & Open Workspace</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Quick autofill demo accounts */}
          <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Demo Accounts
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">One-click autofill</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('analyst');
                  setPassword('password123');
                }}
                className="px-3 py-2 bg-[#0B0F17] hover:bg-emerald-950/40 border border-white/10 hover:border-emerald-500/40 rounded-xl text-left transition-all group"
              >
                <p className="text-xs font-bold text-white group-hover:text-emerald-300">analyst</p>
                <p className="text-[10px] text-slate-400 font-mono">password123</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('password123');
                }}
                className="px-3 py-2 bg-[#0B0F17] hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 rounded-xl text-left transition-all group"
              >
                <p className="text-xs font-bold text-white group-hover:text-cyan-300">admin</p>
                <p className="text-[10px] text-slate-400 font-mono">password123</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
