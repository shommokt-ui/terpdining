import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigationState } from '../context/NavigationStateContext';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { menu, patchMenu } = useNavigationState();

  const isActive = (path) => location.pathname === path;
  const hideAuthLinks = location.pathname === '/register';
  const onMenuPage = location.pathname === '/menu';

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
            {onMenuPage && (
              <button
                onClick={() => patchMenu({ showFavManager: !menu.showFavManager })}
                className={`p-2 rounded-lg transition-colors ${menu.showFavManager ? 'bg-white text-umd-red dark:bg-white/20 dark:text-white' : 'text-white hover:bg-white/10'}`}
                title="My favorites"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={menu.favoritesCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            )}

            <ThemeToggle theme={theme} onToggle={toggleTheme} variant="onRed" />
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
                  <span className="text-sm text-umd-body truncate max-w-[140px]" title={user.email}>
                    {user.email.split('@')[0]}
                  </span>
                  <Link
                    to="/settings"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/settings') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}
                    title="Settings"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
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
                  <Link
                    to="/settings"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/settings') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}
                    title="Settings"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                  <Link to="/login" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/login') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Log In</Link>
                  <Link to="/register" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/register') ? 'bg-umd-red text-white' : 'text-umd-body hover:bg-umd-gray-light'}`}>Sign Up</Link>
                </div>
              </>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
