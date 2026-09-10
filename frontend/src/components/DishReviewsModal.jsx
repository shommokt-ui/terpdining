import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StarRating from './StarRating';

const PAGE_SIZE = 10;

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
];

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function DishReviewsModal({ open, foodItemId, foodName, labelUrl, hall, onClose, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [meta, setMeta] = useState({ average: null, count: 0 });
  const [reviews, setReviews] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPage = useCallback(
    async (offset, sortBy) => {
      const params = new URLSearchParams({ sort: sortBy, limit: String(PAGE_SIZE), offset: String(offset) });
      if (hall) params.set('hall', hall);
      return apiGet(`/api/reviews/${foodItemId}?${params.toString()}`);
    },
    [foodItemId, hall],
  );

  const loadFirst = useCallback(
    async (sortBy) => {
      if (foodItemId == null) return;
      setLoading(true);
      try {
        const resp = await fetchPage(0, sortBy);
        setMeta({ average: resp.average, count: resp.count });
        setReviews(resp.reviews);
        setHasMore(resp.has_more);
      } catch {
        setMeta({ average: null, count: 0 });
        setReviews([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [foodItemId, fetchPage],
  );

  async function loadMore() {
    setLoadingMore(true);
    try {
      const resp = await fetchPage(reviews.length, sort);
      setReviews((prev) => [...prev, ...resp.reviews]);
      setHasMore(resp.has_more);
      setMeta({ average: resp.average, count: resp.count });
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setComment('');
    setName(user ? user.email.split('@')[0] : '');
    setSort('newest');
    loadFirst('newest');
  }, [open, foodItemId, user, loadFirst]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSortChange(e) {
    const next = e.target.value;
    setSort(next);
    loadFirst(next);
  }

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
        hall,
        rating,
        comment: comment.trim() || null,
        name: name.trim() || null,
      });
      toast('Review posted!', 'info');
      setRating(0);
      setComment('');
      setSort('newest');
      await loadFirst('newest');
      onChanged?.();
    } catch (err) {
      toast(err.message || "Couldn't post your review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-umd-gray gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-umd-black truncate">{foodName}</h2>
            {!loading && (
              <div className="flex items-center gap-2 mt-1">
                {meta.count > 0 ? (
                  <>
                    <StarRating value={meta.average} size="sm" />
                    <span className="text-xs text-umd-body">
                      {meta.average} · {meta.count} review{meta.count !== 1 ? 's' : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-umd-body">No reviews yet</span>
                )}
              </div>
            )}
            {labelUrl && (
              <a
                href={labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-umd-red font-semibold hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M9 11h6M9 15h4M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                </svg>
                Nutrition facts &amp; macros
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-umd-gray-dark hover:text-umd-red p-1 rounded-lg hover:bg-umd-gray-light transition-colors shrink-0" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {!user ? (
            <div className="umd-card rounded-xl p-4 space-y-2 text-center">
              <div className="text-sm font-semibold text-umd-black">Want to leave a review?</div>
              <p className="text-xs text-umd-body">
                Sign in to post. You can still choose to show up as "Anonymous".
              </p>
              <Link
                to="/login"
                onClick={onClose}
                className="inline-block bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Sign in
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="umd-card rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-umd-black">Write a review</div>
            <StarRating value={rating} onChange={setRating} size="lg" />
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Your name (optional)"
                className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
              />
              <div className="text-[11px] text-umd-gray-dark mt-0.5">
                Leave blank to post as "Anonymous".
              </div>
            </div>
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="How was it? (optional)"
                className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent resize-none"
              />
              <div className="text-[11px] text-umd-gray-dark text-right mt-0.5">{comment.length}/1000</div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post review'}
            </button>
          </form>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {meta.count > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-umd-black">
                    {meta.count} review{meta.count !== 1 ? 's' : ''}
                  </span>
                  <select
                    value={sort}
                    onChange={handleSortChange}
                    className="bg-white dark:bg-[#1c1c1c] text-umd-body text-xs border border-umd-gray rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-umd-red"
                    aria-label="Sort reviews"
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

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

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full text-sm font-semibold text-umd-red hover:bg-umd-gray-light rounded-lg py-2 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Show more reviews'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
