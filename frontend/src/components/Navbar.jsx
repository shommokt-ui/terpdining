import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => location.pathname === path;
  const hideAuthLinks = location.pathname === '/register';

  const linkClass = (path) =>
    `px-3 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors whitespace-nowrap ${
      isActive(path) ? 'bg-white text-umd-red' : 'text-white/90 hover:bg-white/10'
    }`;

  return (
    <>
      {/* top bar */}
      <div className="bg-umd-red px-4 z-50 relative pt-[env(safe-area-inset-top)]">
        <div className="umd-container w-full h-11 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white font-extrabold text-lg uppercase tracking-wide shrink-0">
            <Logo className="w-7 h-7" />
            TerpDining
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle theme={theme} onToggle={toggleTheme} variant="onRed" />

            {/* hamburger */}
            <button
              className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* desktop nav */}
      {!(hideAuthLinks && !user) && (
        <nav className="bg-white dark:bg-[#1c1c1c] border-b border-umd-gray shadow-sm hidden md:block">
          <div className="umd-container px-4 h-11 flex items-center justify-between">
            {user ? (
              <>
                <div className="flex items-center gap-1">
                  <Link to="/menu" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/menu') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Menu</Link>
                  <Link to="/recipe" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/recipe') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Recipes</Link>
                  <Link to="/tracker" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/tracker') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Tracker</Link>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to="/settings"
                    className={`text-sm truncate max-w-[140px] hover:underline ${isActive('/settings') ? 'text-umd-red font-semibold' : 'text-umd-body hover:text-umd-red'}`}
                    title="Settings"
                  >
                    {user.email.split('@')[0]}
                  </Link>
                  <button onClick={logout} className="text-umd-gray-dark hover:text-umd-red text-sm underline whitespace-nowrap">
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <Link to="/menu" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/menu') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Menu</Link>
                  <Link to="/recipe" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/recipe') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Recipes</Link>
                  <Link to="/tracker" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/tracker') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Tracker</Link>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/login" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/login') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Log In</Link>
                  <Link to="/register" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/register') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Sign Up</Link>
                </div>
              </>
            )}
          </div>
        </nav>
      )}

      {/* mobile menu */}
      {mobileOpen && !(hideAuthLinks && !user) && (
        <div className="md:hidden bg-umd-red-dark border-t border-white/10 px-4 py-3 flex flex-col gap-1 z-50 relative">
          {user ? (
            <>
              <Link to="/menu" onClick={() => setMobileOpen(false)} className={linkClass('/menu')}>Menu</Link>
              <Link to="/recipe" onClick={() => setMobileOpen(false)} className={linkClass('/recipe')}>Recipe Creator</Link>
              <Link to="/tracker" onClick={() => setMobileOpen(false)} className={linkClass('/tracker')}>Macro Tracker</Link>
              <Link to="/settings" onClick={() => setMobileOpen(false)} className={linkClass('/settings')}>Settings</Link>
              <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between">
                <span className="text-white/80 text-sm">{user.email.split('@')[0]}</span>
                <button onClick={() => { logout(); setMobileOpen(false); }} className="text-white/70 hover:text-white text-sm underline">
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/menu" onClick={() => setMobileOpen(false)} className={linkClass('/menu')}>Menu</Link>
              <Link to="/recipe" onClick={() => setMobileOpen(false)} className={linkClass('/recipe')}>Recipe Creator</Link>
              <Link to="/tracker" onClick={() => setMobileOpen(false)} className={linkClass('/tracker')}>Macro Tracker</Link>
              <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-3">
                <Link to="/login" onClick={() => setMobileOpen(false)} className={linkClass('/login')}>Log In</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className={linkClass('/register')}>Sign Up</Link>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
