import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current one.');
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="umd-container max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl umd-hero-title text-umd-black mb-1">Settings</h1>
        <p className="text-umd-body text-sm">
          Signed in as <span className="font-semibold text-umd-black">{user?.email}</span>
        </p>
      </div>

      <div className="umd-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-umd-black">Change password</h2>
          <p className="text-xs text-umd-body">
            You'll stay signed in on this device after updating.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-umd-black mb-1">
              Current password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-umd-black mb-1">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-umd-black mb-1">
              Confirm new password
            </label>
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
            className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="umd-card rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-umd-black">Sign out</h2>
          <p className="text-xs text-umd-body">End this session on this device.</p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="border border-umd-gray text-umd-black hover:border-umd-red hover:text-umd-red font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
