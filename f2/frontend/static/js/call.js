// --- Get DOM Elements ---
const leaveBtn = document.getElementById('leaveBtn');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const videoGrid = document.getElementById('video-grid');
const localUserIdSpan = document.getElementById('local-user-id');
const channelNameDisplaySpan = document.getElementById('channel-name-display');
const localPlayerContainer = document.getElementById('local-player');

// --- Verification Elements ---
const verificationStatusDiv = document.getElementById('verification-panel');
const livenessScoreSpan = document.getElementById('liveness-score');
const deepfakeScoreSpan = document.getElementById('deepfake-score');
const faceMatchScoreSpan = document.getElementById('facematch-score');
const alertBox = document.getElementById('alert-box');

// --- Global Variables ---
let agoraClient = null;
let localAudioTrack = null;
let localVideoTrack = null;
let localScreenTrack = null;
let remoteUsers = {}; 
let agoraAppId = ''; 
let agoraToken = ''; 
let agoraUserId = 0;   
let currentChannelName = ''; 
let isLeaving = false;
let ws = null; 
let verificationInterval = null; 

// --- Logging Utility ---
function log(message) {
    console.log(`[Agora Log] ${message}`);
}

// --- WebSocket for Verification ---
function connectWebSocket(channelName, userId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Ensure we connect to port 8000 (FastAPI backend)
    // Adjust 'localhost' if deploying to a real server
    const wsUrl = `${protocol}//localhost:8000/ws/verify/${channelName}/${userId}?doc_type=Identity Document`;
    
    log(`Connecting WS: ${wsUrl}`);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        log("WS Connected");
        // Send frames every 1 second (1000ms)
        verificationInterval = setInterval(sendFrameToBackend, 1000);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateVerificationUI(data);
    };

    ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };

    ws.onclose = () => {
        log("WebSocket Disconnected");
        if (verificationInterval) clearInterval(verificationInterval);
    };
}

function sendFrameToBackend() {
    // Only capture if camera is active (not during screen share)
    if (!localVideoTrack || localScreenTrack || !ws || ws.readyState !== WebSocket.OPEN) return;

    // Find the actual video element created by Agora inside our container
    const videoElement = localPlayerContainer.querySelector('video');
    if (!videoElement) return;

    // Draw frame to canvas
    const canvas = document.createElement('canvas');
    // Downscale for performance (e.g., half resolution)
    canvas.width = videoElement.videoWidth / 2;
    canvas.height = videoElement.videoHeight / 2;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convert to Base64 JPG
    const base64Data = canvas.toDataURL('image/jpeg', 0.7);
    ws.send(base64Data);
}

function updateVerificationUI(data) {
    if (!livenessScoreSpan) return;

    // Update Liveness
    const ear = data.liveness.ear.toFixed(2);
    livenessScoreSpan.textContent = ear;
    livenessScoreSpan.style.color = data.liveness.is_blinking ? 'orange' : '#4caf50'; // Orange if blink detected

    // Update Deepfake
    const dfScore = data.deepfake.score.toFixed(2);
    deepfakeScoreSpan.textContent = dfScore;
    deepfakeScoreSpan.style.color = data.deepfake.is_fake ? '#f44336' : '#4caf50'; // Red if fake

    // Update Face Match
    const fmScore = data.facematch.score.toFixed(2);
    faceMatchScoreSpan.textContent = fmScore;
    faceMatchScoreSpan.style.color = data.facematch.is_match ? '#4caf50' : '#f44336'; // Red if mismatch

    // Trigger Alerts
    if (data.deepfake.is_fake) {
        showAlert("CRITICAL: DEEPFAKE DETECTED!");
    } else if (!data.facematch.is_match && data.facematch.has_reference) {
        showAlert("WARNING: Face Mismatch");
    } else {
        hideAlert();
    }
}

function showAlert(msg) {
    if (alertBox) {
        alertBox.textContent = msg;
        alertBox.style.display = 'block';
    }
}

function hideAlert() {
    if (alertBox) alertBox.style.display = 'none';
}

// --- Agora Token Fetching ---
async function fetchToken(channelName) {
    const authToken = localStorage.getItem('token'); 
    if (!authToken) {
        window.location.href = '/login';
        throw new Error("Not authenticated");
    }

    const response = await fetch('http://localhost:8000/api/v1/agora/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ channelName: channelName })
    });

    if (!response.ok) throw new Error("Token fetch failed");
    
    const data = await response.json();
    agoraAppId = data.appId;
    agoraToken = data.token;
    agoraUserId = data.userId;
}

// --- Agora Client Init ---
function initializeAgoraClient() {
    if (!window.AgoraRTC) {
         alert("Agora SDK missing!");
         return false;
    }
    try {
        agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        
        agoraClient.on("user-published", handleUserPublished);
        agoraClient.on("user-unpublished", handleUserUnpublished);
        agoraClient.on("user-left", handleUserLeft);
        
        return true;
    } catch (error) {
         console.error(error);
         return false;
    }
}

// --- Main Join Logic ---
async function joinCall(channelName) {
    if (!channelName) return;
    currentChannelName = channelName;
    if (channelNameDisplaySpan) channelNameDisplaySpan.textContent = currentChannelName;

    try {
        await fetchToken(currentChannelName);
        if (!initializeAgoraClient()) return;

        await agoraClient.join(agoraAppId, currentChannelName, agoraToken, agoraUserId);
        if (localUserIdSpan) localUserIdSpan.textContent = agoraUserId;

        // Create Local Tracks
        [localAudioTrack, localVideoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                {}, { encoderConfig: "480p_1" }
        );

        // Play Local Video
        if (localPlayerContainer) {
            localVideoTrack.play(localPlayerContainer);
        }

        // Publish
        await agoraClient.publish([localAudioTrack, localVideoTrack]);

        // Enable Buttons
        if (leaveBtn) leaveBtn.disabled = false;
        if (micBtn) micBtn.disabled = false;
        if (camBtn) camBtn.disabled = false;
        if (screenShareBtn) screenShareBtn.disabled = false;

        // Start Verification WebSocket
        connectWebSocket(currentChannelName, agoraUserId);

    } catch (error) {
        console.error("Join Error:", error);
        alert(`Error: ${error.message}`);
    }
}

// --- Screen Share Logic ---
async function toggleScreenShare() {
    if (localScreenTrack) {
        await stopScreenShare();
    } else {
        await startScreenShare();
    }
}

async function startScreenShare() {
    try {
        localScreenTrack = await AgoraRTC.createScreenVideoTrack({
            encoderConfig: "1080p_1"
        });

        if (Array.isArray(localScreenTrack)) {
             localScreenTrack = localScreenTrack[0];
        }
        
        localScreenTrack.on("track-ended", () => {
            stopScreenShare();
        });

        if (localVideoTrack) {
            await agoraClient.unpublish(localVideoTrack);
        }
        await agoraClient.publish(localScreenTrack);

        screenShareBtn.classList.add('screen-sharing');
        localPlayerContainer.innerHTML = '';
        localScreenTrack.play(localPlayerContainer);

    } catch (error) {
        console.error("Screen share failed:", error);
        localScreenTrack = null;
    }
}

async function stopScreenShare() {
    if (!localScreenTrack) return;

    await agoraClient.unpublish(localScreenTrack);
    localScreenTrack.close();
    localScreenTrack = null;

    if (localVideoTrack) {
        await agoraClient.publish(localVideoTrack);
        localPlayerContainer.innerHTML = '';
        localVideoTrack.play(localPlayerContainer);
    }

    screenShareBtn.classList.remove('screen-sharing');
}

// --- Event Listeners ---
if (screenShareBtn) {
    screenShareBtn.onclick = toggleScreenShare;
}

// --- Handle Remote Users ---
async function handleUserPublished(user, mediaType) {
    await agoraClient.subscribe(user, mediaType);

    if (mediaType === "video") {
        let tileId = `remote-tile-${user.uid}`;
        let playerContainerId = `remote-player-${user.uid}`;
        
        if (!document.getElementById(tileId)) {
             const tile = document.createElement('div');
             tile.id = tileId;
             tile.className = 'participant-tile';
             
             const player = document.createElement('div');
             player.id = playerContainerId;
             player.style.width = '100%';
             player.style.height = '100%';
             tile.appendChild(player);

             const nameTag = document.createElement('div');
             nameTag.className = 'participant-name';
             nameTag.textContent = `User ${user.uid}`;
             tile.appendChild(nameTag);

             videoGrid.appendChild(tile);
             remoteUsers[user.uid] = { tile: tile };
        }
        
        user.videoTrack.play(playerContainerId);
    }

    if (mediaType === "audio") {
        user.audioTrack.play();
    }
}

function handleUserUnpublished(user, mediaType) {
    if (mediaType === "video") {
        const p = document.getElementById(`remote-player-${user.uid}`);
        if(p) p.innerHTML = '';
    }
}

function handleUserLeft(user) {
    const tile = document.getElementById(`remote-tile-${user.uid}`);
    if (tile) tile.remove();
    delete remoteUsers[user.uid];
}

// --- Leave Call ---
async function leaveCall() {
    if (isLeaving) return;
    isLeaving = true;

    if (ws) ws.close();
    if (verificationInterval) clearInterval(verificationInterval);

    if (localScreenTrack) localScreenTrack.close();
    localAudioTrack?.close();
    localVideoTrack?.close();

    if (agoraClient) await agoraClient.leave();

    window.location.href = '/dashboard';
}

// --- Controls ---
if(leaveBtn) leaveBtn.onclick = leaveCall;

if(micBtn) {
    micBtn.onclick = async () => {
        if(localAudioTrack) {
            const enabled = localAudioTrack.enabled;
            await localAudioTrack.setEnabled(!enabled);
            micBtn.classList.toggle('mic-off', enabled);
        }
    }
}

if(camBtn) {
    camBtn.onclick = async () => {
        if(localVideoTrack) {
            const enabled = localVideoTrack.enabled;
            await localVideoTrack.setEnabled(!enabled);
            camBtn.classList.toggle('cam-off', enabled);
        }
    }
}

// --- Init ---
window.addEventListener('load', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const channel = urlParams.get('channel');
    if (channel) {
        await joinCall(channel);
    } else {
        alert("No channel provided.");
        window.location.href = '/dashboard';
    }
});