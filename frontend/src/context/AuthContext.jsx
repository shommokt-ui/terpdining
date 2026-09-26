import { createContext, useContext, useState, useEffect } from 'react';
import { apiGet } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only loading when there's a stored token to validate.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));
  const [authError, setAuthError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const controller = new AbortController();
    apiGet('/api/auth/me', { signal: controller.signal })
      .then((u) => {
        if (controller.signal.aborted) return;
        setUser(u);
        setLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401 || error.status === 403) {
          localStorage.removeItem('token');
          setLoading(false);
        } else {
          // A network outage does not mean the saved login is invalid.
          setAuthError(error.message);
        }
      });
    return () => controller.abort();
  }, [attempt]);

  function retryAuth() {
    setAuthError('');
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  function login(token, userData) {
    localStorage.setItem('token', token);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, retryAuth, browseAsGuest: () => setLoading(false), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
