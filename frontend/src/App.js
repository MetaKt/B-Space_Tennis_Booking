import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { I18nextProvider } from 'react-i18next';
import { adminI18n } from './i18n/i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OTPPage from './pages/auth/OTPPage';

// User pages
import HomePage from './pages/user/HomePage';
import BookingFlowPage from './pages/user/BookingFlowPage';
import BookingHistoryPage from './pages/user/BookingHistoryPage';
import ProfilePage from './pages/user/ProfilePage';
import BookingSuccessPage from './pages/user/BookingSuccessPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBookingManagement from './pages/admin/AdminBookingManagement';
import AdminCourtManagement from './pages/admin/AdminCourtManagement';
import AdminCoachManagement from './pages/admin/AdminCoachManagement';
import AdminSettings from './pages/admin/AdminSettings';
import AdminBusinessSummary from './pages/admin/AdminBusinessSummary';
import AdminUserManagement from './pages/admin/AdminUserManagement';

// Route guards
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const UserRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (['admin', 'master_admin'].includes(user?.role)) return <Navigate to="/admin" />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!['admin', 'master_admin'].includes(user?.role)) return <Navigate to="/" />;
  return children;
};

const MasterRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'master_admin') return <Navigate to="/admin" />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (isAuthenticated) {
    if (['admin', 'master_admin'].includes(user?.role)) return <Navigate to="/admin" />;
    return <Navigate to="/" />;
  }
  return children;
};

// Wraps admin pages in the Thai-only i18n instance
const Admin = ({ children }) => <I18nextProvider i18n={adminI18n}>{children}</I18nextProvider>;

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/otp" element={<OTPPage />} />

      {/* User Routes (mobile format) */}
      <Route path="/" element={<UserRoute><HomePage /></UserRoute>} />
      <Route path="/book" element={<UserRoute><BookingFlowPage /></UserRoute>} />
      <Route path="/booking-success/:id" element={<UserRoute><BookingSuccessPage /></UserRoute>} />
      <Route path="/history" element={<UserRoute><BookingHistoryPage /></UserRoute>} />
      <Route path="/profile" element={<UserRoute><ProfilePage /></UserRoute>} />

      {/* Admin Routes — wrapped in the Thai-pinned i18n instance so staff always see Thai */}
      <Route path="/admin" element={<AdminRoute><Admin><AdminDashboard /></Admin></AdminRoute>} />
      <Route path="/admin/bookings" element={<AdminRoute><Admin><AdminBookingManagement /></Admin></AdminRoute>} />
      <Route path="/admin/courts" element={<AdminRoute><Admin><AdminCourtManagement /></Admin></AdminRoute>} />
      <Route path="/admin/coaches" element={<AdminRoute><Admin><AdminCoachManagement /></Admin></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><Admin><AdminUserManagement /></Admin></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><Admin><AdminSettings /></Admin></AdminRoute>} />
      <Route path="/admin/business-summary" element={<MasterRoute><Admin><AdminBusinessSummary /></Admin></MasterRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <Toaster position="top-center" toastOptions={{
            duration: 3000,
            style: { fontFamily: "'Poppins', 'FCVision', sans-serif", fontSize: '14px' }
          }} />
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
