"""
Unified Full-Stack Launcher for AI Musculoskeletal Digital Twin:
Starts the FastAPI backend and Vite frontend, then opens the app in your browser.

Usage:
    python start_app.py
"""

import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"


def main():
    print("=" * 65)
    print("  🦾 AI REHAB DIGITAL TWIN — Musculoskeletal Biomechanics")
    print("=" * 65)
    print("\n[1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...")

    # Start FastAPI backend
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(ROOT_DIR),
    )

    # Wait 2 seconds for backend to initialize
    time.sleep(2)

    print("[2/3] Starting Frontend Dev Server on http://localhost:5173 ...")
    # Check if npm is available
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
    )

    time.sleep(2)
    app_url = "http://localhost:5173"
    print(f"[3/3] Opening browser at {app_url} ...")
    webbrowser.open(app_url)

    print("\n" + "=" * 65)
    print(f"  ✅ Application is live at: {app_url}")
    print("  📡 Backend API documentation at: http://127.0.0.1:8000/docs")
    print("  Press Ctrl+C in this terminal to stop both servers.")
    print("=" * 65 + "\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping AI Rehab Digital Twin servers...")
        frontend_proc.terminate()
        backend_proc.terminate()
        print("Servers stopped.")


if __name__ == "__main__":
    main()
