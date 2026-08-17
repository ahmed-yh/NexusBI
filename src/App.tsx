import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Search, BellDot, User, ChevronDown, BarChart2, Menu } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Sidebar } from './components/Sidebar';
import { DatasetCard } from './components/DatasetCard';
import { DarkModeToggle } from './components/DarkModeToggle';
import { DashboardPage } from './components/pages/DashboardPage';
import { AnalysisPage } from './components/pages/AnalysisPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { VisualizationPage } from './components/pages/VisualizationPage';
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

function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    // Try to load from URL or localStorage to persist state
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    if (pageParam && ['dashboard', 'upload', 'analysis', 'reports', 'visualization'].includes(pageParam)) {
      return pageParam;
    }
    return 'dashboard';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
          <DashboardPage
            datasetInfo={datasetInfo}
            isLoading={isLoading}
            onPageChange={handlePageChange}
            onRunAnalysis={handleRunAnalysis}
            DataSampleTable={DataSampleTable}
          />
        );

      case 'upload':
        return (
          <>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
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
                className="gap-2 bg-accent hover:bg-accent/90 w-full sm:w-auto"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <AnalysisPage
            datasetInfo={datasetInfo}
            analysisResults={analysisResults}
            isLoading={isLoading}
            onRunAnalysis={handleRunAnalysis}
            onGenerateBIReport={handleGenerateBIReport}
            onPageChange={handlePageChange}
          />
        );

      case 'reports':
        return (
          <ReportsPage
            datasetInfo={datasetInfo}
            analysisResults={analysisResults}
            isLoading={isLoading}
            onGenerateBIReport={handleGenerateBIReport}
            onPageChange={handlePageChange}
          />
        );

      case 'visualization':
        return (
          <VisualizationPage
            datasetInfo={datasetInfo}
            isLoading={isLoading}
            onPageChange={handlePageChange}
            onSetDatasetInfo={(info) => setDatasetInfo(info as DatasetInfo)}
          />
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
      <Sidebar
        currentPage={currentPage}
        onNavigate={handlePageChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden md:ml-64">
        {/* Header */}
        <header className="border-b bg-card px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:bg-muted shrink-0"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="relative w-full max-w-72 hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search analytics..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-background border border-input focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <DarkModeToggle />
              <Button variant="outline" size="icon" className="rounded-full relative">
                <BellDot className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
              </Button>

              <div className="flex items-center gap-2 text-sm">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div className="hidden md:flex items-center gap-1 font-medium">
                  <span>TRIOQ</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          {renderPageContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
