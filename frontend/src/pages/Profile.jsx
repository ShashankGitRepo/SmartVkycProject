import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Box, Container, Grid, Paper, Typography, TextField, Button, 
  Avatar, Chip, Alert, InputAdornment, Divider, Stack
} from '@mui/material';
import { 
  ArrowBack, Logout, Save, Person, Email, Phone, 
  CalendarToday, AdminPanelSettings, VerifiedUser, CheckCircle, Warning
} from '@mui/icons-material';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [isVerified, setIsVerified] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    birth_date: '',
    role: ''
  });

  // Fetch current user data and verification status
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch User Data
        const userRes = await axios.get('/api/v1/users/me');
        setFormData({
          first_name: userRes.data.first_name || '',
          last_name: userRes.data.last_name || '',
          email: userRes.data.email || '',
          phone_number: userRes.data.phone_number || '',
          birth_date: userRes.data.birth_date || '',
          role: userRes.data.role || 'client'
        });
        
        // 2. Fetch Verification Status (Client Only)
        if (userRes.data.role === 'client') {
            const statusRes = await axios.get('/api/v1/users/status');
            setIsVerified(statusRes.data.is_verified);
        }

      } catch (err) {
        setMsg({ type: 'error', text: 'Failed to load profile data.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMsg({ type: '', text: '' });

    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birth_date: formData.birth_date || null
      };

      const res = await axios.put('/api/v1/users/me', payload);
      
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
      setFormData(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setUpdating(false);
    }
  };
  
  // Display name initial (e.g., 'BC')
  const displayInitials = (formData.first_name?.[0] || 'U') + (formData.last_name?.[0] || '');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pt: 4, pb: 8 }}>
      <Container maxWidth="lg">
        
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={6}>
          <Button 
            component={RouterLink} 
            to="/dashboard" 
            startIcon={<ArrowBack />} 
            color="inherit"
            sx={{ opacity: 0.8, '&:hover': { opacity: 1 } }}
          >
            Back to Dashboard
          </Button>
          <Button 
            onClick={() => { logout(); navigate('/login'); }} 
            startIcon={<Logout />} 
            color="error" 
            variant="outlined"
          >
            Sign Out
          </Button>
        </Box>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Grid container spacing={4}>
            
            {/* Left Column: Centered Profile Card (Reduced Size) */}
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', justifyContent: 'center', height: '100%' }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, // Reduced padding
                    borderRadius: 4, 
                    bgcolor: '#18181b', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    width: '100%', // Take full width of its container
                    maxWidth: 300, // Make card centered and max 300px wide
                    textAlign: 'center',
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  {/* Background Accent */}
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 8,
                    background: formData.role === 'admin' 
                      ? 'linear-gradient(90deg, #ec4899, #8b5cf6)' 
                      : 'linear-gradient(90deg, #6366f1, #3b82f6)',
                  }} />

                  <Box sx={{ position: 'relative', mt: 4 }}>
                    <Avatar 
                      sx={{ 
                        width: 80, height: 80, mx: 'auto', mb: 2, 
                        bgcolor: formData.role === 'admin' ? 'secondary.main' : 'primary.main', 
                        fontSize: '1.8rem', fontWeight: 'bold',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.5)'
                      }}
                    >
                      {displayInitials}
                    </Avatar>
                  </Box>
                  
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {formData.first_name} {formData.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {formData.email}
                  </Typography>

                  <Chip 
                    icon={formData.role === 'admin' ? <AdminPanelSettings fontSize="small"/> : <VerifiedUser fontSize="small"/>} 
                    label={formData.role?.toUpperCase() || 'USER'} 
                    color={formData.role === 'admin' ? "secondary" : "primary"}
                    variant="filled"
                    sx={{ px: 1, fontWeight: 'bold' }}
                  />

                  {/* Verification Status Block (Dynamic) */}
                  {formData.role === 'client' && (
                    <Box mt={4} p={2} width="100%" bgcolor="rgba(255,255,255,0.03)" borderRadius={2} border={`1px solid ${isVerified ? '#10b981' : '#f59e0b'}`}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        IDENTITY VERIFICATION
                      </Typography>
                      <Stack direction="row" justifyContent="center" alignItems="center" gap={1}>
                        {isVerified ? (
                          <CheckCircle color="success" />
                        ) : (
                          <Warning color="warning" />
                        )}
                        <Typography variant="body2" fontWeight="bold" color={isVerified ? 'success.main' : 'warning.main'}>
                          {isVerified ? "VERIFIED (Full Access)" : "PENDING REVIEW"}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                </Paper>
              </Box>
            </Grid>

            {/* Right Column: Edit Form */}
            <Grid item xs={12} md={8}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 5, borderRadius: 4, 
                  bgcolor: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
                  height: '100%' 
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={4}>
                  <Person color="primary" />
                  <Typography variant="h6" fontWeight="bold">Personal Details</Typography>
                </Box>

                {msg.text && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 24 }}>
                    <Alert severity={msg.type} variant="filled" sx={{ borderRadius: 2 }}>{msg.text}</Alert>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField 
                        fullWidth label="First Name" name="first_name" 
                        value={formData.first_name} onChange={handleChange} 
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField 
                        fullWidth label="Last Name" name="last_name" 
                        value={formData.last_name} onChange={handleChange} 
                        variant="outlined"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField 
                        fullWidth label="Email" value={formData.email} 
                        disabled 
                        InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" sx={{ color: 'text.disabled' }}/></InputAdornment> }}
                        helperText="Email cannot be changed"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField 
                        fullWidth label="Phone Number" value={formData.phone_number || ''} 
                        disabled 
                        InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" sx={{ color: 'text.disabled' }}/></InputAdornment> }}
                        helperText="Contact support to update phone"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField 
                        fullWidth label="Date of Birth" name="birth_date" type="date" 
                        value={formData.birth_date || ''} onChange={handleChange} 
                        InputLabelProps={{ shrink: true }} 
                        InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday fontSize="small"/></InputAdornment> }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                      <Button 
                        type="submit" 
                        variant="contained" 
                        size="large" 
                        disabled={updating} 
                        startIcon={<Save />}
                        sx={{ 
                          px: 4, 
                          background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                          boxShadow: '0 4px 20px rgba(99,102,241,0.3)'
                        }}
                      >
                        {updating ? 'Saving Changes...' : 'Save Profile'}
                      </Button>
                    </Grid>
                  </Grid>
                </form>
              </Paper>
            </Grid>

          </Grid>
        </motion.div>
      </Container>
    </Box>
  );
}