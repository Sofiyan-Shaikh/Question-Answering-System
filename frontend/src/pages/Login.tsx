import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

type AuthMode = 'otp' | 'password';
type OtpStep = 'email' | 'verify';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Mode Selection: 'otp' (default passwordless) or 'password'
  const [authMode, setAuthMode] = useState<AuthMode>('otp');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');

  // Email OTP state
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(300); // 5 mins
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Username/Password state (fallback)
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);

  // General UI state
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Ref array for 6 individual OTP input boxes
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer tick effect for OTP countdown and Resend cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (otpStep === 'verify') {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [otpStep]);

  // Focus the first OTP input box when entering verify step
  useEffect(() => {
    if (otpStep === 'verify') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [otpStep]);

  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Handle Send OTP (Step 1)
  const handleSendOtp = async (e?: React.FormEvent, targetEmail?: string) => {
    if (e) e.preventDefault();
    const emailToSend = (targetEmail || email).trim().toLowerCase();
    if (!emailToSend) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await apiService.sendOtp(emailToSend);
      setEmail(emailToSend);
      setDevOtp(res.dev_otp || null);
      setCountdown(res.expires_in_seconds || 300);
      setResendCooldown(res.cooldown_seconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpStep('verify');
      setSuccessMsg(res.message || `Verification code sent to ${emailToSend}`);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle OTP Box Keyboard Navigation & Input
  const handleOtpDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned;
    setOtpDigits(newDigits);
    setError('');

    // Auto-advance to next input if digit entered
    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Move to previous input and clear it
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Paste Event across the 6 OTP input boxes
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    setError('');

    const nextIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIndex]?.focus();

    // If a full 6 digits were pasted, automatically verify
    if (pasted.length === 6) {
      submitOtpVerification(newDigits.join(''));
    }
  };

  // 3. Handle Verify OTP (Step 2)
  const submitOtpVerification = async (codeOverride?: string) => {
    const fullCode = codeOverride || otpDigits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await apiService.verifyOtp(email, fullCode);
      const displayUser = res.username || email.split('@')[0];
      login(displayUser, res.access_token, res.email || email);
      navigate('/workspace');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Quick auto-fill helper for developer testing
  const handleAutoFillDevOtp = () => {
    if (!devOtp || devOtp.length !== 6) return;
    const digits = devOtp.split('');
    setOtpDigits(digits);
    submitOtpVerification(devOtp);
  };

  // 4. Handle Traditional Password Login (Fallback)
  const handlePasswordSubmit = async (e: React.FormEvent) => {
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

          {/* Authentication Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-900/80 rounded-xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('otp');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'otp'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Email OTP</span>
              <span className="text-[9px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-mono uppercase tracking-wider">
                Safe
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'password'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Password</span>
            </button>
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

          {/* Global Success Banner */}
          {successMsg && !error && (
            <div
              role="status"
              className="flex items-start gap-2.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs mb-4 fade-in"
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="leading-relaxed">{successMsg}</p>
            </div>
          )}

          {/* ========================================================= */}
          {/* FLOW A: EMAIL OTP AUTHENTICATION                          */}
          {/* ========================================================= */}
          {authMode === 'otp' && (
            <div>
              {otpStep === 'email' ? (
                /* Step 1: Input Email */
                <form onSubmit={(e) => handleSendOtp(e)} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                      Work / Personal Email
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
                        aria-label="Work Email"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      No password required. We'll send a secure 6-digit one-time code.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full btn-primary py-3 text-xs mt-2 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending verification code…</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit Code</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>

                  {/* One-click Demo Emails */}
                  <div className="pt-4 border-t border-white/10 mt-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        Quick Demo Emails
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">1-click select</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('analyst@qasystem.com');
                          handleSendOtp(undefined, 'analyst@qasystem.com');
                        }}
                        className="px-3 py-2 bg-slate-900/80 hover:bg-emerald-950/40 border border-white/10 hover:border-emerald-500/40 rounded-xl text-left transition-all group"
                      >
                        <p className="text-xs font-bold text-white group-hover:text-emerald-300">analyst</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">analyst@qasystem.com</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEmail('admin@qasystem.com');
                          handleSendOtp(undefined, 'admin@qasystem.com');
                        }}
                        className="px-3 py-2 bg-slate-900/80 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 rounded-xl text-left transition-all group"
                      >
                        <p className="text-xs font-bold text-white group-hover:text-cyan-300">admin</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">admin@qasystem.com</p>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Step 2: Input 6-Digit OTP */
                <div className="space-y-5 fade-in">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono mb-2">
                      <span>Sent to:</span>
                      <strong className="text-white">{email}</strong>
                    </div>
                    <p className="text-xs text-slate-400">
                      Enter the 6-digit verification code to complete sign-in.
                    </p>
                  </div>

                  {/* Dev Mode One-Click Auto-Fill Notification */}
                  {devOtp && (
                    <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 text-center space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-300 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Dev Preview Code:</span>
                        <span className="font-mono font-bold text-white bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-400/40 tracking-widest text-sm">
                          {devOtp}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoFillDevOtp}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-semibold transition-colors"
                      >
                        Click to auto-fill & verify instantly
                      </button>
                    </div>
                  )}

                  {/* 6 Individual OTP Digit Input Boxes */}
                  <div>
                    <label className="block text-center text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                      Verification Code
                    </label>
                    <div className="flex justify-between gap-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpInputRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          className="w-12 h-14 text-center text-xl font-mono font-extrabold rounded-xl bg-slate-900/90 border border-white/20 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 text-white shadow-inner transition-all outline-none"
                          aria-label={`Digit ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Timer & Resend Controls */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Expires in{' '}
                        <strong className={countdown < 60 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatTime(countdown)}
                        </strong>
                      </span>
                    </div>

                    {resendCooldown > 0 ? (
                      <span className="text-slate-500 font-mono text-[11px]">
                        Resend in {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp(undefined, email)}
                        disabled={loading}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold underline text-xs transition-colors"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>

                  {/* Primary Verify Button */}
                  <button
                    type="button"
                    onClick={() => submitOtpVerification()}
                    disabled={loading || otpDigits.join('').length !== 6 || countdown <= 0}
                    className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying code…</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Sign In</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </>
                    )}
                  </button>

                  {/* Back to Email Step */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('email');
                        setOtpDigits(['', '', '', '', '', '']);
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span>Use a different email address</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* FLOW B: USERNAME & PASSWORD AUTHENTICATION (FALLBACK)     */}
          {/* ========================================================= */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                      setUsername('analyst');
                      setPassword('password123');
                    }}
                    className="px-3 py-2 bg-slate-900/80 hover:bg-emerald-950/40 border border-white/10 hover:border-emerald-500/40 rounded-xl text-left transition-all group"
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
                    className="px-3 py-2 bg-slate-900/80 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 rounded-xl text-left transition-all group"
                  >
                    <p className="text-xs font-bold text-white group-hover:text-cyan-300">admin</p>
                    <p className="text-[10px] text-slate-400 font-mono">password123</p>
                  </button>
                </div>
              </div>
            </form>
          )}

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
