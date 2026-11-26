import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('analyst@qasystem.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await apiService.login({ email: cleanEmail, password });
      const displayUser = response.username || cleanEmail.split('@')[0];
      login(displayUser, response.access_token, response.email || cleanEmail);
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
      <div className="ambient-glow-emerald w-[550px] h-[550px] -top-20 left-1/4 -z-10 opacity-30"></div>
      <div className="ambient-glow-blue w-[550px] h-[550px] bottom-10 right-1/4 -z-10 opacity-20"></div>

      <div className="max-w-md w-full relative z-10 py-8">
        <div className="glass-card p-8 shadow-2xl fade-in border border-white/10 backdrop-blur-xl">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center justify-center mb-3 group">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white text-3xl font-extrabold shadow-xl shadow-emerald-950/70 group-hover:scale-105 transition-transform duration-200">
                  Q
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-emerald-500/25 blur-md -z-10"></div>
              </div>
            </Link>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Question Answering Engine
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Industrial BERT SQuAD 2.0 Extractive Analytics
            </p>
          </div>

          {/* Global Error Banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs mb-4 fade-in"
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {/* Email & Password Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input w-full text-xs pl-10"
                  placeholder="e.g. analyst@qasystem.com"
                  required
                  autoFocus
                  autoComplete="email"
                  aria-label="Email"
                />
              </div>
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
              disabled={loading || !email || !password}
              className="w-full btn-primary py-3 text-xs mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

            {/* Demo Accounts */}
            <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Demo Accounts
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">1-click fill</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('analyst@qasystem.com');
                    setPassword('password123');
                  }}
                  className="px-3 py-2 bg-slate-900/80 hover:bg-emerald-950/40 border border-white/10 hover:border-emerald-500/40 rounded-xl text-left transition-all group"
                >
                  <p className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">analyst@qasystem.com</p>
                  <p className="text-[10px] text-slate-400 font-mono">password123</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@qasystem.com');
                    setPassword('password123');
                  }}
                  className="px-3 py-2 bg-slate-900/80 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 rounded-xl text-left transition-all group"
                >
                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">admin@qasystem.com</p>
                  <p className="text-[10px] text-slate-400 font-mono">password123</p>
                </button>
              </div>
            </div>
          </form>

          {/* Security & Compliance Footer */}
          <div className="mt-8 pt-4 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Encrypted with SHA-256 Salted Hashes & Constant-Time Validation</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
