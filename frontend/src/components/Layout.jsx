import { useState } from 'react';
import { Box, IconButton, useTheme, useMediaQuery, Typography } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 280;

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  // Don't show layout on Login/Register/Home/Meeting
  const isPublicPage = ['/', '/login', '/register'].includes(location.pathname);
  const isMeetingRoom = location.pathname.startsWith('/meet/');

  if (isPublicPage || isMeetingRoom) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      
      {/* Sidebar */}
      <Sidebar 
        open={mobileOpen} 
        onClose={() => setMobileOpen(false)} 
        variant={isMobile ? "temporary" : "permanent"}
      />

      {/* Main Content Wrapper */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          display: 'flex',           // Make this a flex container
          flexDirection: 'column',   // Stack children vertically
          overflow: 'auto'
        }}
      >
        {/* Mobile Header Toggle */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, mb: 3, alignItems: 'center', gap: 2 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" fontWeight="bold" color="text.primary">
            SecureKYC
          </Typography>
        </Box>

        {/* Page Content - flexGrow 1 pushes footer down */}
        <Box sx={{ flexGrow: 1 }}>
          {children}
        </Box>

        {/* Footer Component */}
        <Footer />
      </Box>
    </Box>
  );
}