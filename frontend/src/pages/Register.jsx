import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Box, Button, Container, TextField, Typography, Paper, 
  ToggleButton, ToggleButtonGroup, Alert, Grid, InputAdornment, 
  CircularProgress, useTheme, Link // <--- ADDED LINK IMPORT HERE
} from '@mui/material';
import { 
  Person, Email, Phone, Lock, AdminPanelSettings, Key, ArrowBack, PersonAdd 
} from '@mui/icons-material';

export default function Register() {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [role, setRole] = useState('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form State matched to UserCreate model in backend
  const [formData, setFormData] = useState({
    first_name: '', 
    last_name: '', 
    email: '', 
    phone_number: '', 
    password: '', 
    admin_secret: '' 
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (event, newRole) => { 
    if (newRole !== null) {
      setRole(newRole);
      setError(''); // Clear error on toggle
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Prepare payload matching UserCreate Pydantic model
      const payload = { 
        ...formData, 
        role: role // 'client' or 'admin'
      };
      
      // Remove admin_secret if role is client to avoid validation errors
      if (role === 'client') {
        delete payload.admin_secret;
      }

      await axios.post('http://localhost:8000/api/v1/auth/register', payload);
      
      // Success -> Redirect to Login
      navigate('/login');
    } catch (err) {
      console.error("Registration Error:", err);
      const msg = err.response?.data?.detail || 'Registration failed. Please check your inputs.';
      setError(msg);
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
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(99,102,241,0.1) 0%, rgba(0,0,0,0) 40%)'
    }}>
      
      <Button
        component={RouterLink}
        to="/"
        startIcon={<ArrowBack />}
        sx={{ position: 'absolute', top: 24, left: 24, zIndex: 20, color: 'text.secondary' }}
      >
        Home
      </Button>

      <Container maxWidth="sm">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <Paper 
            elevation={24} 
            sx={{ 
                p: 5, 
                borderRadius: 4, 
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(24, 24, 27, 0.8)', 
                backdropFilter: 'blur(20px)'
            }}
          >
            
            {/* Header Section */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box sx={{ 
                width: 60, height: 60, borderRadius: '50%', 
                bgcolor: role === 'admin' ? 'secondary.main' : 'primary.main', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2,
                boxShadow: `0 0 20px ${role === 'admin' ? theme.palette.secondary.main : theme.palette.primary.main}40`
              }}>
                <PersonAdd sx={{ color: '#fff', fontSize: 30 }} />
              </Box>
              <Typography variant="h4" fontWeight="bold" color="white">Create Account</Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {role === 'admin' ? 'Register authorized personnel only.' : 'Start your secure verification journey.'}
              </Typography>
            </Box>

            {/* Role Toggle */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
              <ToggleButtonGroup 
                value={role} 
                exclusive 
                onChange={handleRoleChange} 
                fullWidth
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, p: 0.5 }}
              >
                <ToggleButton value="client" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                    <Person sx={{ mr: 1 }}/> Client
                </ToggleButton>
                <ToggleButton value="admin" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                    <AdminPanelSettings sx={{ mr: 1 }}/> Admin Agent
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {error && (
              <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                
                {/* Name Fields */}
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth label="First Name" name="first_name" 
                    value={formData.first_name} onChange={handleChange} 
                    required variant="outlined" 
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth label="Last Name" name="last_name" 
                    value={formData.last_name} onChange={handleChange} 
                    required variant="outlined" 
                  />
                </Grid>

                {/* Contact Fields */}
                <Grid item xs={12}>
                  <TextField 
                    fullWidth label="Email Address" name="email" type="email" 
                    value={formData.email} onChange={handleChange} 
                    required variant="outlined" 
                    InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" color="action"/></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField 
                    fullWidth label="Phone Number" name="phone_number" type="tel" 
                    value={formData.phone_number} onChange={handleChange} 
                    required variant="outlined"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" color="action"/></InputAdornment> }}
                  />
                </Grid>

                {/* Security Fields */}
                <Grid item xs={12}>
                  <TextField 
                    fullWidth label="Password" name="password" type="password" 
                    value={formData.password} onChange={handleChange} 
                    required variant="outlined"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Lock fontSize="small" color="action"/></InputAdornment> }}
                  />
                </Grid>

                {/* Admin Secret - Animated */}
                <AnimatePresence>
                  {role === 'admin' && (
                    <Grid item xs={12} component={motion.div} 
                      initial={{ opacity: 0, height: 0, y: -10 }} 
                      animate={{ opacity: 1, height: 'auto', y: 0 }} 
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <TextField 
                        fullWidth label="Admin Secret Key" name="admin_secret" type="password" 
                        value={formData.admin_secret} onChange={handleChange} 
                        required 
                        color="secondary" focused variant="outlined"
                        sx={{ bgcolor: 'rgba(236, 72, 153, 0.05)' }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><Key color="secondary"/></InputAdornment> }}
                        helperText="Required for role verification"
                      />
                    </Grid>
                  )}
                </AnimatePresence>
              </Grid>

              <Button 
                type="submit" 
                fullWidth 
                variant="contained" 
                size="large" 
                disabled={loading}
                sx={{ 
                  mt: 4, mb: 2, py: 1.5, 
                  background: role === 'admin' ? 'linear-gradient(45deg, #ec4899, #8b5cf6)' : 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
              </Button>
            </form>

            <Box textAlign="center" mt={2}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                {/* Now Link is properly imported, so this won't crash */}
                <Link component={RouterLink} to="/login" sx={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 'bold', '&:hover': { textDecoration: 'underline' } }}>
                  Sign In
                </Link>
              </Typography>
            </Box>

          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}