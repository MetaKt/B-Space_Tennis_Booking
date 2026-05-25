import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, userAPI } from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await authAPI.getMe();
      setUser(res.data.data);
      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (token, userData, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try { await authAPI.logout(refreshToken); } catch (_) {}
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (data) => {
    setUser(prev => ({ ...prev, ...data }));
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...stored, ...data }));
  };

  const updateLanguage = async (lang) => {
    try {
      await userAPI.updateLanguage(lang);
      updateUser({ preferredLanguage: lang });
      localStorage.setItem('language', lang);
    } catch (error) {
      console.error('Failed to update language');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      login,
      logout,
      updateUser,
      updateLanguage,
      loadUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
