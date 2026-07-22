import { useId } from 'react';

export default function Logo({ className = 'w-8 h-8' }) {
  // Unique per instance: a shared id breaks the gradient fill when another copy of the
  // logo (e.g. inside a hidden responsive panel) is first in the DOM.
  const gradId = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e21833" />
          <stop offset="100%" stopColor="#b5132a" />
        </linearGradient>
      </defs>
      {/* turtle-shell scute badge */}
      <polygon
        points="12,1 21.53,6.5 21.53,17.5 12,23 2.47,17.5 2.47,6.5"
        fill={`url(#${gradId})`}
        stroke="#ffd200"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* fork */}
      <g fill="#ffffff">
        <rect x="9.2" y="5" width="0.9" height="6" rx="0.45" />
        <rect x="10.75" y="5" width="0.9" height="6" rx="0.45" />
        <rect x="12.3" y="5" width="0.9" height="6" rx="0.45" />
        <rect x="13.85" y="5" width="0.9" height="6" rx="0.45" />
        <rect x="9.2" y="11" width="5.55" height="1.4" rx="0.7" />
        <rect x="11" y="12.4" width="2" height="8" rx="1" />
      </g>
    </svg>
  );
}
