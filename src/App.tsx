import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileSpreadsheet, FileJson, LineChart, Search, BellDot, User, ChevronDown, BarChart2, FileText, Globe, Download, AlertTriangle, ArrowLeft, FileQuestionIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { DataVisualization } from './components/DataVisualization';
import { Sidebar } from './components/Sidebar';
import { DashboardStats } from './components/DashboardStats';
import { DatasetCard } from './components/DatasetCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  dataImportAgent, 
  datasetManagerAgent,
  dataAnalysisAgent
} from '@/lib/agents';

// Define interface for dataset information
interface DatasetInfo {
  id?: string;
  name?: string;
  filename?: string;
  type?: string;
  size?: number;
  status?: 'ready' | 'processing' | 'error';
  uploadedAt?: Date;
  data_sample?: any[];
  rows?: number;
  rows_before?: number;
  rows_after?: number;
  columns?: number; // Total technical column count
  actual_columns?: number; // Actual logical feature count
  columns_before?: number;
  columns_after?: number;
  summary?: string[];
  preprocessed?: boolean;
  preprocessed_at?: string;
  features?: string[];
}

// Define interface for analysis results
interface AnalysisResults {
  success?: boolean;
  data_sample?: any[];
  rows_before?: number;
  rows_after?: number;
  columns_before?: number;
  columns_after?: number;
  summary?: string[];
  analyzed_at?: string;
  analyzed?: boolean;
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

// Helper function to format cell values for display
const formatCellValue = (value: any): string => {
  if (value === null || value === undefined) return 'N/A';
  
  // Check if it's a number and format it
  if (typeof value === 'number') {
    // For one-hot encoded or normalized values (very similar decimal values)
    if (Math.abs(value) < 0.1 && Math.abs(value) > 0.00001) {
      // For binary indicators (likely 0 or 1 that have been normalized)
      if (Math.abs(value - (-0.04)) < 0.001) {
        // Likely a one-hot encoded 0 value that's been normalized
        return "0";
      } else if (Math.abs(value - 0.96) < 0.001) {
        // Likely a one-hot encoded 1 value that's been normalized
        return "1";
      }
    }
    
    // If it's a very small decimal, showing scientific notation
    if (Math.abs(value) < 0.001) {
      return value.toExponential(3);
    }
    // For regular numbers with decimals
    if (!Number.isInteger(value)) {
      return value.toFixed(2);
    }
    // For integers
    return String(value);
  }
  
  // For strings, truncate if too long
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 47) + '...';
  }
  
  return String(value);
};

// Helper function to get display columns for data table
const getDisplayColumns = (data: any[] | undefined): string[] => {
  if (!data || data.length === 0) return [];
  
  const allKeys = Object.keys(data[0]);
  // If we suspect one-hot encoding, filter out company name columns for display
  if (isOneHotEncodedData(data)) {
    const companyPrefixPattern = /^company_name_/;
    // Show only non-company name columns + a few examples
    const nonCompanyColumns = allKeys.filter(key => !companyPrefixPattern.test(key));
    const companyColumns = allKeys.filter(key => companyPrefixPattern.test(key)).slice(0, 3);
    
    return [...nonCompanyColumns, ...companyColumns, '... (other company columns)'];
  }
  
  return allKeys;
};

// Helper function to determine if data appears to be one-hot encoded
const isOneHotEncodedData = (data: any[] | undefined): boolean => {
  if (!data || data.length === 0) return false;
  
  const keys = Object.keys(data[0]);
  const companyPrefixPattern = /^company_name_/;
  const companyFeatures = keys.filter(key => companyPrefixPattern.test(key));
  
  // If many company name features, likely one-hot encoded
  return companyFeatures.length > 5;
};

// Helper function to extract cell value for display, handling one-hot encoding
const getDisplayValue = (row: any, column: string, data: any[] | undefined): any => {
  if (!data || data.length === 0) return row[column];
  
  if (column === '... (other company columns)') {
    // Show count of remaining company columns with value 1
    const companyPrefixPattern = /^company_name_/;
    const companyColumns = Object.keys(row).filter(key => 
      companyPrefixPattern.test(key) && !getDisplayColumns(data).includes(key)
    );
    
    const activeCompanies = companyColumns.filter(col => 
      typeof row[col] === 'number' && 
      (Math.abs(row[col] - (-0.04)) > 0.001) // Not -0.04 (our binary 0)
    );
    
    return activeCompanies.length > 0 
      ? `${activeCompanies.length} more active` 
      : "0 active";
  }
  
  return row[column];
};

// Helper function to safely render a data table with proper type checking
const DataSampleTable = ({ data }: { data: any[] }) => {
  const columns = getDisplayColumns(data);
  
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-muted">
          {columns.map((column: string, i: number) => (
            <th key={i} className="p-2 text-left text-xs font-medium text-muted-foreground border">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, i: number) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/30'}>
            {columns.map((column: string, j: number) => (
              <td key={j} className="p-2 text-xs border">
                {formatCellValue(getDisplayValue(row, column, data))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// Helper function to extract features, handling one-hot encoded columns
const extractFeatures = (data: any): string[] => {
  if (!data || !data.length) return [];
  
  const allKeys = Object.keys(data[0]);
  // Identify likely one-hot encoded company names
  const companyPrefixPattern = /^company_name_/;
  const companyFeatures = allKeys.filter(key => companyPrefixPattern.test(key));
  
  // Extract the actual feature names (excluding one-hot encoded features)
  const regularFeatures = allKeys.filter(key => !companyPrefixPattern.test(key));
  
  // If we have many company name features, group them
  if (companyFeatures.length > 5) {
    return [
      ...regularFeatures,
      'company_name (one-hot encoded)'
    ];
  }
  
  return allKeys;
};

function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    // Try to load from URL or localStorage to persist state
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    if (pageParam && ['dashboard', 'upload', 'web-import', 'analysis', 'reports', 'json-export', 'visualization'].includes(pageParam)) {
      return pageParam;
    }
    return 'dashboard';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update URL when page changes to persist state
  useEffect(() => {
    // Update URL with current page for bookmarking/persistence
    const url = new URL(window.location.href);
    url.searchParams.set('page', currentPage);
    window.history.pushState({}, '', url);
    
    console.log(`Page changed to ${currentPage}, URL updated`);
  }, [currentPage]);

  // Mock data sample for analysis when no real data is available
  const mockDataSample = [
    { product: 'Product A', sales: 1200, revenue: 24000, region: 'North' },
    { product: 'Product B', sales: 800, revenue: 16000, region: 'South' },
    { product: 'Product C', sales: 1500, revenue: 30000, region: 'East' },
    { product: 'Product D', sales: 950, revenue: 19000, region: 'West' },
    { product: 'Product E', sales: 1100, revenue: 22000, region: 'North' },
  ];

  // Function to check dataset status and retrieve info
  const checkDataset = async () => {
    try {
      setIsLoading(true);
      const response = await datasetManagerAgent.getDatasetInfo();
      
      if (response.success && response.dataset_info) {
        const mappedInfo: DatasetInfo = {
          filename: response.dataset_info.name,
          size: response.dataset_info.size,
          rows: response.dataset_info.rows,
          columns: response.dataset_info.columns,
          actual_columns: response.dataset_info.columns,
          features: response.dataset_info.columns_list || [],
          data_sample: response.dataset_info.data_sample || [],
          status: 'ready' as const,
          uploadedAt: new Date()
        };
        setDatasetInfo(mappedInfo);
      } else {
        setDatasetInfo(null);
      }
    } catch (error) {
      console.error("Error checking dataset status:", error);
      setDatasetInfo(null);
      toast.error("Error loading dataset information");
    } finally {
      setIsLoading(false);
    }
  };

  // Load dataset info when component mounts
  useEffect(() => {
    checkDataset();
    // If no dataset is loaded, show a toast notification to guide the user
    setTimeout(() => {
      if (!datasetInfo) {
        toast.info('Please upload a dataset to begin your analysis', {
          duration: 5000,
          position: 'top-center'
        });
      }
    }, 1500); // Small delay to allow checkDataset to complete
  }, []);

  // Function to handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setIsLoading(true);
      console.log(`Attempting to upload file: ${file.name} (${file.size} bytes)`);
      
      // Add a loading toast
      toast.loading(`Uploading ${file.name}...`, {
        id: 'file-upload',
        duration: Infinity,
      });
      
      // First try direct file upload
      const response = await dataImportAgent.importFile(file);
      
      if (!response.success) {
        throw new Error(response.error || "Upload failed");
      }
      
      // Update toast with success
      toast.success(`File uploaded successfully: ${file.name}`, {
        id: 'file-upload'
      });
      
      // Then check for complete dataset info from the server
      await checkDataset();

      // Important: Don't change the page at all, this was causing visualization to redirect
      console.log(`File uploaded successfully. Staying on current page: ${currentPage}`);
    } catch (error: any) {
      console.error("File upload error:", error);
      
      // Update toast with error
      toast.error(error.message || "Failed to upload file", {
        id: 'file-upload'
      });
    } finally {
      setIsLoading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle analysis
  const handleRunAnalysis = async () => {
    setIsLoading(true);
    
    // Set a timeout to prevent infinite loading
    let timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast.error('Analysis timed out. The server may be busy or experiencing issues.');
    }, 60000); // 60 second timeout - analysis can take longer
    
    try {
      toast.info('Starting data analysis...');
      
      // Get the current dataset from state or use the mock data sample
      const data = datasetInfo?.data_sample || mockDataSample;
      
      // Call the new analyzeData method with the dataset
      const response = await dataAnalysisAgent.analyzeData(data);
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      console.log('Analysis response:', response);
      
      if (response.relationships) {
        // Store the analysis results
        setAnalysisResults({
          relationships: response.relationships || [],
          report: response.report || '',
          analyzed_at: new Date().toISOString(),
          analyzed: true
        });
        
        toast.success('Analysis completed successfully');
        setCurrentPage('analysis'); // Stay on analysis page to show results
      } else {
        toast.warning('Analysis completed but no relationships were found');
      }
    } catch (error: any) {
      // Clear the timeout since we got a response (even if it's an error)
      clearTimeout(timeoutId);
      
      console.error('Analysis error:', error);
      
      if (error.message?.includes('No dataset available')) {
        toast.error('No dataset available for analysis. Please upload and preprocess a file first.', { duration: 5000 });
      } else if (error.stack_trace) {
        console.error('Server stack trace:', error.stack_trace);
        toast.error(`Analysis failed: ${error.message || 'Unknown error'}. Check console for details.`, { duration: 7000 });
      } else {
        toast.error(`Analysis failed: ${error.message || 'Unknown error'}`, { duration: 5000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle BI report generation
  const handleGenerateBIReport = async () => {
    setIsLoading(true);
    
    // Set a timeout to prevent infinite loading
    let timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast.error('Report generation timed out. The server may be busy or experiencing issues.');
    }, 90000); // 90 second timeout - BI reports can take even longer
    
    try {
      toast.info('Generating BI Report. This may take a minute...');
      
      // Get the current dataset from state or use the mock data sample
      const data = datasetInfo?.data_sample || mockDataSample;
      
      // Call the new generateBIReport method with the dataset
      const response = await dataAnalysisAgent.generateBIReport(data);
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      if (!response.report || response.report.length < 10) {
        toast.error('Generated report is empty or invalid');
        setIsLoading(false);
        return;
      }
      
      // Update the analysisResults with the report and timestamp
      setAnalysisResults((prevResults: AnalysisResults | null) => {
        return {
          ...(prevResults || {}),
          report: response.report,
          analyzed_at: new Date().toISOString()
        };
      });
      
      toast.success('BI Report generated successfully');
      setCurrentPage('reports');
    } catch (error: any) {
      // Clear the timeout since we got a response (even if it's an error)
      clearTimeout(timeoutId);
      
      console.error('Error generating BI report:', error);
      toast.error(`Failed to generate BI report: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle JSON export
  const handleJsonExport = () => {
    if (!datasetInfo) {
      toast.error('No dataset available to export');
      return;
    }

    try {
      // Create a JSON blob and download it
      const jsonData = JSON.stringify(datasetInfo, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nexusbi_export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('JSON data exported successfully');
    } catch (error) {
      toast.error('Failed to export JSON data');
      console.error('JSON export error:', error);
    }
  };

  // Handle page change
  const handlePageChange = (page: string) => {
    console.log("Page change requested to:", page, "Current page:", currentPage);
    setCurrentPage(page);
    
    // Execute appropriate action based on page
    if (page === 'upload') {
      // Show upload instruction toast
      toast.info('Select a CSV, Excel, or JSON file to upload', {
        id: 'upload-instructions',
        duration: 3000
      });
      
      // Open file dialog with improved handling
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.xlsx,.xls,.json';
      
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          // Let the handleFileUpload function manage the toast messages
          handleFileUpload(e).catch((error) => {
            console.error('File upload error in input handler:', error);
            // Toast messages are already handled in handleFileUpload
          });
        } else {
          toast.error('No file selected', {
            id: 'upload-instructions'
          });
        }
      };
      
      // Show cancel message if dialog is dismissed
      setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          toast.info('File upload canceled. You can try again using the Upload button.', {
            id: 'upload-instructions',
            duration: 3000
          });
        }
      }, 3000);
      
      input.click();
    } else if (page === 'analysis' && datasetInfo) {
      handleRunAnalysis();
    } else if (page === 'reports' && datasetInfo) {
      handleGenerateBIReport();
    }
  };

  // Render page content based on current page
  const renderPageContent = () => {
    console.log(`Rendering page content for: ${currentPage}`);
    
    switch (currentPage) {
      case 'dashboard':
        return (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="h-5 w-5 text-accent" />
                  <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                </div>
                <p className="text-muted-foreground">
                  Analyze and visualize your data with AI-powered insights
                </p>
              </div>
              
              <Button 
                className="gap-2 bg-accent hover:bg-accent/90"
                onClick={() => handlePageChange('upload')}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4" />
                Upload Dataset
              </Button>
            </div>

            <DashboardStats />

            <div className="mt-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold">Recent Datasets</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1"
                  onClick={() => handleRunAnalysis()}
                  disabled={!datasetInfo || isLoading}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Run Analysis
                </Button>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {datasetInfo ? (
                  <>
                    <DatasetCard
                      key="current-dataset"
                      name={datasetInfo.filename || "Current Dataset"}
                      size={datasetInfo.size || (datasetInfo.rows || 0) * 100} // Estimate size if not provided
                      type={datasetInfo.filename?.split('.').pop() || 'csv'}
                      status="ready"
                      uploadedAt={new Date()}
                      onClick={() => handleRunAnalysis()}
                    />
                    
                    {/* Show dataset overview */}
                    <div className="col-span-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Dataset Overview</CardTitle>
                          <CardDescription>
                            Summary information about the current dataset
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h3 className="text-sm font-medium text-muted-foreground mb-2">Statistics</h3>
                              <dl className="space-y-2">
                                <div className="flex justify-between">
                                  <dt className="text-sm">Rows:</dt>
                                  <dd className="text-sm font-medium">{datasetInfo.rows || 0}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-sm">Columns:</dt>
                                  <dd className="text-sm font-medium">{datasetInfo.actual_columns || datasetInfo.features?.length || 0}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-sm">File Type:</dt>
                                  <dd className="text-sm font-medium">{(datasetInfo.filename || "").split('.').pop()?.toUpperCase() || "CSV"}</dd>
                                </div>
                              </dl>
                            </div>
                            
                            <div>
                              <h3 className="text-sm font-medium text-muted-foreground mb-2">Features</h3>
                              <div className="max-h-32 overflow-y-auto">
                                <ul className="space-y-1">
                                  {datasetInfo.features?.map((column: string, index: number) => (
                                    <li key={index} className="text-sm">{column}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                          
                          {/* Show data sample if available */}
                          {datasetInfo.data_sample && datasetInfo.data_sample.length > 0 && (
                            <div className="mt-6">
                              <h3 className="text-sm font-medium text-muted-foreground mb-2">Data Sample</h3>
                              <div className="overflow-x-auto border rounded-md">
                                <DataSampleTable data={datasetInfo.data_sample} />
                              </div>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter>
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="gap-1 w-full"
                            onClick={() => handleRunAnalysis()}
                            disabled={isLoading}
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                            Analyze Data
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>
                  </>
                ) : (
                  <div className="col-span-3">
                    <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
                      <CardContent className="flex flex-col items-center justify-center py-10">
                        <FileSpreadsheet className="h-12 w-12 text-slate-400 mb-4" />
                        <CardTitle className="text-center mb-2">No Dataset Available</CardTitle>
                        <CardDescription className="text-center mb-6">
                          Upload a dataset to begin your data analysis
                        </CardDescription>
                        <Button 
                          onClick={() => handlePageChange('upload')}
                          className="gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          Upload Dataset
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      
      case 'web-import':
        return (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-5 w-5 text-accent" />
                  <h1 className="text-3xl font-bold tracking-tight">Web Data Import</h1>
                </div>
                <p className="text-muted-foreground">
                  Import data directly from websites, APIs, or online datasets
                </p>
              </div>
            </div>

            <Card className="w-full border-amber-200 bg-amber-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <CardTitle>Coming Soon</CardTitle>
                </div>
                <CardDescription>
                  Web data importing capability is under development and will be available in a future update.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We're working on enhancing our web data import capabilities to provide you with:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>Direct imports from CSV endpoints</li>
                  <li>Web scraping functionality for structured data</li>
                  <li>API connectors for popular data sources</li>
                  <li>Automated data cleaning for web-imported data</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={() => setCurrentPage('upload')}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File Instead
                </Button>
              </CardFooter>
            </Card>
          </>
        );
      
      case 'upload':
        return (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Upload className="h-5 w-5 text-accent" />
                  <h1 className="text-3xl font-bold tracking-tight">Upload Dataset</h1>
                </div>
                <p className="text-muted-foreground">
                  Upload your data files for analysis
                </p>
              </div>
              
              <Button 
                className="gap-2 bg-accent hover:bg-accent/90"
                onClick={() => handlePageChange('upload')}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4" />
                Upload New File
              </Button>
            </div>

            {datasetInfo ? (
              <div className="grid gap-5 md:grid-cols-3">
                <DatasetCard
                  key="current-dataset"
                  name={datasetInfo.filename || "Current Dataset"}
                  size={datasetInfo.size || (datasetInfo.rows || 0) * 100} // Estimate size if not provided
                  type={datasetInfo.filename?.split('.').pop() || 'csv'}
                  status="ready"
                  uploadedAt={new Date()}
                  onClick={() => handleRunAnalysis()}
                />
                
                {/* Show dataset overview */}
                <div className="col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Dataset Overview</CardTitle>
                      <CardDescription>
                        Summary information about the current dataset
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Statistics</h3>
                          <dl className="space-y-2">
                            <div className="flex justify-between">
                              <dt className="text-sm">Rows:</dt>
                              <dd className="text-sm font-medium">{datasetInfo.rows || 0}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm">Columns:</dt>
                              <dd className="text-sm font-medium">{datasetInfo.actual_columns || datasetInfo.features?.length || 0}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm">File Type:</dt>
                              <dd className="text-sm font-medium">{(datasetInfo.filename || "").split('.').pop()?.toUpperCase() || "CSV"}</dd>
                            </div>
                          </dl>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Features</h3>
                          <div className="max-h-32 overflow-y-auto">
                            <ul className="space-y-1">
                              {datasetInfo.features?.map((column: string, index: number) => (
                                <li key={index} className="text-sm">{column}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      {/* Show data sample if available */}
                      {datasetInfo.data_sample && datasetInfo.data_sample.length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Data Sample</h3>
                          <div className="overflow-x-auto border rounded-md">
                            <DataSampleTable data={datasetInfo.data_sample} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="gap-1 w-full"
                        onClick={() => handleRunAnalysis()}
                        disabled={isLoading}
                      >
                        <BarChart2 className="h-3.5 w-3.5" />
                        Analyze Data
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="col-span-3">
                <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <FileSpreadsheet className="h-12 w-12 text-slate-400 mb-4" />
                    <CardTitle className="text-center mb-2">No Dataset Available</CardTitle>
                    <CardDescription className="text-center mb-6">
                      Upload a dataset to begin your data analysis
                    </CardDescription>
                    <Button 
                      onClick={() => handlePageChange('upload')}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Dataset
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        );
      
      case 'analysis':
        return (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="h-5 w-5 text-accent" />
                  <h1 className="text-3xl font-bold tracking-tight">Data Analysis</h1>
                </div>
                <p className="text-muted-foreground">
                  Analyze data and identify patterns, trends, and insights
                </p>
              </div>
              
              <Button 
                className="gap-2 bg-accent hover:bg-accent/90"
                onClick={handleRunAnalysis}
                disabled={!datasetInfo || isLoading}
              >
                <BarChart2 className="h-4 w-4" />
                Run Analysis
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-40 flex-col">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Analyzing data...</p>
                <p className="text-sm text-muted-foreground mt-2">This may take a minute or two</p>
              </div>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Analysis Options</CardTitle>
                    <CardDescription>
                      Select the types of analysis to perform on your data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 grid-cols-2">
                      <div className="border rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <ChevronDown className="h-5 w-5 text-primary" />
                          <h3 className="font-medium">Trend Analysis</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Identify key trends and patterns in your data
                        </p>
                      </div>
                      
                      <div className="border rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <ChevronDown className="h-5 w-5 text-primary" />
                          <h3 className="font-medium">Correlation Analysis</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Find relationships between different data factors
                        </p>
                      </div>
                      
                      <div className="border rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <ChevronDown className="h-5 w-5 text-primary" />
                          <h3 className="font-medium">Predictive Modeling</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Forecast future trends based on historical data
                        </p>
                      </div>
                      
                      <div className="border rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <ChevronDown className="h-5 w-5 text-primary" />
                          <h3 className="font-medium">Segment Analysis</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Identify key data segments and their characteristics
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-end">
                    <Button
                      onClick={handleRunAnalysis}
                      disabled={!datasetInfo || isLoading}
                    >
                      Run Data Analysis
                    </Button>
                  </CardFooter>
                </Card>

                {analysisResults && (
                  <>
                    {/* Feature Relationships Card */}
                    {analysisResults.relationships && analysisResults.relationships.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Feature Relationships</CardTitle>
                          <CardDescription>
                            Key relationships identified between features
                            {analysisResults.analyzed_at && (
                              <span className="block mt-1 text-xs">
                                Analysis completed on {new Date(analysisResults.analyzed_at).toLocaleString()}
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-muted">
                                  <th className="p-3 text-left font-medium text-muted-foreground border">Feature 1</th>
                                  <th className="p-3 text-left font-medium text-muted-foreground border">Feature 2</th>
                                  <th className="p-3 text-left font-medium text-muted-foreground border">Type</th>
                                  <th className="p-3 text-left font-medium text-muted-foreground border">Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysisResults.relationships.map((rel: any, i: number) => (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/30'}>
                                    <td className="p-3 border">{rel.feature1}</td>
                                    <td className="p-3 border">{rel.feature2}</td>
                                    <td className="p-3 border">{rel.type}</td>
                                    <td className="p-3 border">{rel.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* BI Report Preview Card */}
                    {analysisResults.report && (
                      <Card>
                        <CardHeader>
                          <CardTitle>BI Report Preview</CardTitle>
                          <CardDescription>
                            Preview of the business intelligence report
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="max-h-96 overflow-y-auto">
                          <div className="bg-white p-4 border rounded prose max-w-none">
                            {analysisResults.report && (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {String(analysisResults.report).length > 500 ? 
                                  String(analysisResults.report).slice(0, 500) + '...' : 
                                  String(analysisResults.report)}
                              </ReactMarkdown>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            onClick={() => setCurrentPage('reports')}
                            className="w-full"
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            View Full Report
                          </Button>
                        </CardFooter>
                      </Card>
                    )}

                    {/* Column Statistics */}
                    {analysisResults.column_stats && Object.keys(analysisResults.column_stats).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Column Statistics</CardTitle>
                          <CardDescription>
                            Statistical summary of numerical columns
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-muted">
                                  <th className="p-2 text-left text-xs font-medium text-muted-foreground border">Column</th>
                                  <th className="p-2 text-left text-xs font-medium text-muted-foreground border">Min</th>
                                  <th className="p-2 text-left text-xs font-medium text-muted-foreground border">Max</th>
                                  <th className="p-2 text-left text-xs font-medium text-muted-foreground border">Mean</th>
                                  <th className="p-2 text-left text-xs font-medium text-muted-foreground border">Median</th>
                                  <th className="p-2 text-left text-xs font-medium text-muted-foreground border">Std Dev</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(analysisResults.column_stats || {}).map(([column, stats]: [string, any], i: number) => (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/30'}>
                                    <td className="p-2 text-xs border font-medium">{column}</td>
                                    <td className="p-2 text-xs border">{stats.min?.toFixed(2) || 'N/A'}</td>
                                    <td className="p-2 text-xs border">{stats.max?.toFixed(2) || 'N/A'}</td>
                                    <td className="p-2 text-xs border">{stats.mean?.toFixed(2) || 'N/A'}</td>
                                    <td className="p-2 text-xs border">{stats.median?.toFixed(2) || 'N/A'}</td>
                                    <td className="p-2 text-xs border">{stats.std?.toFixed(2) || 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardFooter className="justify-between pt-6">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage('analysis')}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back to Dashboard
                        </Button>
                        <Button
                          onClick={handleGenerateBIReport}
                          disabled={isLoading}
                        >
                          Generate BI Report
                        </Button>
                      </CardFooter>
                    </Card>
                  </>
                )}
              </div>
            )}
          </>
        );
      
      case 'reports':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tight">
                BI Report Generator
              </h2>
              <Button
                onClick={handleGenerateBIReport}
                disabled={isLoading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Generate New Report
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center p-12">
                <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                <p className="text-lg font-medium">Generating BI Report...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This may take a moment. We're analyzing your data and creating a comprehensive report.
                </p>
              </div>
            ) : (
              <>
                {analysisResults && analysisResults.report ? (
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center">
                        <span>Business Intelligence Report</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {analysisResults.analyzed_at && 
                            `Generated ${new Date(analysisResults.analyzed_at).toLocaleString()}`
                          }
                        </span>
                      </CardTitle>
                      <CardDescription>
                        Based on the dataset: {datasetInfo?.filename || 'Unknown dataset'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-card-muted rounded-md p-4 overflow-auto max-h-[800px] prose max-w-none">
                        {analysisResults.report && (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {String(analysisResults.report)}
                          </ReactMarkdown>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="justify-between flex-wrap gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => setCurrentPage('analysis')}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Analysis
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          disabled={!analysisResults.report}
                          onClick={() => {
                            if (analysisResults.report) {
                              // Save the original Markdown content
                              const blob = new Blob([String(analysisResults.report)], { type: 'text/markdown' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `nexusbi-report-${new Date().toISOString().slice(0, 10)}.md`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Report
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card className="w-full">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="rounded-full bg-muted p-4 mb-4">
                        <FileQuestionIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">No Reports Generated Yet</h3>
                      <p className="text-center text-muted-foreground mb-6">
                        Generate a report from the analysis page to see the results here.
                      </p>
                      <Button 
                        onClick={() => setCurrentPage('analysis')}
                        className="w-1/2 mx-auto"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go to Analysis
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        );
      
      case 'visualization':
        console.log("Rendering visualization with datasetInfo:", datasetInfo ? 
          `Data sample: ${datasetInfo.data_sample?.length || 0} rows, Features: ${datasetInfo.features?.length || 0}` : 
          "No dataset info");
          
        return (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <LineChart className="h-5 w-5 text-accent" />
                  <h1 className="text-3xl font-bold tracking-tight">Data Visualization</h1>
                </div>
                <p className="text-muted-foreground">
                  Create interactive charts and visualizations from your dataset
                </p>
              </div>
              
              <Button 
                className="gap-2 bg-accent hover:bg-accent/90"
                onClick={() => handlePageChange('upload')}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4" />
                Upload New Dataset
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-40 flex-col">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Loading data...</p>
                <p className="text-sm text-muted-foreground mt-2">Preparing your data for visualization</p>
              </div>
            ) : (
              <div className="space-y-6">
                {datasetInfo && datasetInfo.data_sample && datasetInfo.data_sample.length > 0 ? (
                  <>
                    <Card className="p-4 bg-blue-50 border-blue-200">
                      <div className="flex items-start gap-4">
                        <div className="bg-blue-100 p-2 rounded-full">
                          <FileSpreadsheet className="h-5 w-5 text-blue-700" />
                        </div>
                        <div>
                          <h3 className="font-medium mb-1">Dataset: {datasetInfo.filename || "Unknown"}</h3>
                          <p className="text-sm text-muted-foreground">
                            {datasetInfo.rows || 0} rows, {datasetInfo.features?.length || 0} features
                          </p>
                        </div>
                      </div>
                    </Card>
                    
                    {/* Use try-catch to prevent crashes */}
                    {(() => {
                      try {
                        console.log("About to render DataVisualization component");
                        return (
                          <DataVisualization 
                            data={datasetInfo.data_sample} 
                            features={Array.isArray(datasetInfo.features) ? datasetInfo.features : []} 
                          />
                        );
                      } catch (error) {
                        console.error("Error rendering DataVisualization:", error);
                        return (
                          <Card className="w-full">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                <span>Visualization Error</span>
                              </CardTitle>
                              <CardDescription>
                                There was a problem rendering the visualization component
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <p className="text-muted-foreground">
                                {error instanceof Error ? error.message : "Unknown error"}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      }
                    })()}
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>No Data Sample Available</CardTitle>
                      <CardDescription>
                        A data sample is needed to create visualizations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        We could not find valid data to visualize. Try one of these options:
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <Card className="p-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handlePageChange('upload')}>
                          <div className="flex flex-col items-center">
                            <Upload className="h-8 w-8 text-primary mb-2" />
                            <h3 className="font-medium mb-1">Upload Dataset</h3>
                            <p className="text-xs text-center text-muted-foreground">Upload your own CSV or Excel file</p>
                          </div>
                        </Card>
                        
                        <Card className="p-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => {
                          // Create a sample dataset for testing visualization
                          console.log("Loading sample dataset for visualization");
                          const sampleData = Array(100).fill(null).map((_, i) => ({
                            id: i,
                            age: Math.floor(Math.random() * 80) + 15,
                            income: Math.floor(Math.random() * 150000) + 20000,
                            education: ['High School', 'Bachelors', 'Masters', 'PhD'][Math.floor(Math.random() * 4)],
                            gender: Math.random() > 0.5 ? 'Female' : 'Male',
                            satisfaction: Math.floor(Math.random() * 10) + 1
                          }));
                          
                          setDatasetInfo({
                            ...datasetInfo, 
                            filename: "Sample Dataset.csv",
                            size: 10240,
                            data_sample: sampleData,
                            rows: sampleData.length,
                            columns: Object.keys(sampleData[0]).length,
                            actual_columns: Object.keys(sampleData[0]).length,
                            features: Object.keys(sampleData[0]),
                            status: 'ready',
                            uploadedAt: new Date()
                          });
                          toast.success("Sample dataset loaded for visualization");
                        }}>
                          <div className="flex flex-col items-center">
                            <FileSpreadsheet className="h-8 w-8 text-primary mb-2" />
                            <h3 className="font-medium mb-1">Use Sample Data</h3>
                            <p className="text-xs text-center text-muted-foreground">Try visualization with our sample dataset</p>
                          </div>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
              <p className="text-muted-foreground">This feature is under development</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={handlePageChange} />
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden ml-64">
        {/* Header */}
        <header className="border-b bg-card px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search analytics..." 
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-background border border-input focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-colors" 
              />
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="rounded-full relative">
                <BellDot className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
              </Button>
              
              <div className="flex items-center gap-2 text-sm">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1 font-medium">
                  <span>TRIOQ</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {renderPageContent()}
        </div>
      </main>
    </div>
  );
}

export default App;