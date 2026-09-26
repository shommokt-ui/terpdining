import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationStateProvider } from './context/NavigationStateContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import AnnouncementBanner from './components/AnnouncementBanner';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MenuPage from './pages/MenuPage';
import TrackerPage from './pages/TrackerPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfUsePage from './pages/TermsOfUsePage';

// The Markdown renderer is only needed for recipes; keep it out of startup.
const RecipePage = lazy(() => import('./pages/RecipePage'));

function SessionNavigation({ children }) {
  const { user } = useAuth();
  // Clear private page state when accounts change, including on logout.
  return <NavigationStateProvider key={user?.id ?? 'guest'}>{children}</NavigationStateProvider>;
}

function AppRoutes() {
  const { user, loading, authError, retryAuth, browseAsGuest } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center text-umd-body">
      <p role={authError ? 'alert' : 'status'}>{authError || 'Checking your saved sign-in…'}</p>
      {authError && <button onClick={retryAuth} className="min-h-11 px-4 font-semibold text-umd-red">Try again</button>}
      {authError && <button onClick={browseAsGuest} className="min-h-11 px-4 underline">Continue browsing as a guest</button>}
    </div>
  );

  const hideNavbar = location.pathname === '/login';

  return (
    <>
      {!hideNavbar && <Navbar />}
      {!hideNavbar && <AnnouncementBanner />}
      <div key={location.pathname} className="page-enter pb-16 md:pb-0">
      <Suspense fallback={<p role="status" className="p-8 text-center text-umd-body">Loading recipes…</p>}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/menu" /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/menu" /> : <RegisterPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/menu" /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/recipe" element={<RecipePage />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfUsePage />} />
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
      </Suspense>
      </div>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <SessionNavigation>
                <AppRoutes />
              </SessionNavigation>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
