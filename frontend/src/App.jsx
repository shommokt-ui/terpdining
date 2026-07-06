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
import RecipePage from './pages/RecipePage';
import TrackerPage from './pages/TrackerPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-umd-body">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;

  const hideNavbar = location.pathname === '/login';

  return (
    <>
      {!hideNavbar && <Navbar />}
      {!hideNavbar && <AnnouncementBanner />}
      <div key={location.pathname} className="page-enter pb-16 md:pb-0">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/menu" /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/menu" /> : <RegisterPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/menu" /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/recipe" element={<ProtectedRoute><RecipePage /></ProtectedRoute>} />
        <Route path="/tracker" element={<ProtectedRoute><TrackerPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
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
              <NavigationStateProvider>
                <AppRoutes />
              </NavigationStateProvider>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
