import React, { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  CircularProgress,
  Fab,
  Tooltip,
  Paper,
  Stack,
  LinearProgress,
  Button,
  IconButton,
  Chip,
  Divider,
  Avatar
} from "@mui/material";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
  ScreenShare,
  StopScreenShare,
  Shield,
  WarningAmber,
  CheckCircle,
  RemoveRedEye,
  ContentCopy,
  RecordVoiceOver,
  Person
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

const CLIENT_CODEC = "vp8";

// --- GRAPH COMPONENT ---
const ScoreBar = ({ label, value, color, icon }) => {
  const safeValue = isNaN(value) ? 0 : value;
  const percentage = Math.min(Math.max(safeValue * 100, 0), 100);
  
  return (
    <Box sx={{ mb: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
            {icon}
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5 }}>
                {label}
            </Typography>
        </Stack>
        <Typography variant="caption" sx={{ fontWeight: 800, color: color, fontFamily: "monospace", fontSize: 13 }}>
          {percentage.toFixed(1)}%
        </Typography>
      </Stack>
      <Box sx={{ height: 10, bgcolor: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
        <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 10 }}
            style={{ height: "100%", backgroundColor: color, borderRadius: 5, boxShadow: `0 0 10px ${color}` }}
        />
      </Box>
    </Box>
  );
};

export default function VideoConference() {
  const { meetingCode } = useParams();
  return <CallInterface meetingCode={meetingCode} />;
}

function CallInterface({ meetingCode }) {
  const { user } = useAuth() || {};
  const navigate = useNavigate();

  // Agora & DOM refs
  const clientRef = useRef(null);
  const localAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const localScreenRef = useRef(null);
  
  const remoteContainerRef = useRef(null);
  const localPreviewRef = useRef(null);
  const remoteWrapperRef = useRef(null);
  const localWrapperRef = useRef(null);

  // State
  const [loading, setLoading] = useState(true);
  const [appId, setAppId] = useState("");
  const [token, setToken] = useState(undefined);
  const [uid, setUid] = useState(null);
  const [role, setRole] = useState(user?.role || "client");

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // AI State
  const [aiStatus, setAiStatus] = useState({
    liveness: { passed: false, score: 0, challenge: "none" },
    deepfake: { is_deepfake: false, score: 0 },
    face_match: { is_match: false, distance: 1.0 },
  });

  const wsRef = useRef(null);
  const [targetClientId, setTargetClientId] = useState(null);
  const [framesSent, setFramesSent] = useState(0); // Debug Stats

  const getBackendBase = () => axios.defaults.baseURL || window.location.origin;
  const getWsBase = () => {
    const base = getBackendBase();
    return base.startsWith("https") ? base.replace(/^https/, "wss") : base.replace(/^http/, "ws");
  };

  // 1. INITIAL FETCH & ROLE SETUP
  useEffect(() => {
    let cancelled = false;
    const fetchJoinAndMeta = async () => {
      try {
        setLoading(true);
        const tokenHeader = localStorage.getItem("access_token");
        
        // Join Meeting
        const joinRes = await axios.get(`/api/v1/meetings/join/${meetingCode}`, {
          headers: tokenHeader ? { Authorization: `Bearer ${tokenHeader}` } : undefined,
        });

        if (cancelled) return;

        setAppId(joinRes.data.appId);
        setToken(joinRes.data.token);
        setUid(joinRes.data.uid);
        
        // Determine Role & Target
        const myRole = joinRes.data.role === "host" || joinRes.data.role === "admin" ? "admin" : "client";
        setRole(myRole);

        // NEW: Use the explicitly returned client_id from backend if available
        if (myRole === "client") {
            // Fallback to join response if user.id is somehow missing in context
            const myId = joinRes.data.client_id || user?.id;
            if (myId) {
                console.log("I am Client. ID:", myId);
                setTargetClientId(myId);
            }
        } else {
            // I am Admin, look for client
            console.log("I am Admin. Looking for client...");
            fetchClientId(tokenHeader);
        }
      } catch (err) {
        console.error("Join Error", err);
        setCameraError("Connection failed. Please re-login.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (meetingCode) fetchJoinAndMeta();
    return () => { cancelled = true; };
  }, [meetingCode, user]);

  const fetchClientId = async (tokenHeader) => {
    try {
        const res = await axios.get(`/api/v1/meetings/${meetingCode}/result`, {
            headers: tokenHeader ? { Authorization: `Bearer ${tokenHeader}` } : undefined,
        });
        if (res.data && res.data.client_id) {
            console.log("Found Client ID:", res.data.client_id);
            setTargetClientId(res.data.client_id);
            return true;
        }
    } catch (e) {}
    return false;
  };

  // Poll for Client ID (Admin only)
  useEffect(() => {
      if (role !== "admin" || targetClientId) return;
      const tokenHeader = localStorage.getItem("access_token");
      const interval = setInterval(() => fetchClientId(tokenHeader), 3000);
      return () => clearInterval(interval);
  }, [role, targetClientId, meetingCode]);

  // 2. AGORA SETUP
  const safePlay = (track, containerRef, wrapperRef, opts = {}) => {
    if (!containerRef.current) return;
    if (!wrapperRef.current) {
      const w = document.createElement("div");
      w.style.width = "100%"; w.style.height = "100%"; w.style.position = "relative";
      containerRef.current.appendChild(w);
      wrapperRef.current = w;
    }
    const wrapper = wrapperRef.current;
    if (track && track.play) {
      track.play(wrapper);
      setTimeout(() => {
        const v = wrapper.querySelector("video");
        if (v) { v.style.objectFit = "cover"; v.style.width = "100%"; v.style.height = "100%"; }
      }, 100);
    }
  };

  useEffect(() => {
    if (!appId || !token) return;
    const client = AgoraRTC.createClient({ mode: "rtc", codec: CLIENT_CODEC });
    clientRef.current = client;

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "video") safePlay(user.videoTrack, remoteContainerRef, remoteWrapperRef);
      if (mediaType === "audio") user.audioTrack?.play();
      
      // Trigger refresh if admin waiting for client
      if (role === "admin" && !targetClientId) fetchClientId(localStorage.getItem("access_token"));
    });

    const init = async () => {
        try {
            await client.join(appId, meetingCode, token, uid);
            const audio = await AgoraRTC.createMicrophoneAudioTrack();
            localAudioRef.current = audio;
            const video = await AgoraRTC.createCameraVideoTrack();
            localVideoRef.current = video;
            await client.publish([audio, video]);
            safePlay(video, localPreviewRef, localWrapperRef, { muted: true });
        } catch (e) { console.error("Agora Error", e); }
    };
    init();

    return () => {
        localAudioRef.current?.close();
        localVideoRef.current?.close();
        client.leave();
    };
  }, [appId, token, meetingCode, uid, role, targetClientId]);

  // 3. WEBSOCKET LOGIC
  useEffect(() => {
    if (!targetClientId) return;
    
    const wsUrl = `${getWsBase()}/ws/verify/${meetingCode}/${targetClientId}`;
    console.log("Connecting WS:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log("WS Connected");
    ws.onmessage = (ev) => {
        try { 
            const data = JSON.parse(ev.data);
            setAiStatus(prev => ({ ...prev, ...data })); 
        } catch(e) {}
    };

    // CLIENT: Frame Sender (Hybrid Robust Capture)
    let interval = null;
    if (role === "client") {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                let captured = false;
                
                // Method 1: DOM Element (Fastest if visible)
                const videoEl = localWrapperRef.current?.querySelector("video");
                if (videoEl && videoEl.readyState >= 2) {
                    canvas.width = 640; canvas.height = 480;
                    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                    const base64 = canvas.toDataURL("image/jpeg", 0.5);
                    ws.send(JSON.stringify({ image: base64 }));
                    setFramesSent(prev => prev + 1);
                    captured = true;
                }

                // Method 2: Raw Track (Fallback if hidden)
                if (!captured && localVideoRef.current) {
                    try {
                        const track = localVideoRef.current.getMediaStreamTrack();
                        if (track && track.readyState === 'live') {
                             if (!window.offscreenVideo) {
                                 window.offscreenVideo = document.createElement("video");
                                 window.offscreenVideo.muted = true;
                                 window.offscreenVideo.playsInline = true;
                             }
                             if (window.offscreenVideo.srcObject?.id !== track.id) {
                                 window.offscreenVideo.srcObject = new MediaStream([track]);
                                 window.offscreenVideo.play().catch(()=>{});
                             }
                             if (window.offscreenVideo.readyState >= 2) {
                                 canvas.width = 640; canvas.height = 480;
                                 ctx.drawImage(window.offscreenVideo, 0, 0, canvas.width, canvas.height);
                                 ws.send(JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.5) }));
                                 setFramesSent(prev => prev + 1);
                             }
                        }
                    } catch(e) {}
                }
            }
        }, 500); // 2 FPS
    } 
    
    // ADMIN: Heartbeat
    let pingInterval = null;
    if (role === "admin") {
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "ping" }));
            }
        }, 2000);
    }

    return () => { 
        if(interval) clearInterval(interval); 
        if(pingInterval) clearInterval(pingInterval);
        ws.close(); 
    };
  }, [role, targetClientId, meetingCode]);

  // 4. CONTROLS
  const toggleMic = async () => {
    if (localAudioRef.current) {
        await localAudioRef.current.setEnabled(!micOn);
        setMicOn(!micOn);
    }
  };
  const toggleCam = async () => {
    if (localVideoRef.current) {
        await localVideoRef.current.setEnabled(!camOn);
        setCamOn(!camOn);
    }
  };
  const toggleScreen = () => setIsSharing(!isSharing);

  const handleEndCall = async () => {
    if (role === "admin") {
        try {
            const tokenHeader = localStorage.getItem("access_token");
            await axios.post(`/api/v1/meetings/${meetingCode}/scores`, {
                liveness: aiStatus.liveness,
                deepfake: aiStatus.deepfake,
                face_match: aiStatus.face_match,
                saved_by: "admin_termination"
            }, { headers: { Authorization: `Bearer ${tokenHeader}` }});
        } catch(e) {}
    }
    clientRef.current?.leave();
    localAudioRef.current?.close();
    localVideoRef.current?.close();
    navigate("/dashboard");
  };

  if (loading) return <Box sx={{ width: "100vw", height: "100vh", bgcolor: "#000", display: "flex", justifyContent: "center", alignItems: "center" }}><CircularProgress /></Box>;

  const isAdmin = role === "admin";
  const dfScore = 1 - (aiStatus.deepfake.score || 0);
  const matchScore = 1 - (aiStatus.face_match.distance || 1);
  const dfColor = aiStatus.deepfake.is_deepfake ? "#ef4444" : "#10b981"; 
  const matchColor = aiStatus.face_match.is_match ? "#10b981" : "#f59e0b"; 

  return (
    <Box sx={{ width: "100vw", height: "100vh", bgcolor: "#111", position: "relative", overflow: "hidden" }}>
      <Box ref={remoteContainerRef} sx={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* DEBUG PANEL (Remove in Prod) */}
      <Box sx={{ position: "absolute", top: 80, right: 24, zIndex: 999, bgcolor: "rgba(0,0,0,0.5)", color: "lime", p: 2, borderRadius: 2, fontFamily: "monospace", fontSize: 10, pointerEvents: "none" }}>
        <Typography variant="caption" display="block">ROLE: {role.toUpperCase()}</Typography>
        <Typography variant="caption" display="block">TARGET CLIENT ID: {targetClientId || "WAITING..."}</Typography>
        <Typography variant="caption" display="block">WS STATUS: {wsRef.current?.readyState === 1 ? "OPEN" : "CLOSED"}</Typography>
        <Typography variant="caption" display="block">FRAMES SENT: {framesSent}</Typography>
      </Box>

      {/* Header */}
      <Box sx={{ position: "absolute", top: 24, left: 24, zIndex: 20, display: "flex", alignItems: "center", gap: 1, bgcolor: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: 8, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>ID:</Typography>
        <Typography variant="body1" sx={{ color: "white", fontWeight: "bold", fontFamily: "monospace", letterSpacing: 1 }}>{meetingCode}</Typography>
        <IconButton size="small" onClick={() => navigator.clipboard.writeText(meetingCode)}>
            <ContentCopy sx={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }} />
        </IconButton>
      </Box>

      {/* Admin Sidebar */}
      <AnimatePresence>
      {isAdmin && (
        <motion.div initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ type: "spring", stiffness: 60 }} style={{ position: "absolute", left: 24, top: 100, bottom: 100, zIndex: 10, width: 300 }}>
          <Paper elevation={24} sx={{ height: "auto", p: 3, bgcolor: "rgba(10, 10, 10, 0.75)", backdropFilter: "blur(20px)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", color: "white", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={4}>
              <Box sx={{ p: 1, bgcolor: "rgba(59, 130, 246, 0.2)", borderRadius: 2 }}><Shield sx={{ color: "#60a5fa" }} /></Box>
              <Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ lineHeight: 1 }}>SECURITY</Typography>
                <Typography variant="caption" color="gray">Live AI Verification</Typography>
              </Box>
            </Stack>
            <ScoreBar label="REALITY INTEGRITY" value={dfScore} color={dfColor} icon={<RecordVoiceOver sx={{ fontSize: 16, color: "gray" }}/>} />
            <ScoreBar label="ID MATCHING" value={matchScore} color={matchColor} icon={<Person sx={{ fontSize: 16, color: "gray" }}/>} />
            <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.1)" }} />
            <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 700, mb: 1, display: "block" }}>LIVE ALERTS</Typography>
            <Stack spacing={1}>
                {aiStatus.deepfake.is_deepfake ? (
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ repeat: Infinity, duration: 0.8, repeatType: "reverse" }}>
                        <Chip icon={<WarningAmber />} label="DEEPFAKE DETECTED" sx={{ width: "100%", bgcolor: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "1px solid #ef4444", fontWeight: "bold" }} />
                    </motion.div>
                ) : (
                    <Chip icon={<CheckCircle />} label="VIDEO STREAM SECURE" sx={{ width: "100%", bgcolor: "rgba(16, 185, 129, 0.1)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.2)" }} />
                )}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
            <Typography variant="caption" color="gray">Liveness</Typography>
                {aiStatus.liveness.passed ? (
                <Typography variant="caption" sx={{ color: "#34d399", fontWeight: "bold", display: "flex", alignItems: "center", gap: 0.5 }}>
                        PASSED <CheckCircle sx={{ fontSize: 14 }}/></Typography>
                ) : (
                <Typography variant="caption" sx={{ color: "#fcd34d", fontWeight: "bold", fontFamily: "monospace" }}>
                {/* CHANGED: Shows percentage now */}
                CHECKING: {(aiStatus.liveness.score * 100).toFixed(0)}%
              </Typography>
                )}
          </Stack> 
          </Stack>
          </Paper>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Client Liveness */}
      {!isAdmin && (
        <Box sx={{ position: "absolute", top: 24, right: 24, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <Paper sx={{ display: "flex", alignItems: "center", gap: 1.5, padding: "12px 24px", borderRadius: 8, bgcolor: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                    <Box sx={{ position: "relative", width: 28, height: 28 }}>
                        <RemoveRedEye sx={{ color: "#60a5fa", width: "100%", height: "100%" }} />
                        <motion.div style={{ position: "absolute", top: -6, left: -6, right: -6, bottom: -6, border: "2px solid #60a5fa", borderRadius: "50%" }} animate={{ scale: [1, 1.4], opacity: [0.8, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" sx={{ color: "white", fontWeight: "800", letterSpacing: 0.5 }}>LIVENESS CHECK</Typography>
                        <Typography variant="caption" sx={{ color: "#bfdbfe", fontWeight: "600" }}>Please blink naturally</Typography>
                    </Box>
                </Paper>
            </motion.div>
        </Box>
      )}

      {/* Preview */}
      <Paper elevation={10} sx={{ position: "absolute", right: 24, bottom: 100, width: 220, height: 140, zIndex: 10, overflow: "hidden", borderRadius: 3, border: "2px solid rgba(255,255,255,0.2)", bgcolor: "black" }}>
        <Box ref={localPreviewRef} sx={{ width: "100%", height: "100%" }} />
        <Typography sx={{ position: "absolute", bottom: 8, left: 8, color: "white", fontSize: 12, textShadow: "0 1px 2px black", fontWeight: "bold" }}>{isAdmin ? "Admin (You)" : "Client (You)"}</Typography>
      </Paper>

      {/* Controls */}
      <Box sx={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", gap: 2 }}>
        <Paper sx={{ p: 1, borderRadius: 10, bgcolor: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", display: "flex", gap: 1 }}>
            <IconButton onClick={toggleMic} sx={{ bgcolor: micOn ? "rgba(255,255,255,0.1)" : "#ef4444", color: "white" }}>{micOn ? <Mic /> : <MicOff />}</IconButton>
            <IconButton onClick={toggleCam} sx={{ bgcolor: camOn ? "rgba(255,255,255,0.1)" : "#ef4444", color: "white" }}>{camOn ? <Videocam /> : <VideocamOff />}</IconButton>
            <IconButton onClick={toggleScreen} sx={{ bgcolor: isSharing ? "#10b981" : "rgba(255,255,255,0.1)", color: "white" }}>{isSharing ? <StopScreenShare /> : <ScreenShare />}</IconButton>
            <Button variant="contained" color="error" onClick={handleEndCall} startIcon={<CallEnd />} sx={{ borderRadius: 8, px: 3, fontWeight: "bold" }}>End</Button>
        </Paper>
      </Box>
    </Box>
  );
}