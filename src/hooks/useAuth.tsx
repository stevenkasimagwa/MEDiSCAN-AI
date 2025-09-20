import { useState, useEffect, createContext, useContext } from 'react';
import { useToast } from '@/components/ui/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import axios from 'axios';
import { normalizeRole } from '@/hooks/roleUtils';

interface User {
  id: number;
  username: string;
  role?: string | null;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signUp: (username: string, password: string, name?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  doctorName: string | null;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  // Start as loading while we validate any stored token
  const [loading, setLoading] = useState(true);
  // Seed user from localStorage to avoid flashes where role/username aren't available
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) {
          // Ensure role is normalized to a lowercase string
          if (parsed.role) parsed.role = normalizeRole(parsed.role);
            // If this is the built-in admin user, enforce admin role locally to avoid stale state
            try {
              if (parsed.username === 'admin' && parsed.role !== 'admin') {
                parsed.role = 'admin';
                localStorage.setItem('user', JSON.stringify(parsed));
              }
            } catch (e) {
              // ignore
            }
          setUser(parsed);
          setDoctorName(parsed.name || null);
          setUserRole(parsed.role || null);
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Validate stored JWT by calling backend /auth/me. If no token, show login immediately.
    const token = localStorage.getItem('auth_token');
    console.debug('[Auth] init start, token present?', !!token);

    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('[Auth] /auth/me request timed out');
      setLoadError('Auth validation timed out.');
      setLoading(false);
    }, 3000);

    (async () => {
      try {
        const resp = await fetch('http://localhost:3001/api/auth/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          console.warn('[Auth] /auth/me returned non-OK', resp.status);
          // token invalid or expired
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          setUser(null);
          setDoctorName(null);
          setUserRole(null);
          setLoadError('Session expired. Please sign in.');
          setLoading(false);
          return;
        }

        const meUser = await resp.json();
        if (meUser) {
          // normalize role and store authoritative user
          if (meUser.role) meUser.role = normalizeRole(meUser.role);
          localStorage.setItem('user', JSON.stringify(meUser));
          setUser(meUser);
          setDoctorName(meUser.name || null);
          setUserRole(meUser.role || null);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // already handled via timeout
        } else {
          console.error('[Auth] /auth/me validation failed', err);
          setLoadError('Failed to validate authentication.');
          // be conservative: clear possibly-bad token
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
  // sign in via backend

      const response = await axios.post('http://localhost:3001/api/auth/signin', {
        username,
        password
      });

      if (response.data.error) return { error: response.data.error };

      const loggedUser: User = response.data.user;
  // Store JWT under the unified key 'auth_token' to match apiService
  localStorage.setItem('auth_token', response.data.access_token);

      // Fetch authoritative user info (in case backend has updated fields) using the token
      try {
        const meResp = await axios.get('http://localhost:3001/api/auth/me', { headers: { Authorization: `Bearer ${response.data.access_token}` } });
        const meUser = meResp.data;
        if (meUser) {
          // If backend provided user, prefer it but normalize role
          if (meUser.role) meUser.role = normalizeRole(meUser.role);
          localStorage.setItem('user', JSON.stringify(meUser));
          setUser(meUser);
          setDoctorName(meUser.name || null);
          setUserRole(meUser.role || null);
        } else {
          // fallback: use the user returned from signin but normalize role
          // prefer role from JWT payload if available
          try {
            const token = response.data.access_token;
            if (token) {
              const payload = JSON.parse(atob(token.split('.')[1]));
              if (payload && payload.role) {
                loggedUser.role = normalizeRole(String(payload.role));
              }
            }
          } catch (e) {
            // ignore JWT decode errors
          }
          if (loggedUser.role) loggedUser.role = normalizeRole(loggedUser.role);
          localStorage.setItem('user', JSON.stringify(loggedUser));
          setUser(loggedUser);
          setDoctorName(loggedUser.name || null);
          setUserRole(loggedUser.role || null);
        }
      } catch (e) {
        // fallback to provided user
        try {
          const token = response.data.access_token;
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload && payload.role) {
              loggedUser.role = normalizeRole(String(payload.role));
            }
          }
        } catch (e) {
          // ignore
        }
        if (loggedUser.role) loggedUser.role = normalizeRole(loggedUser.role);
        localStorage.setItem('user', JSON.stringify(loggedUser));
        setUser(loggedUser);
        setDoctorName(loggedUser.name || null);
        setUserRole(loggedUser.role || null);
      }

      return {};
    } catch (error) {
      console.error(error);
      return { error: 'Unable to sign in. Please check your credentials.' };
    }
  };

  const signUp = async (username: string, password: string, name?: string) => {
    try {
      const response = await axios.post('http://localhost:3001/api/auth/signup', {
        username,
        password,
        name
      });

      if (response.data.error) return { error: response.data.error };

      toast({
        title: 'Success',
        description: 'Account created successfully! You can now log in.'
      });

      return {};
    } catch (error: any) {
  console.error('Signup error:', error.response?.data || error.message);
  return { error: 'Unable to sign up. Try again later.' };
}

  };

  const signOut = async () => {
    try {
      // notify backend for audit log
      try {
        const token = localStorage.getItem('auth_token');
        await fetch('http://localhost:3001/api/auth/logout', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      } catch (e) {
        // ignore logout errors
      }

      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setUser(null);
      setDoctorName(null);
      setUserRole(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      doctorName,
      userRole
    }}>
      {/* While auth is initializing, show a spinner. The pages/components decide whether to render the Auth UI when not authenticated. */}
      {loading ? <LoadingSpinner /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
