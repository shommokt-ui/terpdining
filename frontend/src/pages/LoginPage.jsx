import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiPost } from '../api';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-umd-gray-dark">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-.828.672-1.5 1.5-1.5h16.5c.828 0 1.5.672 1.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.5l9.107 6.075a1.5 1.5 0 001.643 0L22.5 7.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-umd-gray-dark">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 10.5h10.5a1.5 1.5 0 001.5-1.5v-7.5a1.5 1.5 0 00-1.5-1.5H6.75a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5z" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.774 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/login', { email, password });
      login(data.access_token, data.user);
      navigate('/menu');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {/* brand panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-gradient-to-br from-umd-red to-umd-red-dark items-center justify-center p-12">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative text-white max-w-sm">
          <div className="flex items-center gap-3 text-2xl font-extrabold uppercase tracking-wide mb-6">
            <Logo className="w-10 h-10" />
            TerpDining
          </div>
          <h2 className="text-4xl umd-hero-title leading-tight mb-4">
            Know what's <span className="text-umd-gold">good</span> before you go.
          </h2>
          <p className="text-white/85 text-sm leading-relaxed">
            Live dining hall menus, macro tracking, and personalized recipes built for Terps, all in
            one place.
          </p>
        </div>
      </div>

      {/* form panel */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 text-umd-black font-extrabold text-lg uppercase tracking-wide mb-6">
            <Logo className="w-7 h-7" />
            TerpDining
          </div>

          <div className="flex items-baseline justify-between mb-6">
            <h1 className="text-3xl umd-hero-title">Sign in</h1>
            <Link to="/register" className="text-xs text-umd-body hover:text-umd-red hover:underline">
              New user? <span className="font-semibold text-umd-red">Create an account</span>
            </Link>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 mt-0.5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-umd-black mb-1">Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  <MailIcon />
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
                  placeholder="terp@umd.edu"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-umd-black mb-1">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-umd-gray-dark hover:text-umd-red"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-umd-red hover:bg-umd-red-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Spinner />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-xs text-umd-body hover:text-umd-red hover:underline">
              Forgot password?
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-umd-gray-dark">
            <Link to="/privacy" className="hover:text-umd-red hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
