import { useState } from 'react';

function Star({ fill, className }) {
  // fill: 0..1 fraction of the star to paint
  const pct = Math.max(0, Math.min(1, fill)) * 100;
  return (
    <span className={`relative inline-block ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full text-umd-gray-dark">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.02 4.09 4.51.66c.79.11 1.1 1.08.53 1.63l-3.26 3.18.77 4.49c.13.78-.69 1.38-1.39 1.01L12 17.9l-4.03 2.12c-.7.37-1.52-.23-1.39-1.01l.77-4.49-3.26-3.18c-.57-.55-.26-1.52.53-1.63l4.51-.66L11.48 3.5z" />
      </svg>
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-amber-400" style={{ minWidth: '1em' }}>
          <path d="M11.48 3.5l2.02 4.09 4.51.66c.79.11 1.1 1.08.53 1.63l-3.26 3.18.77 4.49c.13.78-.69 1.38-1.39 1.01L12 17.9l-4.03 2.12c-.7.37-1.52-.23-1.39-1.01l.77-4.49-3.26-3.18c-.57-.55-.26-1.52.53-1.63l4.51-.66L11.48 3.5z" />
        </svg>
      </span>
    </span>
  );
}

/**
 * StarRating
 * - Display mode (default): renders `value` with fractional fill.
 * - Interactive mode: pass `onChange` to make stars clickable (whole numbers).
 */
export default function StarRating({ value = 0, onChange, size = 'md', className = '' }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === 'function';
  const sizeClass = size === 'lg' ? 'w-7 h-7' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  const shown = interactive && hover > 0 ? hover : value;

  if (!interactive) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} fill={shown - (i - 1)} className={sizeClass} />
        ))}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-umd-red rounded"
        >
          <Star fill={shown - (i - 1)} className={sizeClass} />
        </button>
      ))}
    </span>
  );
}
