import axios from 'axios';

// Interface definitions for agent responses
interface WebScraperResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

interface DataImportResponse {
  success: boolean;
  file_info?: {
    filename: string;
    size: number;
    type: string;
  };
  data_preview?: any[];
  error?: string;
}

interface DataProcessorResponse {
  success: boolean;
  preprocessing_stats?: {
    rows_before: number;
    rows_after: number;
    columns_before: number;
    columns_after: number;
    missing_values_handled: number;
    outliers_handled: number;
  };
  data_sample?: any[];
  rows_before?: number;
  rows_after?: number;
  columns_before?: number;
  columns_after?: number;
  summary?: string[];
  analyzed_at?: string;
  report?: string;
  relationships?: Array<{
    feature1: string;
    feature2: string;
    type: string;
    description: string;
  }>;
  column_stats?: {
    [column: string]: {
      min: number;
      max: number;
      mean: number;
      median: number;
      std: number;
    }
  };
  error?: string;
}

interface DatasetManagerResponse {
  success: boolean;
  dataset_info?: {
    name: string;
    rows: number;
    columns: number;
    size: number;
    column_types: Record<string, string>;
    columns_list?: any[];
    data_sample?: any[];
    validation_errors?: string[];
  };
  error?: string;
}

interface AnalysisResponse {
  success: boolean;
  relationships?: any[];
  report?: string;
  error?: string;
}

// Base URL for API requests
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

// Shared axios instance. withCredentials is required so the backend's session cookie
// (used to scope each visitor's dataset separately) round-trips with every request.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Agent wrappers
export const webScraperAgent = {
  scrapeUrl: async (url: string, options?: any): Promise<WebScraperResponse> => {
    try {
      const response = await apiClient.post(`/data/web-import`, {
        url,
        scrape_config: options || { table_selector: 'table', use_headers: true }
      });
      return response.data;
    } catch (error: any) {
      console.error('Web scraper agent error:', error);
      return {
        success: false,
        error: error.message || 'Failed to scrape data from URL'
      };
    }
  }
};

export const dataImportAgent = {
  importFile: async (file: File): Promise<DataImportResponse> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Try the primary endpoint, falling back to the legacy one if the backend hasn't
      // been updated yet.
      try {
        console.log("Attempting upload to new endpoint:", `${API_BASE_URL}/upload`);
        const response = await apiClient.post(`/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000 // Extended timeout for file uploads
        });
        return {
          success: true,
          file_info: {
            filename: file.name,
            size: file.size,
            type: file.type
          },
          data_preview: response.data.data_preview || []
        };
      } catch (mainError) {
        console.error("New upload endpoint failed, trying legacy endpoint:", mainError);

        const response = await apiClient.post(`/data/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000
        });
        return response.data;
      }
    } catch (error: any) {
      console.error('Data import agent error details:', error);
      
      // Improved error handling with more specific messages
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Connection timeout. The server took too long to respond.'
          };
        }
        if (!error.response) {
          return {
            success: false,
            error: 'Network Error: Cannot connect to server. Please check if the backend is running.'
          };
        }
        if (error.response.status === 413) {
          return {
            success: false,
            error: 'File too large. Please upload a smaller file.'
          };
        }
        if (error.response.data && error.response.data.error) {
          return {
            success: false,
            error: error.response.data.error
          };
        }
      }
      
      return {
        success: false,
        error: error.message || 'Failed to import file'
      };
    }
  }
};

export const dataProcessorAgent = {
  processData: async (data?: any): Promise<DataProcessorResponse> => {
    try {
      console.log('Processing data with new API endpoint');
      const response = await apiClient.post(`/preprocess`, data ? { data } : {});
      
      return {
        success: true,
        preprocessing_stats: {
          rows_before: response.data.rows_before || 0,
          rows_after: response.data.rows_after || 0,
          columns_before: response.data.columns_before || 0,
          columns_after: response.data.columns_after || 0,
          missing_values_handled: response.data.missing_values_handled || 0,
          outliers_handled: response.data.outliers_handled || 0
        },
        data_sample: response.data.data_sample || [],
        rows_before: response.data.rows_before,
        rows_after: response.data.rows_after,
        columns_before: response.data.columns_before,
        columns_after: response.data.columns_after,
        summary: response.data.summary || [],
        analyzed_at: response.data.analyzed_at,
        report: response.data.report || '',
        relationships: response.data.relationships || [],
        column_stats: response.data.column_stats || {}
      };
    } catch (error: any) {
      console.error('Data processor agent error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process data'
      };
    }
  }
};

export const datasetManagerAgent = {
  getDatasetInfo: async (): Promise<DatasetManagerResponse> => {
    try {
      const response = await apiClient.get(`/dataset/info`);
      
      // Map the API response to our frontend interface format
      if (response.data) {
        return {
          success: true,
          dataset_info: {
            name: response.data.filename || 'Unnamed Dataset',
            rows: response.data.rows || 0,
            columns: response.data.columns?.length || 0,
            size: response.data.memory_usage || 0,
            column_types: response.data.dtypes || {},
            // Additional fields that might be useful for the frontend
            columns_list: response.data.columns || [],
            data_sample: response.data.data_sample || [],
            validation_errors: response.data.validation_errors || []
          }
        };
      } else {
        return {
          success: false,
          error: 'No dataset information returned from server'
        };
      }
    } catch (error: any) {
      // Handle specific error for no dataset available
      if (error.response && error.response.status === 400 && 
          error.response.data && error.response.data.error === 'No dataset available') {
        console.log('No dataset has been uploaded yet');
        return {
          success: false,
          error: 'Please upload a dataset using the upload button'
        };
      }
      
      console.error('Dataset manager agent error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get dataset info'
      };
    }
  },
  
  validateDataset: async (): Promise<DatasetManagerResponse> => {
    try {
      const response = await apiClient.post(`/dataset/validate`);
      if (response.data) {
        return {
          success: true,
          dataset_info: {
            name: response.data.filename || 'Validated Dataset',
            rows: response.data.rows || 0,
            columns: response.data.columns?.length || 0,
            size: response.data.memory_usage || 0,
            column_types: response.data.dtypes || {},
            validation_errors: response.data.validation_errors || []
          }
        };
      } else {
        return {
          success: false,
          error: 'No validation results returned from server'
        };
      }
    } catch (error: any) {
      console.error('Dataset validation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to validate dataset'
      };
    }
  }
};

// New agent for data analysis using the new /api/analyze endpoint
export const dataAnalysisAgent = {
  analyzeData: async (data?: any): Promise<AnalysisResponse> => {
    try {
      console.log('Analyzing data with new API endpoint');
      const response = await apiClient.post(`/analyze`, data ? { data } : {});
      
      return {
        success: true,
        relationships: response.data.relationships || [],
        report: response.data.report || ''
      };
    } catch (error: any) {
      console.error('Data analysis agent error:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze data'
      };
    }
  },
  
  generateBIReport: async (data?: any): Promise<AnalysisResponse> => {
    // Both endpoints call the same analysis logic on the backend
    return dataAnalysisAgent.analyzeData(data);
  }
};

// Export all agents as a default object
export default {
  webScraperAgent,
  dataImportAgent,
  dataProcessorAgent,
  datasetManagerAgent,
  dataAnalysisAgent
}; 