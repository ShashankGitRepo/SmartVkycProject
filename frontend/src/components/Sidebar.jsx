import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
  Box, Typography, Divider, Avatar, IconButton, useTheme, useMediaQuery, Chip 
} from '@mui/material';
import { 
  Dashboard, Person, FactCheck, Logout, Security, 
  ChevronLeft, Videocam 
} from '@mui/icons-material';

const DRAWER_WIDTH = 280;

export default function Sidebar({ open, onClose, variant = "permanent" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { 
      text: 'Dashboard', 
      path: '/dashboard', 
      icon: <Dashboard />, 
      role: 'all' 
    },
    { 
      text: 'Verify Identity', 
      path: '/verify-document', 
      icon: <FactCheck />, 
      role: 'client' 
    },
    { 
      text: 'My Profile', 
      path: '/profile', 
      icon: <Person />, 
      role: 'all' 
    },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile && onClose) onClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#111' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{ p: 1, bgcolor: 'rgba(99, 102, 241, 0.1)', borderRadius: 2 }}>
            <Security sx={{ color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="h6" fontWeight="bold" letterSpacing={0.5} color="text.primary">
            SecureKYC
          </Typography>
        </Box>
        {isMobile && (
          <IconButton onClick={onClose}>
            <ChevronLeft sx={{ color: 'text.secondary' }} />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Avatar 
          sx={{ 
            width: 64, height: 64, mx: 'auto', mb: 2, 
            bgcolor: user?.role === 'admin' ? 'secondary.main' : 'primary.main',
            fontSize: '1.5rem', fontWeight: 'bold',
            boxShadow: `0 8px 24px ${user?.role === 'admin' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`
          }}
        >
          {user?.first_name?.[0] || user?.sub?.[0]?.toUpperCase()}
        </Avatar>
        <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
          {user?.first_name || "Welcome"}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {user?.role === 'admin' ? 'Administrator' : 'Verified Client'}
        </Typography>
        <Chip 
          label={user?.role?.toUpperCase()} 
          size="small" 
          color={user?.role === 'admin' ? 'secondary' : 'primary'} 
          variant="outlined" 
          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} 
        />
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mb: 2 }} />

      <List sx={{ px: 2, flexGrow: 1 }}>
        {menuItems.map((item) => (
          (item.role === 'all' || item.role === user?.role) && (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton 
                onClick={() => handleNavigation(item.path)}
                selected={location.pathname === item.path}
                sx={{ 
                  borderRadius: 3,
                  '&.Mui-selected': {
                    bgcolor: theme.palette.primary.main,
                    color: 'white',
                    '&:hover': { bgcolor: theme.palette.primary.dark },
                    '& .MuiListItemIcon-root': { color: 'white' }
                  },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: location.pathname === item.path ? 'white' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600, color: location.pathname === item.path ? 'white' : 'text.primary' }} 
                />
              </ListItemButton>
            </ListItem>
          )
        ))}
      </List>

      <Box p={2}>
        <ListItemButton 
          onClick={handleLogout}
          sx={{ 
            borderRadius: 3, 
            color: 'error.main', 
            bgcolor: 'rgba(239, 68, 68, 0.1)',
            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}>
            <Logout />
          </ListItemIcon>
          <ListItemText 
            primary="Sign Out" 
            primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 700, color: 'error.main' }} 
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, bgcolor: '#111', borderRight: '1px solid rgba(255,255,255,0.1)' },
        }}
      >
        {drawerContent}
      </Drawer>

      <Drawer
        variant={variant}
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, bgcolor: '#111', borderRight: '1px solid rgba(255,255,255,0.1)' },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}