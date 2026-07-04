import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/reset-password', {
        token,
        new_password: password,
      });
      login(data.access_token, data.user);
      navigate('/menu');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-5.5rem)] flex items-center justify-center px-4">
        <div className="umd-card rounded-2xl w-full max-w-md p-8 text-center">
          <h1 className="text-2xl umd-hero-title mb-2">Missing reset token</h1>
          <p className="text-umd-body text-sm mb-6">
            This page needs a reset link. Request a new one from the forgot-password screen.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold bg-umd-red text-white hover:bg-umd-red-dark transition-colors"
          >
            Get a reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5.5rem)] flex items-center justify-center px-4">
      <div className="umd-card rounded-2xl w-full max-w-md p-8">
        <h1 className="text-3xl umd-hero-title mb-1">Reset password</h1>
        <p className="text-umd-body text-sm mb-6">Pick a new password to get back in.</p>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-umd-black mb-1">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-umd-black mb-1">Confirm password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-umd-red hover:bg-umd-red-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-umd-body">
          <Link to="/login" className="text-umd-red font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
