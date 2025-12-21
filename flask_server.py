from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
import tempfile
import logging
from werkzeug.utils import secure_filename
from msb_hackathon.charts_predict import DataPreprocessingAgent, MarketAnalysisApp

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

# Configure upload settings
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls', 'json'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Initialize preprocessing agent and market analysis app
preprocessing_agent = DataPreprocessingAgent()
market_analysis_app = None  # Will be initialized when a file is uploaded
current_dataset = None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and initialize the dataset"""
    global market_analysis_app, current_dataset
    
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
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            logger.info(f"File saved to {filepath}")
            
            # Initialize market analysis app with the uploaded file
            market_analysis_app = MarketAnalysisApp(filepath)
            
            # Store dataset info
            if market_analysis_app.dataset_manager and market_analysis_app.dataset_manager.data is not None:
                current_dataset = {
                    'filename': filename,
                    'rows': len(market_analysis_app.dataset_manager.data),
                    'columns': market_analysis_app.dataset_manager.data.columns.tolist(),
                    'data_sample': market_analysis_app.dataset_manager.data.head(5).to_dict(orient='records')
                }
            
            logger.info("Upload successful, returning response")
            return jsonify({
                'success': True,
                'file_info': {
                    'filename': filename,
                    'size': os.path.getsize(filepath),
                    'type': filename.rsplit('.', 1)[1].lower()
                },
                'data_preview': current_dataset['data_sample'] if current_dataset else []
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
    """Get information about the current dataset"""
    if not current_dataset:
        return jsonify({'error': 'No dataset available'}), 400
    
    return jsonify(current_dataset)

@app.route('/api/preprocess', methods=['POST'])
def preprocess_data():
    """Endpoint to preprocess data"""
    global current_dataset
    
    if not market_analysis_app or market_analysis_app.dataset_manager.data is None:
        return jsonify({'error': 'No dataset available for preprocessing'}), 400
    
    try:
        # Get data from request or use current dataset
        data = request.json.get('data')
        if data:
            df = pd.DataFrame(data)
        else:
            df = market_analysis_app.dataset_manager.data
        
        # Preprocess the data
        preprocessed_df = preprocessing_agent.preprocess(df)
        
        # Update the dataset in the market analysis app
        market_analysis_app.dataset_manager.data = preprocessed_df
        
        # Update current dataset info
        current_dataset = {
            'filename': current_dataset.get('filename', 'preprocessed_data.csv'),
            'rows': len(preprocessed_df),
            'columns': preprocessed_df.columns.tolist(),
            'data_sample': preprocessed_df.head(5).to_dict(orient='records'),
            'summary': preprocessing_agent.get_preprocessing_summary()
        }
        
        return jsonify({
            'success': True,
            'rows_before': len(df),
            'rows_after': len(preprocessed_df),
            'columns_before': len(df.columns),
            'columns_after': len(preprocessed_df.columns),
            'data_sample': current_dataset['data_sample']
        })
        
    except Exception as e:
        logger.error(f"Error during preprocessing: {str(e)}")
        return jsonify({'error': f'Error during preprocessing: {str(e)}'}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_data():
    """Endpoint to run market analysis"""
    if not market_analysis_app:
        return jsonify({'error': 'No dataset available for analysis'}), 400
    
    try:
        # Get data from request or use current dataset
        data = request.json.get('data')
        if data:
            df = pd.DataFrame(data)
            market_analysis_app.dataset_manager.data = df
        
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
    logger.info("Starting Flask server with CORS support")
    logger.info("API endpoints available:")
    logger.info("- POST /upload or /api/upload: Upload a file")
    logger.info("- POST /api/data/upload: Upload a file (legacy endpoint)")
    logger.info("- GET /api/dataset/info: Get dataset information")
    logger.info("- POST /api/preprocess: Preprocess data")
    logger.info("- POST /api/analyze: Run market analysis")
    app.run(debug=True, host='0.0.0.0', port=5000) 