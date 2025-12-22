import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from './theme';

import Layout from './components/Layout'; 

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import DocumentVerification from './pages/DocumentVerification';
import VideoConference from './pages/VideoConference';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null; // Or a loading spinner
  if (!user) return <Navigate to="/login" />;
  
  // Role Check: If role is required but user doesn't have it, redirect
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
};

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          {/* The Layout component handles the Sidebar logic automatically */}
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['client', 'admin']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute allowedRoles={['client', 'admin']}>
                  <Profile />
                </ProtectedRoute>
              } />

              <Route path="/verify-document" element={
                <ProtectedRoute allowedRoles={['client']}>
                  <DocumentVerification />
                </ProtectedRoute>
              } />

              {/* Meeting Room (Layout component will automatically hide Sidebar here) */}
              <Route path="/meet/:meetingCode" element={
                <ProtectedRoute allowedRoles={['client', 'admin']}>
                  <VideoConference />
                </ProtectedRoute>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}