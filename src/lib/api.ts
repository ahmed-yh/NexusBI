import axios from 'axios';

// Base URL for API requests
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

// Alternative URLs to try if main URL fails
const ALTERNATIVE_URLS = [
  'http://localhost:5000/api',
  'http://192.168.48.44:5000/api'
];

// Axios instance with common configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required so the backend's per-visitor session cookie round-trips
  timeout: 30000, // Increased timeout for larger file uploads
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.code === 'ECONNABORTED' || !error.response) {
      return Promise.reject({
        message: 'Connection to server failed. Please check if the backend server is running.'
      });
    }
    return Promise.reject(error.response?.data || error);
  }
);

// Data Import API
export const dataImportApi = {
  // Upload a file to the server
  uploadFile: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Try main URL first
      try {
        console.log("Attempting upload to:", API_BASE_URL);
        const response = await axios.post(`${API_BASE_URL}/data/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: false, // Try without credentials for upload
          timeout: 60000, // Extended timeout for file uploads
        });
        return response.data;
      } catch (mainError) {
        console.error("Main URL failed:", mainError);
        
        // Try alternative URLs if main fails
        for (const altUrl of ALTERNATIVE_URLS) {
          try {
            console.log("Attempting upload to alternative URL:", altUrl);
            const response = await axios.post(`${altUrl}/data/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              withCredentials: false,
              timeout: 60000,
            });
            return response.data;
          } catch (altError) {
            console.error(`Alternative URL ${altUrl} failed:`, altError);
            // Continue to next URL
          }
        }
        
        // If we get here, all URLs failed
        throw mainError;
      }
    } catch (error) {
      console.error('File upload error details:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Connection timeout. The server took too long to respond.');
        }
        if (!error.response) {
          throw new Error('Network Error: Cannot connect to server. Please check if the backend is running on port 5000 and there are no firewall or CORS issues.');
        }
      }
      throw error;
    }
  },
  
  // Import data from a web source
  importFromWeb: async (url: string, scrapeConfig: any) => {
    const response = await apiClient.post('/data/web-import', {
      url,
      scrape_config: scrapeConfig,
    });
    
    return response.data;
  },
  
  // Get import statistics
  getImportStats: async () => {
    const response = await apiClient.get('/data/import-stats');
    return response.data;
  },
};

// Data Preprocessing API - Updated for new backend
export const preprocessingApi = {
  // Preprocess data using the new /api/preprocess endpoint
  preprocess: async (data: any) => {
    try {
      console.log('Sending preprocessing request with data:', data);
      
      // Try main URL first
      try {
        const response = await apiClient.post('/preprocess', { data });
        console.log('Preprocessing response:', response.data);
        return response.data;
      } catch (mainError) {
        console.error("Main preprocessing URL failed:", mainError);
        
        // Try alternative URLs if main fails
        for (const altUrl of ALTERNATIVE_URLS) {
          try {
            console.log("Attempting preprocessing on alternative URL:", altUrl);
            const altClient = axios.create({
              baseURL: altUrl,
              headers: { 'Content-Type': 'application/json' },
              withCredentials: false,
              timeout: 60000, // Extended timeout for preprocessing
            });
            
            const response = await altClient.post('/preprocess', { data });
            console.log('Preprocessing response from alternative URL:', response.data);
            return response.data;
          } catch (altError) {
            console.error(`Alternative URL ${altUrl} preprocessing failed:`, altError);
            // Continue to next URL
          }
        }
        
        // If we get here, all URLs failed
        throw mainError;
      }
    } catch (error) {
      console.error('Preprocessing error details:', error);
      if (axios.isAxiosError(error) && error.response) {
        // If we have a response with error details from the server
        const serverError = error.response.data;
        console.error('Server error details:', serverError);
        throw new Error(serverError.error || 'Unknown server error');
      }
      throw error;
    }
  },
};

// Data Analysis API - Updated for new backend
export const dataAnalysisApi = {
  // Run analysis using the new /api/analyze endpoint
  analyzeDataset: async (data: any) => {
    try {
      console.log('Sending analysis request with data:', data);
      const response = await apiClient.post('/analyze', { data });
      console.log('Analysis response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Analysis error details:', error);
      if (axios.isAxiosError(error) && error.response) {
        const serverError = error.response.data;
        console.error('Server error details:', serverError);
        throw new Error(serverError.error || 'Unknown server error');
      }
      throw error;
    }
  },
  
  // Generate BI report using the same /api/analyze endpoint
  // The backend determines what to return based on the input data
  generateBIReport: async (data: any) => {
    try {
      console.log('Sending BI report request with data:', data);
      const response = await apiClient.post('/analyze', { data });
      console.log('BI report response:', response.data);
      return response.data;
    } catch (error) {
      console.error('BI report error details:', error);
      if (axios.isAxiosError(error) && error.response) {
        const serverError = error.response.data;
        console.error('Server error details:', serverError);
        throw new Error(serverError.error || 'Unknown server error');
      }
      throw error;
    }
  },
};

// Dataset Management API
export const datasetApi = {
  // Get current dataset info
  getDataInfo: async () => {
    const response = await apiClient.get('/dataset/info');
    return response.data;
  },
  
  // Get column profile for a specific column
  getColumnProfile: async (column: string) => {
    const response = await apiClient.get(`/dataset/column-profile/${column}`);
    return response.data;
  },
  
  // Reset to original dataset
  resetToOriginal: async () => {
    const response = await apiClient.post('/dataset/reset');
    return response.data;
  },
  
  // Validate dataset
  validateData: async () => {
    const response = await apiClient.post('/dataset/validate');
    return response.data;
  },
};

export default {
  dataImportApi,
  preprocessingApi,
  dataAnalysisApi,
  datasetApi,
}; 