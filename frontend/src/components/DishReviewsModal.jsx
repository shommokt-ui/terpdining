import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StarRating from './StarRating';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function DishReviewsModal({ open, foodItemId, foodName, onClose, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (foodItemId == null) return;
    setLoading(true);
    try {
      const resp = await apiGet(`/api/reviews/${foodItemId}`);
      setData(resp);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [foodItemId]);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setComment('');
    setName(user ? user.email.split('@')[0] : '');
    load();
  }, [open, load, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating < 1) {
      toast('Pick a star rating first.');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/reviews', {
        food_item_id: foodItemId,
        rating,
        comment: comment.trim() || null,
        name: name.trim() || null,
      });
      toast('Review posted!', 'info');
      setRating(0);
      setComment('');
      await load();
      onChanged?.();
    } catch (err) {
      toast(err.message || "Couldn't post your review.");
    } finally {
      setSaving(false);
    }
  }

  const reviews = data?.reviews || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-umd-gray gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-umd-black truncate">{foodName}</h2>
            {!loading && data && (
              <div className="flex items-center gap-2 mt-1">
                {data.count > 0 ? (
                  <>
                    <StarRating value={data.average} size="sm" />
                    <span className="text-xs text-umd-body">
                      {data.average} · {data.count} review{data.count !== 1 ? 's' : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-umd-body">No reviews yet</span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-umd-gray-dark hover:text-umd-red p-1 rounded-lg hover:bg-umd-gray-light transition-colors shrink-0" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-16 w-full" />
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="umd-card rounded-xl p-4 space-y-3">
                <div className="text-sm font-semibold text-umd-black">Write a review</div>
                <StarRating value={rating} onChange={setRating} size="lg" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder="Your name (optional)"
                  className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
                />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="How was it? (optional)"
                  className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent resize-none"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Posting...' : 'Post review'}
                </button>
              </form>

              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-sm text-umd-body text-center py-4">Be the first to review this dish!</p>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="border-b border-umd-gray-light last:border-b-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-umd-black truncate">{r.author}</span>
                        <span className="text-[11px] text-umd-gray-dark shrink-0">{formatDate(r.created_at)}</span>
                      </div>
                      <StarRating value={r.rating} size="sm" className="mt-0.5" />
                      {r.comment && <p className="text-sm text-umd-body mt-1 whitespace-pre-wrap">{r.comment}</p>}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
