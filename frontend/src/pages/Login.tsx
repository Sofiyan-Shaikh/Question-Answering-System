import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
      <div className="max-w-md w-full">
        <div className="card fade-in shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow">
              <span className="text-white font-extrabold text-3xl">Q</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-500 mt-1 text-sm">Sign in to access the QA workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
              >
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="e.g. analyst"
                required
                autoComplete="username"
                aria-label="Username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                aria-label="Password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span
                    className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Demo Accounts</p>
              <span className="text-xs text-blue-600">Click to auto-fill</span>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => { setUsername('analyst'); setPassword('password123'); }}
                className="flex-1 text-xs py-1.5 px-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition cursor-pointer"
              >
                Fill Analyst
              </button>
              <button
                type="button"
                onClick={() => { setUsername('admin'); setPassword('password123'); }}
                className="flex-1 text-xs py-1.5 px-2 bg-white text-blue-800 border border-blue-300 rounded font-medium hover:bg-blue-100 transition cursor-pointer"
              >
                Fill Admin
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
              <span>Username:</span>
              <code className="bg-blue-100 px-2 py-0.5 rounded font-mono cursor-pointer" onClick={() => setUsername('analyst')}>analyst</code>
              <span>Password:</span>
              <code className="bg-blue-100 px-2 py-0.5 rounded font-mono cursor-pointer" onClick={() => setPassword('password123')}>password123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
