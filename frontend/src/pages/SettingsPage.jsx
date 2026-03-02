import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await apiPost('/api/auth/delete-account', { current_password: deletePassword });
      setShowDeleteConfirm(false);
      setDeletePassword('');
      logout();
      navigate('/login');
      toast("We're sad to see you go, Terp!", 'info');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="umd-container max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-3xl umd-hero-title text-umd-black">Profile & Settings</h1>

      {/* profile card */}
      <div className="umd-card rounded-2xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-umd-red text-white flex items-center justify-center text-xl font-extrabold uppercase shrink-0">
          {user?.email?.[0] || '?'}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold text-umd-black truncate">{user?.email?.split('@')[0]}</div>
          <div className="text-sm text-umd-body truncate">{user?.email}</div>
        </div>
      </div>

      {/* appearance */}
      <div className="umd-card rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-umd-black">Appearance</h2>
          <p className="text-xs text-umd-body">Currently using {theme} mode.</p>
        </div>
        <button
          onClick={toggleTheme}
          className="border border-umd-gray text-umd-black hover:border-umd-red hover:text-umd-red font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Switch to {theme === 'dark' ? 'light' : 'dark'}
        </button>
      </div>

      <div className="umd-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-umd-black">Change password</h2>
          <p className="text-xs text-umd-body">
            You'll stay signed in on this device after updating.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 text-green-800 dark:text-green-300 text-sm rounded-lg px-4 py-3">
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
              className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
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
              className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
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
              className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
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

      {/* about & legal */}
      <div className="umd-card rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-bold text-umd-black">About</h2>
        <div className="divide-y divide-umd-gray-light text-sm">
          <Link to="/privacy" className="flex items-center justify-between py-2.5 text-umd-body hover:text-umd-red">
            Privacy Policy
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="mailto:shommokt@gmail.com?subject=TerpDining%20help" className="flex items-center justify-between py-2.5 text-umd-body hover:text-umd-red">
            Help
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        <p className="text-[11px] text-umd-gray-dark pt-1">
          TerpDining is an independent student project, not affiliated with the University of Maryland.
        </p>
      </div>

      {/* danger zone */}
      <div className="umd-card rounded-2xl p-6 space-y-3 border-red-200 dark:border-red-900/50">
        <div>
          <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Delete account</h2>
          <p className="text-xs text-umd-body">
            Permanently deletes your account, favorites, tracker logs, and recipe sessions. This
            cannot be undone.
          </p>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Delete my account
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            {deleteError && (
              <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
                {deleteError}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-umd-black mb-1">
                Enter your password to confirm
              </label>
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Permanently delete'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                className="border border-umd-gray text-umd-black hover:border-umd-gray-dark font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
