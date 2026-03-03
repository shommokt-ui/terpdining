import { useEffect } from 'react';

export default function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="drawer-overlay absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="drawer-panel absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-[#1c1c1c] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-umd-gray">
          <span className="text-base font-bold text-umd-black">{title}</span>
          <button onClick={onClose} className="text-umd-gray-dark hover:text-umd-red p-1 rounded-lg hover:bg-umd-gray-light transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
