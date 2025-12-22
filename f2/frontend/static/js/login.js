const API_BASE_URL = "http://localhost:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const errorMessage = document.getElementById("login-error-message");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            errorMessage.textContent = "";
            errorMessage.style.display = "none";

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            const formData = new URLSearchParams();
            formData.append("username", email);
            formData.append("password", password);

            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: formData,
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem("token", data.access_token);
                    localStorage.setItem("role", data.role || "client");
                    
                    if (data.role === "admin") {
                        window.location.href = "/dashboard";
                    } else {
                        window.location.href = "/profile"; 
                    }
                } else {
                    showError(data.detail || "Login failed. Please check your credentials.");
                }
            } catch (error) {
                console.error("Login Error:", error);
                showError("Unable to connect to the server. Is backend running?");
            }
        });
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = "block";
        errorMessage.classList.add("shake"); 
        setTimeout(() => errorMessage.classList.remove("shake"), 500);
    }
});