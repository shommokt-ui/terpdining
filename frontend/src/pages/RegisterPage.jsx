import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPost } from '../api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/register', { email, password });
      login(data.access_token, data.user);
      navigate('/menu');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5.5rem)] flex items-center justify-center px-4">
      <div className="umd-card rounded-2xl w-full max-w-md p-8">
        <h1 className="text-3xl umd-hero-title mb-1">Create your account</h1>
        <p className="text-umd-body text-sm mb-6">Get started with TerpDining</p>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-umd-black mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
              placeholder="terp@umd.edu"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-umd-black mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-umd-red hover:bg-umd-red-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-3 text-center text-[11px] text-umd-gray-dark">
          By creating an account you agree to our{' '}
          <Link to="/privacy" className="underline hover:text-umd-red">Privacy Policy</Link>.
        </p>

        <p className="mt-6 text-center text-sm text-umd-body">
          Already have an account?{' '}
          <Link to="/login" className="text-umd-red font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
