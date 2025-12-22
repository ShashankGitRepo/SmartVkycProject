const API_BASE_URL = "http://localhost:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    const signupForm = document.getElementById("signup-form");

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const firstName = document.getElementById("first-name").value;
            const lastName = document.getElementById("last-name").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;

            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }

            const payload = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                password: password
            };

            try {
                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                const data = await response.json();

                if (response.ok) {
                    alert("Account created successfully! Redirecting to login...");
                    window.location.href = "/login";
                } else {
                    alert(`Registration failed: ${data.detail}`);
                }
            } catch (error) {
                console.error("Signup Error:", error);
                alert("Unable to connect to the server.");
            }
        });
    }
});