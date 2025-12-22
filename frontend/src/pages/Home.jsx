import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography, Grid, Card, CardContent, Stack, useTheme, Chip } from '@mui/material';
import { 
  Videocam, VerifiedUser, ArrowForward, Lock, Shield, 
  GppGood, FaceRetouchingNatural, Fingerprint, History, 
  LocationOn, Assessment 
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Home() {
  const theme = useTheme();

  // Animation Variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8 } }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', overflowX: 'hidden' }}>
      
      <Navbar />

      {/* --- HERO SECTION --- */}
      <Box sx={{ position: 'relative', pt: { xs: 12, md: 20 }, pb: { xs: 10, md: 16 }, overflow: 'hidden' }}>
        
        {/* Animated Background Gradient */}
        <Box
          component={motion.div}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
          sx={{
            position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
            width: '100vw', height: '100vw', maxWidth: '1200px', maxHeight: '1200px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
            zIndex: 0, pointerEvents: 'none'
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
            
            <Chip 
              icon={<Shield sx={{ fontSize: '1rem !important', color: '#4ade80' }} />} 
              label="Next-Gen Video KYC Platform" 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.05)', 
                color: 'text.secondary', 
                border: '1px solid rgba(255,255,255,0.1)',
                mb: 4, px: 1, py: 0.5
              }} 
            />

            <Typography variant="h1" fontWeight="900" gutterBottom sx={{ 
              fontSize: { xs: '2.5rem', md: '5rem' },
              lineHeight: 1.1,
              background: 'linear-gradient(to right, #fff, #94a3b8)',
              backgroundClip: 'text',
              textFillColor: 'transparent'
            }}>
              Secure Identity <br />
              <span style={{ color: '#6366f1', textFillColor: '#6366f1' }}>Verification AI.</span>
            </Typography>
            
            <Typography variant="h5" color="text.secondary" sx={{ mb: 6, maxWidth: 800, mx: 'auto', lineHeight: 1.6 }}>
              Our platform revolutionizes digital onboarding by integrating <strong>Real-Time Deepfake Detection</strong> and <strong>Active Liveness Checks</strong> directly into video calls. We ensure that the person on the other side of the screen is real, present, and verified against their official government documents.
            </Typography>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button 
                component={RouterLink} 
                to="/register" 
                variant="contained" 
                size="large" 
                endIcon={<ArrowForward />} 
                sx={{ fontSize: '1.1rem', px: 5, py: 1.8, borderRadius: 4, background: 'linear-gradient(45deg, #6366f1, #8b5cf6)', boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)' }}
              >
                Start Verification
              </Button>
              <Button 
                component={RouterLink} 
                to="/login" 
                variant="outlined" 
                size="large" 
                startIcon={<Lock />}
                sx={{ fontSize: '1.1rem', px: 5, py: 1.8, borderRadius: 4, borderColor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.05)' } }}
              >
                Agent Console
              </Button>
            </Stack>
          </motion.div>
        </Container>
      </Box>

      {/* --- IMPORTANCE & FUNCTIONALITY SECTION --- */}
      <Box sx={{ py: 12, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={8} justifyContent="center">
            
            {/* Text Content */}
            <Grid item xs={12} md={10}>
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
                <Box textAlign="center" mb={6}>
                  <Typography variant="h3" fontWeight="bold" gutterBottom>Why This Technology Matters</Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.8 }}>
                    In an era of AI-generated media, traditional KYC methods are vulnerable. 
                    Our system solves this by analyzing video feeds frame-by-frame to detect subtle artifacts of synthetic media.
                  </Typography>
                </Box>
                
                <Stack spacing={4}>
                  <FeatureRow 
                    icon={<FaceRetouchingNatural color="secondary" />} 
                    title="Deepfake Prevention" 
                    desc="Neural networks analyze micro-expressions and eye movements to detect AI-generated tampering. The system flags unnatural muscle behavior in real-time, instantly stopping synthetic videos and face-swaps." 
                  />
                  <FeatureRow 
                    icon={<GppGood color="success" />} 
                    title="Regulatory Compliance" 
                    desc="Fully compliant with global AML/KYC standards. We securely capture user data, maintain immutable audit trails, and ensure that only verified, genuine humans pass the regulatory checks." 
                  />
                  <FeatureRow 
                    icon={<VerifiedUser color="info" />} 
                    title="Active Liveness Detection" 
                    desc="The system challenges users with randomized prompts (e.g., 'Turn Left', 'Blink') to prove physical presence. This Challenge-Response mechanism effectively neutralizes spoofing attacks using photos, masks, or pre-recorded video." 
                  />
                </Stack>
              </motion.div>
            </Grid>

          </Grid>
        </Container>
      </Box>

      {/* --- DETAILED FEATURES GRID --- */}
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <Box mb={10} textAlign="center">
          <Typography variant="h4" fontWeight="bold" mb={2}>Comprehensive Security Suite</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            A complete ecosystem of security tools designed to build trust, ensure compliance, and eliminate identity fraud.
          </Typography>
        </Box>

        <Grid container spacing={4} justifyContent="center">
          {/* Row 1 */}
          <FeatureCard 
            icon={<Videocam sx={{ fontSize: 40, color: '#6366f1' }}/>} 
            title="Encrypted Video Stream" 
            desc="AES-256 encrypted HD video calls powered by Agora. Low-latency streaming that ensures strict GDPR compliance and total data privacy." 
          />
          <FeatureCard 
            icon={<FaceRetouchingNatural sx={{ fontSize: 40, color: '#ec4899' }}/>} 
            title="AI Deepfake Analyzer" 
            desc="Multi-modal neural networks scan frames for pixel inconsistencies and lighting artifacts, flagging synthetic media with 99.8% accuracy." 
          />
          <FeatureCard 
            icon={<Fingerprint sx={{ fontSize: 40, color: '#10b981' }}/>} 
            title="Biometric Verification" 
            desc="Real-time 1:1 facial matching against government IDs. Advanced liveness scoring instantly rejects printed photos or screen replays." 
          />
          
          {/* Row 2 */}
          <FeatureCard 
            icon={<History sx={{ fontSize: 40, color: '#f59e0b' }}/>} 
            title="Smart Audit Logs" 
            desc="Immutable forensic trails for every session. Automatically logs IP addresses, device fingerprints, and timestamps for regulatory audits." 
          />
          <FeatureCard 
            icon={<LocationOn sx={{ fontSize: 40, color: '#ef4444' }}/>} 
            title="Geo-Fencing & IP Check" 
            desc="Restrict onboarding to specific regions. Automatically block high-risk connections from VPNs, TOR networks, and anonymous proxies." 
          />
          <FeatureCard 
            icon={<Assessment sx={{ fontSize: 40, color: '#3b82f6' }}/>} 
            title="Real-Time Risk Scoring" 
            desc="Dynamic 'Fraud Probability Score' generated live. Analyzes 50+ data points to allow agents to make instant, data-driven decisions." 
          />
        </Grid>
      </Container>

      {/* --- CALL TO ACTION --- */}
      <Box sx={{ py: 12, bgcolor: 'rgba(99,102,241,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold" gutterBottom>Ready to secure your onboarding?</Typography>
          <Typography color="text.secondary" mb={6} sx={{ fontSize: '1.1rem' }}>
            Join the platform that stops fraud before it starts.
          </Typography>
          <Button 
            component={RouterLink} 
            to="/register" 
            variant="contained" 
            size="large" 
            sx={{ fontSize: '1.2rem', px: 6, py: 2, borderRadius: 4, background: '#fff', color: '#000', '&:hover': { background: '#e2e8f0' } }}
          >
            Get Started Now
          </Button>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}

// --- SUB COMPONENTS ---

const FeatureRow = ({ icon, title, desc }) => (
  <Box display="flex" gap={3} alignItems="flex-start" sx={{ 
    p: 3, 
    borderRadius: 4, 
    bgcolor: 'rgba(255,255,255,0.02)', 
    border: '1px solid rgba(255,255,255,0.03)',
    transition: 'transform 0.2s',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', transform: 'translateX(5px)' }
  }}>
    <Box sx={{ 
      p: 1.5, 
      borderRadius: 3, 
      bgcolor: 'rgba(255,255,255,0.05)', 
      color: 'white',
      flexShrink: 0
    }}>
      {icon}
    </Box>
    <Box>
      {/* UPDATED: Bigger and Bolder Title */}
      <Typography 
        variant="h6" 
        fontWeight="800" // Extra Bold
        sx={{ 
          fontSize: '1.25rem', // Bigger 
          mb: 1,
          color: 'white'
        }}
      >
        {title}
      </Typography>
      
      {/* UPDATED: Bigger and Bolder Description */}
      <Typography 
        variant="body1" 
        sx={{ 
          color: 'text.secondary', 
          lineHeight: 1.7,
          fontSize: '1.05rem', // Bigger
          fontWeight: 500      // Medium weight (Bolder than normal body)
        }}
      >
        {desc}
      </Typography>
    </Box>
  </Box>
);

const FeatureCard = ({ icon, title, desc }) => (
  <Grid item xs={12} md={4}>
    <motion.div whileHover={{ y: -8 }} transition={{ duration: 0.3 }} style={{ height: '100%' }}>
      <Card sx={{ 
        height: '100%', 
        maxWidth: '340px', 
        mx: 'auto',
        bgcolor: 'rgba(255,255,255,0.02)', 
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.05)', 
        borderRadius: 4,
        display: 'flex', flexDirection: 'column'
      }}>
        <CardContent sx={{ p: 3, flexGrow: 1, textAlign: 'center' }}>
          <Box mb={2} sx={{ 
            p: 1.5, 
            borderRadius: 3, 
            bgcolor: 'rgba(255,255,255,0.05)', 
            display: 'inline-flex', 
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {icon}
          </Box>
          <Typography 
            variant="h6" 
            sx={{ 
              fontSize: '1.3rem', 
              fontWeight: 800, 
              mb: 1, 
              color: 'white' 
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary', 
              lineHeight: 1.6, 
              fontSize: '1.05rem', 
              fontWeight: 500
            }}
          >
            {desc}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  </Grid>
);