import { useState } from 'react';
import announcements from '../announcements';

const DISMISSED_KEY = 'dismissed_announcements';

function loadDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export default function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(loadDismissed);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  function dismiss(id) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  }

  return (
    <div className="space-y-2 px-4 pt-3 umd-container">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`rounded-lg px-4 py-2.5 flex items-start gap-3 text-sm ${
            a.type === 'warning'
              ? 'bg-umd-gold/20 dark:bg-umd-gold/10 border border-umd-gold/50 text-umd-black'
              : 'bg-umd-red/10 dark:bg-umd-red/15 border border-umd-red/30 text-umd-black'
          }`}
        >
          <span className="flex-1">{a.message}</span>
          <button
            onClick={() => dismiss(a.id)}
            className="text-umd-gray-dark hover:text-umd-black shrink-0 p-0.5"
            aria-label="Dismiss announcement"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
