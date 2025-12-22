from flask import Flask, render_template, redirect, url_for, request
import os

app = Flask(__name__)

@app.route("/")
def root():
    """Redirects the root URL to the login page."""
    return redirect(url_for('login_page'))

@app.route("/dashboard")
def dashboard_page():
    """Serves the main dashboard page."""
    return render_template("dashboard.html")

@app.route("/profile")
def profile_page():
    """Serves the user profile page."""
    return render_template("profile.html")

@app.route("/verify")
def verify_page():
    """Serves the VKYC video verification page (verify.html)."""
    return render_template("verify.html")

@app.route("/call")
def call_page():
    """Serves the Agora video call page (call.html).
    Injects backend_url into the template so frontend JS can auto-detect the API host (ngrok, env override, or localhost:8000 fallback).
    """
    backend_url = os.getenv('NGROK_URL') or os.getenv('BACKEND_PUBLIC_URL')
    if not backend_url:
        scheme = request.scheme
        hostname = request.host.split(':')[0]
        backend_url = f"{scheme}://{hostname}:8000"
    return render_template("call.html", backend_url=backend_url)

@app.route("/meet/<meeting_code>")
def join_meeting_link(meeting_code):
    return redirect(url_for('call_page', channel=meeting_code))

@app.route("/login")
def login_page():
    """Serves the login page."""
    return render_template("login.html")

@app.route("/signup")
def signup_page():
    """Serves the signup page."""
    return render_template("signup.html") 


@app.context_processor
def inject_backend_url():
    backend_url = os.getenv('NGROK_URL') or os.getenv('BACKEND_PUBLIC_URL') or ''
    return dict(backend_url=backend_url)

if __name__ == "__main__":
    app.run(
        host='0.0.0.0',
        port=5100,
        debug=True,
    )