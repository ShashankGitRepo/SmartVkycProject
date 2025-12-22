import { Box, Container, Grid, Typography, Link, Stack, IconButton, Divider } from '@mui/material';
import { Facebook, Twitter, LinkedIn, GitHub, Security } from '@mui/icons-material';

export default function Footer() {
  return (
    <Box sx={{ bgcolor: '#0a0a0a', color: 'text.secondary', pt: 8, pb: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand Column */}
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Security color="primary" />
              <Typography variant="h6" color="white" fontWeight="bold">SecureKYC</Typography>
            </Box>
            <Typography variant="body2" sx={{ maxWidth: 300, mb: 2 }}>
              Next-generation identity verification powered by AI. 
              Compliant with RBI V-CIP and ISO 27001 standards for banking-grade security.
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}><Twitter /></IconButton>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}><LinkedIn /></IconButton>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}><GitHub /></IconButton>
            </Stack>
          </Grid>

          {/* Links Columns */}
          <Grid item xs={6} md={2}>
            <Typography variant="subtitle2" color="white" fontWeight="bold" mb={2}>PLATFORM</Typography>
            <Stack spacing={1}>
              <Link href="#" color="inherit" underline="hover">How it Works</Link>
              <Link href="#" color="inherit" underline="hover">Deepfake Detection</Link>
              <Link href="#" color="inherit" underline="hover">Liveness Check</Link>
              <Link href="#" color="inherit" underline="hover">Pricing</Link>
            </Stack>
          </Grid>

          <Grid item xs={6} md={2}>
            <Typography variant="subtitle2" color="white" fontWeight="bold" mb={2}>COMPANY</Typography>
            <Stack spacing={1}>
              <Link href="#" color="inherit" underline="hover">About Us</Link>
              <Link href="#" color="inherit" underline="hover">Careers</Link>
              <Link href="#" color="inherit" underline="hover">Blog</Link>
              <Link href="#" color="inherit" underline="hover">Contact</Link>
            </Stack>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" color="white" fontWeight="bold" mb={2}>LEGAL</Typography>
            <Stack spacing={1}>
              <Link href="#" color="inherit" underline="hover">Privacy Policy</Link>
              <Link href="#" color="inherit" underline="hover">Terms of Service</Link>
              <Link href="#" color="inherit" underline="hover">Compliance</Link>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

        <Box textAlign="center">
          <Typography variant="caption">
            © {new Date().getFullYear()} SecureKYC Inc. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}