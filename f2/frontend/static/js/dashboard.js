const API_BASE_URL = "http://localhost:8000/api/v1";

const logoutButton = document.getElementById('logoutButton');
const newMeetingBtn = document.getElementById('newMeetingBtn');
const joinMeetingBtn = document.getElementById('joinMeetingBtn');
const meetingCodeInput = document.getElementById('meetingCodeInput');
const userNameSpan = document.getElementById('user-name-display');
const vkycCard = document.getElementById('vkyc-action-card');

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const user = await response.json();
            if (userNameSpan) userNameSpan.textContent = user.first_name || "User";
            
            if (user.role === 'admin' && vkycCard) {
                vkycCard.style.display = 'none'; 
            }
        } else {
            logoutUser();
        }
    } catch (error) {
        console.error("Failed to fetch profile:", error);
    }
});

if (newMeetingBtn) {
    newMeetingBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        
        const originalText = newMeetingBtn.innerHTML;
        newMeetingBtn.innerHTML = "Creating...";
        newMeetingBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/meetings/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: "Instant Meeting" })
            });

            if (response.ok) {
                const data = await response.json();
                const meetingCode = data.meeting_code;
                const joinUrl = data.join_url;

                const joinNow = prompt(
                    `Meeting Created! Share this link:\n\n${joinUrl}\n\nClick OK to join now.`,
                    joinUrl
                );

                if (joinNow !== null) {
                    window.location.href = `/call?channel=${meetingCode}`;
                }
            } else {
                alert("Failed to create meeting. Please try again.");
            }
        } catch (error) {
            console.error("Meeting Error:", error);
            alert("Server error. Check console.");
        } finally {
            newMeetingBtn.innerHTML = originalText;
            newMeetingBtn.disabled = false;
        }
    });
}

if (joinMeetingBtn && meetingCodeInput) {
    const joinAction = () => {
        const input = meetingCodeInput.value.trim();
        if (!input) return alert("Please enter a code.");

        let code = input;
        if (input.includes("/meet/")) {
            const parts = input.split("/meet/");
            code = parts[1].split("?")[0]; 
        } else if (input.includes("channel=")) {
            const url = new URL(input);
            code = url.searchParams.get("channel");
        }

        if (code) {
            window.location.href = `/call?channel=${code}`;
        } else {
            alert("Invalid meeting link or code.");
        }
    };

    joinMeetingBtn.addEventListener('click', joinAction);
    meetingCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinAction();
    });
}

function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/login';
}

if (logoutButton) logoutButton.addEventListener('click', logoutUser);