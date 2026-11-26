import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

type AuthTab = 'signin' | 'register';
type SignInMethod = 'password' | 'otp';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AuthTab>('signin');
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('password');
  const [otpStep, setOtpStep] = useState<'form' | 'verify'>('form');

  // Form fields
  const [email, setEmail] = useState('analyst@qasystem.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(300);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Feedback state
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Countdown timer when on OTP verification step
  useEffect(() => {
    if (otpStep !== 'verify') return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpStep]);

  // Focus first OTP digit box on entering verify step
  useEffect(() => {
    if (otpStep === 'verify') {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
    }
  }, [otpStep]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const extractError = (err: any, fallback: string) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) return detail[0]?.msg || fallback;
    return err?.message || fallback;
  };

  const resetOtpState = () => {
    setOtpStep('form');
    setOtpDigits(['', '', '', '', '', '']);
    setDevOtp(null);
    setStatusMsg('');
  };

  const handleTabSwitch = (nextTab: AuthTab) => {
    setTab(nextTab);
    setError('');
    resetOtpState();
    if (nextTab === 'register') {
      setEmail('');
      setPassword('');
      setUsername('');
    } else {
      setSignInMethod('password');
      setEmail('analyst@qasystem.com');
      setPassword('password123');
    }
  };

  const handleMethodSwitch = (method: SignInMethod) => {
    setSignInMethod(method);
    setError('');
    resetOtpState();
    if (method === 'otp' && email === 'analyst@qasystem.com') {
      setEmail('');
    } else if (method === 'password' && !email) {
      setEmail('analyst@qasystem.com');
      setPassword('password123');
    }
  };

  // Send 6-digit OTP
  const handleSendOtp = async (e?: React.FormEvent, emailOverride?: string) => {
    if (e) e.preventDefault();
    const cleanEmail = (emailOverride ?? email).trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }
    if (tab === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setStatusMsg('');
    setLoading(true);
    try {
      const res = await apiService.sendOtp(cleanEmail);
      setEmail(cleanEmail);
      setDevOtp(res.dev_otp || null);
      setCountdown(res.expires_in_seconds || 300);
      setResendCooldown(res.cooldown_seconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpStep('verify');
      setStatusMsg(res.message || `Verification code sent to ${cleanEmail}`);
    } catch (err: any) {
      setError(extractError(err, 'Failed to send verification code.'));
    } finally {
      setLoading(false);
    }
  };

  // Password Sign In
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await apiService.login({ email: cleanEmail, password });
      const displayUser = res.username || cleanEmail.split('@')[0];
      login(displayUser, res.access_token, res.email || cleanEmail);
      navigate('/workspace');
    } catch (err: any) {
      setError(extractError(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  // Complete OTP Verification (Sign In or Register)
  const submitOtp = async (codeOverride?: string) => {
    const code = codeOverride || otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setError('');
    setLoading(true);
    try {
      const res =
        tab === 'register'
          ? await apiService.register({
              email: cleanEmail,
              password,
              username: username.trim() || undefined,
              otp: code,
            })
          : await apiService.verifyOtp(cleanEmail, code);

      const displayUser = res.username || cleanEmail.split('@')[0];
      login(displayUser, res.access_token, res.email || cleanEmail);
      navigate('/workspace');
    } catch (err: any) {
      setError(extractError(err, 'Verification failed. Please check the code.'));
    } finally {
      setLoading(false);
    }
  };

  // OTP Digit Input Handlers
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);
    setError('');
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const updated = [...otpDigits];
      updated[index - 1] = '';
      setOtpDigits(updated);
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const updated = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) updated[i] = pasted[i];
    setOtpDigits(updated);
    setError('');
    otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) {
      submitOtp(pasted);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] text-slate-100 px-4 py-8">
      <div className="max-w-md w-full">
        <div className="glass-card p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center justify-center mb-3 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white text-xl font-extrabold shadow-lg shadow-emerald-950/60 group-hover:scale-105 transition-transform">
                Q
              </div>
            </Link>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Question Answering System
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {otpStep === 'verify'
                ? 'Verify your email address to continue'
                : tab === 'register'
                ? 'Create your account with email verification'
                : 'Sign in to access your documents & workspace'}
            </p>
          </div>

          {/* Sign In / Create Account Tabs (hidden during OTP verify step) */}
          {otpStep === 'form' && (
            <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-xl border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => handleTabSwitch('signin')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  tab === 'signin'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch('register')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  tab === 'register'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs mb-4"
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Status Banner */}
          {statusMsg && !error && (
            <div
              role="status"
              className="flex items-start gap-2.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs mb-4"
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{statusMsg}</span>
            </div>
          )}

          {/* STEP 2: 6-Digit OTP Verification View */}
          {otpStep === 'verify' ? (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-xs text-slate-400">
                  Enter the 6-digit code sent to{' '}
                  <span className="text-white font-medium">{email}</span>
                </p>
              </div>

              {devOtp && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-center space-y-1">
                  <div className="text-xs text-emerald-300">
                    Dev code:{' '}
                    <span className="font-mono font-bold text-white tracking-widest bg-emerald-900/60 px-2 py-0.5 rounded">
                      {devOtp}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpDigits(devOtp.split(''));
                      submitOtp(devOtp);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                  >
                    Auto-fill & verify
                  </button>
                </div>
              )}

              <div className="flex justify-between gap-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="w-11 h-13 text-center text-lg font-mono font-bold rounded-xl bg-slate-900/90 border border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 text-white outline-none transition-all"
                    aria-label={`Digit ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">
                  Expires in{' '}
                  <strong className={countdown < 60 ? 'text-rose-400' : 'text-emerald-400'}>
                    {formatTime(countdown)}
                  </strong>
                </span>
                {resendCooldown > 0 ? (
                  <span className="font-mono text-slate-500">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp(undefined, email)}
                    disabled={loading}
                    className="text-emerald-400 hover:text-emerald-300 font-medium underline"
                  >
                    Resend code
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => submitOtp()}
                disabled={loading || otpDigits.join('').length !== 6 || countdown <= 0}
                className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{tab === 'register' ? 'Creating account…' : 'Verifying…'}</span>
                  </>
                ) : (
                  <span>{tab === 'register' ? 'Verify & Create Account' : 'Verify & Sign In'}</span>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    resetOtpState();
                    setError('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Back
                </button>
              </div>
            </div>
          ) : tab === 'signin' && signInMethod === 'password' ? (
            /* SIGN IN: Email + Password */
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input w-full text-xs"
                  placeholder="name@company.com"
                  required
                  autoFocus
                  autoComplete="email"
                  aria-label="Email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-300">
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
                className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign In to Workspace</span>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => handleMethodSwitch('otp')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Sign in with a 6-digit email code instead
                </button>
              </div>

              {/* Demo Accounts */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Demo Accounts (password123)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('analyst@qasystem.com');
                      setPassword('password123');
                    }}
                    className="px-3 py-2 bg-slate-900/80 hover:bg-emerald-950/40 border border-white/10 rounded-xl text-left transition-all"
                  >
                    <p className="text-xs font-semibold text-white truncate">analyst@qasystem.com</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@qasystem.com');
                      setPassword('password123');
                    }}
                    className="px-3 py-2 bg-slate-900/80 hover:bg-cyan-950/40 border border-white/10 rounded-xl text-left transition-all"
                  >
                    <p className="text-xs font-semibold text-white truncate">admin@qasystem.com</p>
                  </button>
                </div>
              </div>
            </form>
          ) : tab === 'signin' && signInMethod === 'otp' ? (
            /* SIGN IN: Passwordless Email OTP */
            <form onSubmit={(e) => handleSendOtp(e)} className="space-y-4">
              <div>
                <label htmlFor="otp-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  id="otp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input w-full text-xs"
                  placeholder="name@company.com"
                  required
                  autoFocus
                  autoComplete="email"
                  aria-label="Email"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  We'll send a one-time 6-digit verification code to your email.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending code…</span>
                  </>
                ) : (
                  <span>Send Verification Code</span>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => handleMethodSwitch('password')}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Sign in with password instead
                </button>
              </div>
            </form>
          ) : (
            /* CREATE ACCOUNT: Email + Username + Password -> OTP Verify */
            <form onSubmit={(e) => handleSendOtp(e)} className="space-y-4">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input w-full text-xs"
                  placeholder="name@company.com"
                  required
                  autoFocus
                  autoComplete="email"
                  aria-label="Email"
                />
              </div>

              <div>
                <label htmlFor="reg-username" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Username (optional)
                </label>
                <input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="glass-input w-full text-xs"
                  placeholder="e.g. alex_smith"
                  autoComplete="username"
                  aria-label="Username"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-300">
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
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full text-xs font-mono"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  aria-label="Password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email || password.length < 6}
                className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending verification code…</span>
                  </>
                ) : (
                  <span>Continue & Verify Email</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
