import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '../api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiPost('/api/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5.5rem)] flex items-center justify-center px-4">
      <div className="umd-card rounded-2xl w-full max-w-md p-8">
        <h1 className="text-3xl umd-hero-title mb-1">Forgot password</h1>
        <p className="text-umd-body text-sm mb-6">
          We'll send you a reset link if an account with that email exists.
        </p>

        {submitted ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
              If <span className="font-semibold">{email}</span> is registered, a reset link is on its way.
              Check your inbox (and spam folder).
            </div>
            <Link
              to="/login"
              className="block text-center text-sm font-semibold text-umd-red hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-umd-black mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
                  placeholder="terp@umd.edu"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-umd-red hover:bg-umd-red-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-umd-body">
              Remembered it?{' '}
              <Link to="/login" className="text-umd-red font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
