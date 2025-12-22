import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Box, Grid, Paper, Typography, Button, TextField, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Stack, CircularProgress, Avatar, Tooltip
} from '@mui/material';
import { 
  VideoCall, Add, Shield, VerifiedUser, Error, Groups, 
  Refresh, CheckCircle, Warning, Duo, Keyboard, LocationOn, Fingerprint
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const StatCard = ({ icon, title, value, color }) => (
  <motion.div whileHover={{ y: -5 }} style={{ height: '100%' }}>
    <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, height: '100%', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: `${color}20`, color: color }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
        <Typography variant="h5" fontWeight="bold">{value}</Typography>
      </Box>
    </Paper>
  </motion.div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState('');
  
  // Data State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [isVerified, setIsVerified] = useState(false); 

  const displayName = user?.sub ? user.sub.split('@')[0] : "User";

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminLogs();
    } else {
      checkClientStatus();
      fetchClientLogs();
    }
  }, [user]);

  const fetchAdminLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await axios.get('/api/v1/admin/verifications');
      setLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch admin logs", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const checkClientStatus = async () => {
    try {
        const res = await axios.get('/api/v1/users/status');
        setIsVerified(res.data.is_verified);
    } catch (e) {
        setIsVerified(false);
    }
  };

  const fetchClientLogs = async () => {
      try {
          const res = await axios.get('/api/v1/users/history');
          setLogs(res.data);
      } catch (e) {
          setLogs([]);
      }
  };

  const createMeeting = async (type = "KYC") => {
    try {
      const title = type === "KYC" ? "Official Verification" : "Personal Call";
      const res = await axios.post('/api/v1/meetings/create', { title });
      const code = res.data.meeting_code;
      const link = `${window.location.origin}/meet/${code}`;
      navigator.clipboard.writeText(link);
      
      if(confirm(`${title} Created!\n\nCode: ${code}\n\nLink copied to clipboard. Join now?`)) {
        navigate(`/meet/${code}`);
      }
    } catch (e) { 
      alert("Error creating meeting"); 
    }
  };

  const joinMeeting = () => {
    if (meetingCode.trim()) navigate(`/meet/${meetingCode}`);
  };

  const formatScore = (val) => val !== null && val !== undefined ? val.toFixed(2) : 'N/A';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
      
      {/* HEADER */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={5}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Dashboard
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: '1.1rem' }}>
            Welcome, <span style={{ color: '#6366f1', fontWeight: 'bold', textTransform: 'capitalize' }}>{displayName}</span>
          </Typography>
        </Box>
        
        <Avatar sx={{ 
          bgcolor: user?.role === 'admin' ? 'secondary.main' : 'primary.main', 
          width: 56, height: 56, fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase'
        }}>
          {displayName[0]}
        </Avatar>
      </Box>

      {/* ================= ADMIN VIEW ================= */}
      {user?.role === 'admin' && (
        <Grid container spacing={4}>
          
          {/* Row 1: Stats */}
          <Grid item xs={12} sm={6} md={3}><StatCard icon={<Groups/>} title="Total Logs" value={logs.length} color="#3b82f6" /></Grid>
          <Grid item xs={12} sm={6} md={3}><StatCard icon={<VideoCall/>} title="Active Sessions" value="-" color="#6366f1" /></Grid>
          <Grid item xs={12} sm={6} md={3}><StatCard icon={<Error/>} title="Flagged Users" value={logs.filter(l => !l.is_pass).length} color="#ef4444" /></Grid>
          <Grid item xs={12} sm={6} md={3}><StatCard icon={<VerifiedUser/>} title="Verified Users" value={logs.filter(l => l.is_pass).length} color="#10b981" /></Grid>

          {/* Row 2: Create Meeting Card (FORCED FULL WIDTH) */}
          <Grid item xs={12}>
            <Paper sx={{ 
                p: 4, 
                bgcolor: '#1e1e24', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: 4, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: 2,
                width: '100%' // Ensure paper fills the grid item
            }}>
              <Box display="flex" alignItems="center" gap={3}>
                <Box sx={{ p: 2, bgcolor: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', color: 'primary.main' }}>
                   <Shield sx={{ fontSize: 40 }} />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight="bold">Start Verification Session</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Create a secure KYC room to verify a client via video.
                    </Typography>
                </Box>
              </Box>
              <Button variant="contained" size="large" startIcon={<Add />} onClick={() => createMeeting("KYC")} sx={{ px: 4, py: 1.5 }}>
                New Session
              </Button>
            </Paper>
          </Grid>

          {/* Row 3: Verification Log Table (FORCED FULL WIDTH) */}
          <Grid item xs={12}>
            <Paper sx={{ 
                p: 3, 
                bgcolor: '#1e1e24', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: 4,
                width: '100%' // Ensure paper fills the grid item
            }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold">Verification Audit Log</Typography>
                <IconButton onClick={fetchAdminLogs} size="small"><Refresh /></IconButton>
              </Box>
              <TableContainer sx={{ maxHeight: '65vh' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#1e1e24', color: 'gray', width: '10%' }}>Client ID</TableCell>
                      <TableCell sx={{ bgcolor: '#1e1e24', color: 'gray', width: '20%' }}>User Name</TableCell>
                      <TableCell sx={{ bgcolor: '#1e1e24', color: 'gray', width: '30%' }}>Scores (Liveness / Fake / Match)</TableCell>
                      <TableCell sx={{ bgcolor: '#1e1e24', color: 'gray', width: '30%' }}>Rejection Reason</TableCell>
                      <TableCell sx={{ bgcolor: '#1e1e24', color: 'gray', width: '10%' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingLogs ? (
                      <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24}/></TableCell></TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4 }}>No verification logs found.</TableCell></TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id} hover>
                          
                          {/* Client ID */}
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold" fontFamily="monospace">#{log.client_id}</Typography>
                          </TableCell>

                          {/* User Name */}
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                              {log.client ? `${log.client.first_name || ''} ${log.client.last_name || ''}` : "Unknown"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{log.client?.email}</Typography>
                          </TableCell>

                          {/* Scores */}
                          <TableCell>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Box>
                                <Typography variant="caption" display="block" color="text.secondary">Liveness</Typography>
                                <Typography variant="body2" fontWeight="bold" color={log.liveness_score < 0.5 ? "error.main" : "success.main"}>
                                  {formatScore(log.liveness_score)}
                                </Typography>
                              </Box>
                              <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.1)' }} />
                              <Box>
                                <Typography variant="caption" display="block" color="text.secondary">Deepfake</Typography>
                                <Typography variant="body2" fontWeight="bold" color={log.deepfake_score > 0.6 ? "error.main" : "success.main"}>
                                  {formatScore(log.deepfake_score)}
                                </Typography>
                              </Box>
                              <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.1)' }} />
                              <Box>
                                <Typography variant="caption" display="block" color="text.secondary">Face Match</Typography>
                                <Typography variant="body2" fontWeight="bold" color={log.face_match_score > 0.4 ? "error.main" : "success.main"}>
                                  {formatScore(log.face_match_score)}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>

                          {/* Reason */}
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: log.is_pass ? 'normal' : 'italic' }}>
                              {log.failure_reason && log.failure_reason !== "NA" ? log.failure_reason : "None"}
                            </Typography>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Chip 
                              label={log.is_pass ? "PASSED" : "REJECTED"} 
                              color={log.is_pass ? "success" : "error"} 
                              size="small" 
                              variant={log.is_pass ? "filled" : "outlined"}
                            />
                          </TableCell>

                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ================= CLIENT VIEW (Same as before) ================= */}
      {user?.role === 'client' && (
        <Stack spacing={4} sx={{ maxWidth: '1000px', mx: 'auto' }}>
          
          <Paper sx={{ p: 4, borderRadius: 4, bgcolor: '#1e1e24', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', bgcolor: isVerified ? '#10b981' : '#f59e0b' }} />
            {isVerified ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <CheckCircle sx={{ fontSize: 60, color: '#10b981', mb: 2 }} />
                <Typography variant="h4" fontWeight="bold" color="#10b981" gutterBottom>Verified</Typography>
                <Typography variant="body1" color="text.secondary">Your identity has been confirmed.</Typography>
              </motion.div>
            ) : (
              <>
                <Warning color="warning" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h4" fontWeight="bold" color="warning.main" gutterBottom>Action Required</Typography>
                <Typography variant="body1" color="text.secondary" mb={4}>Please upload your government ID.</Typography>
                <Button variant="outlined" color="warning" size="large" onClick={() => navigate('/verify-document')} sx={{ px: 5 }}>Upload Documents</Button>
              </>
            )}
          </Paper>

          <Paper sx={{ p: 5, borderRadius: 5, bgcolor: '#1e1e24', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Box display="flex" alignItems="center" gap={2} mb={4}>
              <VideoCall color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h5" fontWeight="bold">Video Conference</Typography>
            </Box>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Box p={3} borderRadius={4} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', textAlign: 'center' }}>
                  <Typography variant="subtitle1" fontWeight="bold" mb={1}>Join Session</Typography>
                  <Box display="flex" gap={1} mt={2}>
                    <TextField fullWidth placeholder="Code" value={meetingCode} onChange={(e) => setMeetingCode(e.target.value)} size="small" />
                    <Button variant="contained" onClick={joinMeeting}>Join</Button>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                 <Box p={3} borderRadius={4} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', textAlign: 'center' }}>
                  <Typography variant="subtitle1" fontWeight="bold" mb={1}>Start Personal Call</Typography>
                  <Button variant="outlined" color="secondary" fullWidth onClick={() => createMeeting("PERSONAL")} sx={{ mt: 2 }}>Create Room</Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <Grid item xs={12}>
            <Paper sx={{ p: 3, bgcolor: '#1e1e24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4 }}>
              <Typography variant="h6" fontWeight="bold" mb={2}>Verification History</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'gray' }}>Date</TableCell>
                      <TableCell sx={{ color: 'gray' }}>Scores (Live / Fake / Match)</TableCell>
                      <TableCell sx={{ color: 'gray' }}>Status</TableCell>
                      <TableCell sx={{ color: 'gray' }}>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell sx={{ color: 'white' }}>{new Date(log.timestamp).toLocaleDateString()}</TableCell>
                        <TableCell>
                           <Typography variant="caption" color="text.secondary">
                             L: {formatScore(log.liveness_score)} | F: {formatScore(log.deepfake_score)} | M: {formatScore(log.face_match_score)}
                           </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={log.is_pass ? "PASSED" : "FAILED"} color={log.is_pass ? "success" : "error"} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{log.failure_reason || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

        </Stack>
      )}
    </Box>
  );
}