# MarketAI - Market Analysis with AI

MarketAI is a powerful application for analyzing market data using AI techniques. The application provides a user-friendly interface for uploading, preprocessing, analyzing, and visualizing market data.

## Features

- **Data Upload**: Easily upload CSV, Excel, and JSON files
- **Data Preprocessing**: Clean and prepare your data for analysis using our powerful preprocessing agent
- **Market Analysis**: Identify relationships and patterns in your market data
- **BI Reporting**: Generate comprehensive business intelligence reports

## Getting Started

### Prerequisites

- Python 3.8+ with pip
- Node.js and npm

### Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Install frontend dependencies:
   ```bash
   npm install
   ```

### Running the Application

#### Backend Server

1. Start the backend server with our convenient script:
   ```bash
   python start_server.py
   ```
   
   Or to automatically install dependencies:
   ```bash
   python start_server.py --install-deps
   ```

2. The server will be available at http://127.0.0.1:5000 with the following endpoints:
   - `POST /api/upload` or `/upload`: Upload a file
   - `GET /api/dataset/info`: Get dataset information
   - `POST /api/preprocess`: Preprocess data
   - `POST /api/analyze`: Run market analysis

#### Frontend Application

1. Start the frontend development server:
   ```bash
   npm run dev
   ```

2. The application will be available at http://localhost:5173

3. Use the UI to:
   - Upload market data files
   - Preprocess your data
   - Run market analysis
   - Generate BI reports

#### Production Deployment

For production deployment:

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Serve the frontend using a static file server:
   ```bash
   npx serve -s dist
   ```

3. Make sure the backend server is running as described above.

## Usage Guide

1. **Upload Data**: Start by uploading a market dataset (CSV, Excel, or JSON file)
2. **Preprocess Data**: Clean and prepare your data with the preprocessing options
3. **Analyze Data**: Run the market analysis to identify relationships and patterns
4. **Generate Reports**: Create BI reports based on your analysis
5. **Export Results**: Export your results in JSON format for further use

## Agents

The application uses the following intelligent agents:

1. **Data Preprocessing Agent**: Cleans, transforms, and prepares data for analysis
2. **Market Analysis Agent**: Analyzes feature relationships and identifies patterns
3. **BI Report Agent**: Generates comprehensive business intelligence reports

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React, Flask, and Gemini AI
- Created during a hackathon to demonstrate AI capabilities in market analysis 