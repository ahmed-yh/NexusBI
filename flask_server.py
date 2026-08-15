from flask import Flask, request, jsonify, session
from flask_cors import CORS
import pandas as pd
import os
import tempfile
import logging
import uuid
from werkzeug.utils import secure_filename
from msb_hackathon.charts_predict import DataPreprocessingAgent, MarketAnalysisApp

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24))

# CORS: restrict to an explicit allow-list (required for credentialed/session-cookie requests -
# browsers reject wildcard "*" origins once supports_credentials is on). Configure via
# ALLOWED_ORIGINS (comma-separated) in production; defaults cover local dev.
allowed_origins = [
    origin.strip()
    for origin in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
    if origin.strip()
]
CORS(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)

# Configure upload settings
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls', 'json'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Per-visitor state. Each browser session gets its own MarketAnalysisApp/current_dataset instead
# of sharing one global pair, so concurrent visitors on a public deployment don't see or
# overwrite each other's uploaded dataset.
sessions = {}


def get_session_id():
    if 'sid' not in session:
        session['sid'] = uuid.uuid4().hex
    return session['sid']


def get_session_state():
    sid = get_session_id()
    return sessions.setdefault(sid, {'market_analysis_app': None, 'current_dataset': None})


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and initialize the dataset for the current session"""
    logger.info("Upload endpoint called")

    if 'file' not in request.files:
        logger.error("No file part in the request")
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']

    if file.filename == '':
        logger.error("No file selected")
        return jsonify({'error': 'No file selected'}), 400

    if file and allowed_file(file.filename):
        try:
            state = get_session_state()

            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{get_session_id()}_{filename}")
            file.save(filepath)

            logger.info(f"File saved to {filepath}")

            # Initialize market analysis app with the uploaded file
            market_analysis_app = MarketAnalysisApp(filepath)
            state['market_analysis_app'] = market_analysis_app

            # Store dataset info
            state['current_dataset'] = None
            if market_analysis_app.dataset_manager and market_analysis_app.dataset_manager.data is not None:
                sample_size = min(1000, len(market_analysis_app.dataset_manager.data))
                state['current_dataset'] = {
                    'filename': filename,
                    'rows': len(market_analysis_app.dataset_manager.data),
                    'columns': market_analysis_app.dataset_manager.data.columns.tolist(),
                    'data_sample': market_analysis_app.dataset_manager.data.head(sample_size).to_dict(orient='records')
                }

            logger.info("Upload successful, returning response")
            return jsonify({
                'success': True,
                'file_info': {
                    'filename': filename,
                    'size': os.path.getsize(filepath),
                    'type': filename.rsplit('.', 1)[1].lower()
                },
                'data_preview': state['current_dataset']['data_sample'] if state['current_dataset'] else []
            })

        except Exception as e:
            logger.error(f"Error during file upload: {str(e)}")
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500

    logger.error(f"File type not allowed: {file.filename}")
    return jsonify({'error': 'File type not allowed'}), 400

# Also support legacy endpoint for backward compatibility
@app.route('/api/data/upload', methods=['POST'])
def upload_file_legacy():
    """Legacy endpoint for file upload"""
    logger.info("Legacy upload endpoint called")
    return upload_file()

@app.route('/api/dataset/info', methods=['GET'])
def get_dataset_info():
    """Get information about the current session's dataset"""
    state = get_session_state()
    if not state['current_dataset']:
        return jsonify({'error': 'No dataset available'}), 400

    return jsonify(state['current_dataset'])

@app.route('/api/preprocess', methods=['POST'])
def preprocess_data():
    """Endpoint to preprocess data"""
    state = get_session_state()
    market_analysis_app = state['market_analysis_app']

    if not market_analysis_app or market_analysis_app.dataset_manager.data is None:
        return jsonify({'error': 'No dataset available for preprocessing'}), 400

    try:
        preprocessing_agent = DataPreprocessingAgent()

        # Get data from request or use current dataset
        data = request.json.get('data') if (request.is_json and request.json) else None
        if not data and market_analysis_app.dataset_manager.data is not None:
            df = market_analysis_app.dataset_manager.data
        elif data and market_analysis_app.dataset_manager.data is not None:
            # If the payload is just a sample, keep the full dataset instead of overwriting it
            df = market_analysis_app.dataset_manager.data if len(data) <= 5 else pd.DataFrame(data)
        elif data:
            df = pd.DataFrame(data)
        else:
            df = market_analysis_app.dataset_manager.data

        # Preprocess the data
        preprocessed_df = preprocessing_agent.preprocess(df)

        # Update the dataset in the market analysis app
        market_analysis_app.dataset_manager.data = preprocessed_df

        # Update current dataset info
        sample_size = min(1000, len(preprocessed_df))
        current_dataset = state['current_dataset']
        state['current_dataset'] = {
            'filename': current_dataset.get('filename', 'preprocessed_data.csv') if current_dataset else 'preprocessed_data.csv',
            'rows': len(preprocessed_df),
            'columns': preprocessed_df.columns.tolist(),
            'data_sample': preprocessed_df.head(sample_size).to_dict(orient='records'),
            'summary': preprocessing_agent.get_preprocessing_summary()
        }

        return jsonify({
            'success': True,
            'rows_before': len(df),
            'rows_after': len(preprocessed_df),
            'columns_before': len(df.columns),
            'columns_after': len(preprocessed_df.columns),
            'data_sample': state['current_dataset']['data_sample']
        })

    except Exception as e:
        logger.error(f"Error during preprocessing: {str(e)}")
        return jsonify({'error': f'Error during preprocessing: {str(e)}'}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_data():
    """Endpoint to run market analysis"""
    state = get_session_state()
    market_analysis_app = state['market_analysis_app']

    if not market_analysis_app:
        return jsonify({'error': 'No dataset available for analysis'}), 400

    try:
        # Get data from request or use current dataset
        data = request.json.get('data') if (request.is_json and request.json) else None
        if data and market_analysis_app.dataset_manager.data is not None and len(data) > 5:
            # Avoid overwriting with a small frontend-provided sample
            market_analysis_app.dataset_manager.data = pd.DataFrame(data)
        elif data and market_analysis_app.dataset_manager.data is None:
            market_analysis_app.dataset_manager.data = pd.DataFrame(data)

        # Run the analysis
        relationships, report = market_analysis_app.run_analysis()

        return jsonify({
            'success': True,
            'relationships': relationships,
            'report': report
        })

    except Exception as e:
        logger.error(f"Error during analysis: {str(e)}")
        return jsonify({'error': f'Error during analysis: {str(e)}'}), 500

# Simple health check endpoint
@app.route('/', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Server is running',
        'endpoints': [
            {'method': 'POST', 'path': '/upload', 'description': 'Upload a file'},
            {'method': 'POST', 'path': '/api/upload', 'description': 'Upload a file (same as /upload)'},
            {'method': 'POST', 'path': '/api/data/upload', 'description': 'Upload a file (legacy endpoint)'},
            {'method': 'GET', 'path': '/api/dataset/info', 'description': 'Get dataset information'},
            {'method': 'POST', 'path': '/api/preprocess', 'description': 'Preprocess data'},
            {'method': 'POST', 'path': '/api/analyze', 'description': 'Run market analysis'}
        ]
    })

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'

    logger.info("Starting Flask server with CORS support")
    logger.info(f"Allowed origins: {allowed_origins}")
    logger.info("API endpoints available:")
    logger.info("- POST /upload or /api/upload: Upload a file")
    logger.info("- POST /api/data/upload: Upload a file (legacy endpoint)")
    logger.info("- GET /api/dataset/info: Get dataset information")
    logger.info("- POST /api/preprocess: Preprocess data")
    logger.info("- POST /api/analyze: Run market analysis")
    app.run(debug=debug, host='0.0.0.0', port=port)
