export default function ThemeToggle({ theme, onToggle, variant = 'default' }) {
  const isDark = theme === 'dark';
  const trackClass =
    variant === 'onRed'
      ? 'bg-black/25'
      : isDark ? 'bg-[#3a3a3a]' : 'bg-gray-300';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${trackClass}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow transition-transform duration-200 ${
          isDark ? 'translate-x-5 bg-[#1c1c1c] text-white ring-1 ring-white/40' : 'bg-white text-amber-500'
        }`}
      >
        {isDark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5m-15 0H3m15.364-6.364l-1.06 1.06M6.696 17.304l-1.06 1.06m0-12.728l1.06 1.06M17.304 17.304l1.06 1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
        )}
      </span>
    </button>
  );
}
