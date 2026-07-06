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
              <>
                {/* favorites */}
                <button
                  onClick={() => patchMenu({ showFavManager: !menu.showFavManager })}
                  className={`p-2 rounded-lg transition-colors ${menu.showFavManager ? 'bg-white text-umd-red' : 'text-white hover:bg-white/10'}`}
                  title="My favorites"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={menu.favoritesCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>

                {/* legend */}
                <button
                  onClick={() => patchMenu({ legendOpen: true })}
                  className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                  title="Icon legend"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </>
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
    </>
  );
}
