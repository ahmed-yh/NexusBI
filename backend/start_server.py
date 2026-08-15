#!/usr/bin/env python
"""
Start the Flask backend server with CORS support.
This script runs the Flask server defined in flask_server.py.
"""

import os
import sys
import subprocess

# Resolve paths relative to this script's own location, so it works whether it's
# invoked as `python start_server.py` (from inside backend/) or `python backend/start_server.py`
# (from the repo root).
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


def install_requirements():
    """Install required packages if not already installed"""
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", os.path.join(BACKEND_DIR, "requirements.txt")]
        )
        print("✅ Dependencies installed successfully")
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        sys.exit(1)

def start_server():
    """Start the Flask server"""
    try:
        print("🚀 Starting Flask server...")
        print("📋 API Endpoints:")
        print("   - POST /api/upload or /upload: Upload a file")
        print("   - POST /api/data/upload: Upload a file (legacy endpoint)")
        print("   - GET /api/dataset/info: Get dataset information")
        print("   - POST /api/preprocess: Preprocess data")
        print("   - POST /api/analyze: Run market analysis")
        print("\n💻 Server will be available at: http://127.0.0.1:5000")
        print("Press Ctrl+C to stop the server")

        # Run the Flask server
        subprocess.run([sys.executable, "flask_server.py"], cwd=BACKEND_DIR)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
    except Exception as e:
        print(f"❌ Error starting server: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Check if requirements need to be installed
    if "--install-deps" in sys.argv:
        install_requirements()
    
    # Start the server
    start_server() 