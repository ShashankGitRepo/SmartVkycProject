import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  AppBar, Box, Toolbar, IconButton, Typography, Menu, Container, 
  Avatar, Button, Tooltip, MenuItem, Chip 
} from '@mui/material';
import { 
  Menu as MenuIcon, Security, Dashboard, VideoCall, 
  FactCheck, Logout, AdminPanelSettings 
} from '@mui/icons-material';

const pages = [
  { name: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
  { name: 'Verify ID', path: '/verify-document', icon: <FactCheck />, role: 'client' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);

  const handleOpenNavMenu = (event) => setAnchorElNav(event.currentTarget);
  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseNavMenu = () => setAnchorElNav(null);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Hide Navbar on Join Meeting page to maximize video space
  if (location.pathname.startsWith('/meet/')) return null;

  return (
    <AppBar position="sticky" sx={{ background: 'rgba(23, 23, 23, 0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          
          {/* LOGO (Desktop) */}
          <Security sx={{ display: { xs: 'none', md: 'flex' }, mr: 1, color: '#6366f1' }} />
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 4,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            SecureKYC
          </Typography>

          {/* MOBILE MENU */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton size="large" onClick={handleOpenNavMenu} color="inherit">
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={anchorElNav}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {pages.map((page) => (
                (!page.role || page.role === user?.role) && (
                  <MenuItem key={page.name} onClick={() => { handleCloseNavMenu(); navigate(page.path); }}>
                    <Typography textAlign="center">{page.name}</Typography>
                  </MenuItem>
                )
              ))}
            </Menu>
          </Box>

          {/* LOGO (Mobile) */}
          <Security sx={{ display: { xs: 'flex', md: 'none' }, mr: 1, color: '#6366f1' }} />
          <Typography
            variant="h5"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            KYC
          </Typography>

          {/* DESKTOP MENU */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 2 }}>
            {user && pages.map((page) => (
              (!page.role || page.role === user.role) && (
                <Button
                  key={page.name}
                  onClick={() => navigate(page.path)}
                  startIcon={page.icon}
                  sx={{ 
                    my: 2, color: 'white', display: 'flex',
                    bgcolor: location.pathname === page.path ? 'rgba(255,255,255,0.1)' : 'transparent'
                  }}
                >
                  {page.name}
                </Button>
              )
            ))}
          </Box>

          {/* USER SETTINGS */}
          <Box sx={{ flexGrow: 0 }}>
            {user ? (
              <>
                <Tooltip title="Open settings">
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar sx={{ bgcolor: user.role === 'admin' ? 'secondary.main' : 'primary.main' }}>
                      {user.sub ? user.sub[0].toUpperCase() : 'U'}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  sx={{ mt: '45px' }}
                  anchorEl={anchorElUser}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {user.role === 'admin' ? 'Admin User' : 'Client User'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{user.sub}</Typography>
                  </Box>
                  <MenuItem onClick={() => navigate('/profile')}>Profile</MenuItem>
                  <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                    <Logout sx={{ mr: 1, fontSize: 20 }} /> Logout
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button component={RouterLink} to="/login" variant="contained" color="primary">
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}