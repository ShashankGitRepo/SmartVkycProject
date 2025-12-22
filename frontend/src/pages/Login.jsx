import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Box, Button, Container, TextField, Typography, Paper, 
  Alert, Link, InputAdornment, CircularProgress, ToggleButton, ToggleButtonGroup 
} from '@mui/material';
import { Email, Lock, ArrowForward, ArrowBack, Person, AdminPanelSettings } from '@mui/icons-material';

export default function Login() {
  const [role, setRole] = useState('client'); // 'client' or 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const handleRoleChange = (event, newRole) => {
    if (newRole !== null) {
      setRole(newRole);
      setError(''); // Clear error when switching tabs
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Attempt Login
      const actualRole = await login(email, password);
      
      // 2. Verify Role Match (Requirement C)
      if (actualRole !== role) {
        // User is logged in, but selected the wrong tab.
        // Security measure: Logout and show error.
        logout(); 
        setError(`Access Denied: This account is not authorized as ${role.toUpperCase()}. Please switch tabs.`);
        setLoading(false);
        return;
      }

      // 3. Success Redirect
      navigate('/dashboard');
    } catch (err) {
      console.error("Login Error:", err);
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      bgcolor: 'background.default',
      backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.05) 0%, rgba(0,0,0,0) 50%)'
    }}>
      
      <Button 
        component={RouterLink} 
        to="/" 
        startIcon={<ArrowBack />} 
        sx={{ position: 'absolute', top: 24, left: 24, color: 'text.secondary' }}
      >
        Back to Home
      </Button>

      <Container maxWidth="xs">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Paper 
            elevation={24} 
            sx={{ 
              p: 4, 
              borderRadius: 4, 
              background: 'rgba(24, 24, 27, 0.8)', 
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}
          >
            {/* Role Selector */}
            <Box mb={4}>
              <ToggleButtonGroup
                value={role}
                exclusive
                onChange={handleRoleChange}
                fullWidth
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}
              >
                <ToggleButton value="client" sx={{ py: 1.5, textTransform: 'none', fontWeight: 600 }}>
                  <Person sx={{ mr: 1, fontSize: 20 }} /> Client
                </ToggleButton>
                <ToggleButton value="admin" sx={{ py: 1.5, textTransform: 'none', fontWeight: 600 }}>
                  <AdminPanelSettings sx={{ mr: 1, fontSize: 20 }} /> Admin Agent
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box textAlign="center" mb={4}>
              <Typography variant="h4" fontWeight="800" color="white" gutterBottom>
                {role === 'admin' ? 'Agent Login' : 'Welcome Back'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {role === 'admin' ? 'Secure access for verification officers.' : 'Sign in to continue your verification.'}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField 
                fullWidth 
                label="Email Address" 
                variant="outlined" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                sx={{ mb: 2.5 }} 
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment>,
                  sx: { borderRadius: 2 }
                }} 
              />
              <TextField 
                fullWidth 
                label="Password" 
                type="password" 
                variant="outlined" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                sx={{ mb: 4 }} 
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment>,
                  sx: { borderRadius: 2 }
                }} 
              />
              
              <Button 
                type="submit" 
                fullWidth 
                variant="contained" 
                size="large" 
                disabled={loading} 
                endIcon={!loading && <ArrowForward />} 
                sx={{ 
                  py: 1.5, 
                  background: role === 'admin' ? 'linear-gradient(45deg, #ec4899, #8b5cf6)' : 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)'
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit"/> : 'Sign In'}
              </Button>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Don't have an account?{' '}
                <Link component={RouterLink} to="/register" fontWeight="600" color="primary">
                  Create Account
                </Link>
              </Typography>
            </Box>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}