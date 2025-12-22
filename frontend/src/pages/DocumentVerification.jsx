import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Box, Button, Container, Typography, Paper, Stepper, Step, StepLabel, 
  Alert, CircularProgress 
} from '@mui/material';
import { CloudUpload, CheckCircle, Description } from '@mui/icons-material';
import { motion } from 'framer-motion';

const steps = ['Upload Document', 'Processing', 'Verification Result'];

export default function DocumentVerification() {
  const [file, setFile] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setActiveStep(1);
    setError('');

    const formData = new FormData();
    formData.append('document', file);
    
    // NOTE: We removed the dummy video logic. 
    // We now only send the document, as discussed.

    try {
        const res = await axios.post('/api/v1/verify', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Handle backend response
        setResult(res.data);
        setActiveStep(2);
        
    } catch (err) {
        console.error("Verification Error:", err);
        // Extract the real error message from the backend if available
        const backendMessage = err.response?.data?.detail || "Server connection failed";
        setError(backendMessage);
        setActiveStep(0);
    } finally {
        setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom align="center">
        Identity Verification
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 6 }}>
        {steps.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      <Paper elevation={24} sx={{ p: 6, borderRadius: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
        {activeStep === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <input
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              id="raised-button-file"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="raised-button-file">
              <Box 
                sx={{ 
                  border: '2px dashed rgba(255,255,255,0.2)', 
                  borderRadius: 4, 
                  p: 6, 
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                {file ? (
                  <Description sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                ) : (
                  <CloudUpload sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                )}
                <Typography variant="h6">
                  {file ? file.name : "Click to Upload ID (JPG/PNG/PDF)"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Max file size: 5MB
                </Typography>
              </Box>
            </label>
            
            {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}

            <Button 
              variant="contained" 
              size="large" 
              onClick={handleUpload}
              disabled={!file}
              sx={{ mt: 4, px: 6 }}
            >
              Upload & Verify
            </Button>
          </motion.div>
        )}

        {activeStep === 1 && (
          <Box sx={{ py: 8 }}>
            <CircularProgress size={60} thickness={4} />
            <Typography variant="h6" sx={{ mt: 3 }}>
              Analyzing Document Security Features...
            </Typography>
          </Box>
        )}

        {activeStep === 2 && result && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
            {/* Check specific document status from backend response */}
            {result.checks?.document?.status === 'VERIFIED' || result.decision === 'PASS' || result.decision === 'PARTIAL_PASS' ? (
              <>
                <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" color="success.main" fontWeight="bold" gutterBottom>
                  Verification Successful
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                  Your ID has been processed. You can now proceed to the video call.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </>
            ) : (
              <>
                <Alert severity="error" sx={{ mb: 3 }}>
                  Verification Failed: {result.reasons?.[0] || result.checks?.document?.reason || "Unknown Error"}
                </Alert>
                <Button onClick={() => { setFile(null); setActiveStep(0); }}>Try Again</Button>
              </>
            )}
          </motion.div>
        )}
      </Paper>
    </Container>
  );
}