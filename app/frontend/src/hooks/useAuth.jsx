import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true); // assume auth until we know

  useEffect(() => {
    // Check if auth is enabled on this deploy
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(data => {
        setAuthEnabled(data.authEnabled);
        if (!data.authEnabled) {
          // No auth needed — skip login
          setUser({ name: 'Demo', role: 'admin' });
          setLoading(false);
          return;
        }
        // Auth enabled — validate token
        if (!token) { setLoading(false); return; }
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(u => { setUser(u); setLoading(false); })
          .catch(() => { logout(); setLoading(false); });
      })
      .catch(() => { setLoading(false); });
  }, [token]);

  async function login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  const isAuthenticated = !authEnabled || (!!token && !!user);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading, isAuthenticated, authEnabled }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
