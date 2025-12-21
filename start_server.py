#!/usr/bin/env python
"""
Start the Flask backend server with CORS support.
This script runs the Flask server defined in flask_server.py.
"""

import os
import sys
import subprocess

def install_requirements():
    """Install required packages if not already installed"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
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
        os.system(f"{sys.executable} flask_server.py")
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