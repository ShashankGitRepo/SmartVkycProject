const profileForm = document.getElementById('profile-form');
const passwordForm = document.getElementById('password-form');
const profilePictureInput = document.getElementById('profilePictureInput');
const profilePictureContainer = document.querySelector('.profile-picture'); 

const API_BASE_URL = "http://localhost:8000/api/v1";

async function fetchUserProfile() {
    const accessToken = localStorage.getItem('token'); 
    if (!accessToken) {
        window.location.href = '/login';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const userData = await response.json();

        if (response.ok) {
            document.getElementById('firstName').value = userData.first_name || '';
            document.getElementById('lastName').value = userData.last_name || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('dob').value = userData.birth_date || ''; 

            profilePictureContainer.innerHTML = ''; 
            const firstInitial = (userData.first_name || '?').charAt(0).toUpperCase();
            const lastInitial = (userData.last_name || '?').charAt(0).toUpperCase();
            const initialsSpan = document.createElement('span');
            initialsSpan.className = 'initials';
            initialsSpan.textContent = firstInitial + lastInitial;
            profilePictureContainer.appendChild(initialsSpan);

        } else if (response.status === 401) {
            logoutUser();
        } else {
            console.error('Error fetching profile:', userData);
        }
    } catch (error) {
        console.error('Network error:', error);
    }
}

if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
         event.preventDefault();
         
         const accessToken = localStorage.getItem('token');
         if (!accessToken) {
             logoutUser();
             return;
         }

         const profileData = {
             first_name: document.getElementById('firstName').value,
             last_name: document.getElementById('lastName').value,
             birth_date: document.getElementById('dob').value 
         };

         try {
             const response = await fetch(`${API_BASE_URL}/users/me`, {
                 method: 'PUT', 
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${accessToken}`
                 },
                 body: JSON.stringify(profileData)
             });
             
             const data = await response.json();

             if (response.ok) {
                 alert('Profile updated successfully!');
                 await fetchUserProfile(); 
             } else {
                 alert(`Update failed: ${data.detail || 'Unknown error'}`);
             }
         } catch (error) {
             console.error('Update error:', error);
             alert('Server connection failed.');
         }
    });
}

if (passwordForm) {
     passwordForm.addEventListener('submit', async (event) => {
         event.preventDefault();
         
         const accessToken = localStorage.getItem('token');
         if (!accessToken) { logoutUser(); return; }

         const currentPassword = document.getElementById('currentPassword').value;
         const newPassword = document.getElementById('newPassword').value;
         const confirmNewPassword = document.getElementById('confirmNewPassword').value;

         if (newPassword !== confirmNewPassword) {
             alert('New passwords do not match.');
             return;
         }

         try {
             const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${accessToken}`
                 },
                 body: JSON.stringify({
                     current_password: currentPassword,
                     new_password: newPassword
                 })
             });
             
             const data = await response.json();

             if (response.ok) {
                 alert('Password changed successfully!');
                 passwordForm.reset();
             } else {
                 alert(`Failed: ${data.detail}`);
             }
         } catch (error) {
             console.error('Password error:', error);
         }
    });
}

if (profilePictureInput) {
    profilePictureInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                profilePictureContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = e.target.result;
                profilePictureContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });
}

function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', fetchUserProfile);