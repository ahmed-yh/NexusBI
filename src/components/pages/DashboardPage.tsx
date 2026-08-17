import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Upload, FileSpreadsheet, BarChart2 } from 'lucide-react';
import { DashboardStats } from '../DashboardStats';

interface DatasetInfo {
  filename?: string;
  size?: number;
  rows?: number;
  columns?: number;
  actual_columns?: number;
  features?: string[];
  data_sample?: any[];
}

interface DashboardPageProps {
  datasetInfo: DatasetInfo | null;
  isLoading: boolean;
  onPageChange: (page: string) => void;
  onRunAnalysis: () => Promise<void>;
  DataSampleTable: React.FC<{ data: any[] }>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  datasetInfo,
  isLoading,
  onPageChange,
  onRunAnalysis,
  DataSampleTable
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
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
          className="gap-2 bg-accent hover:bg-accent/90 text-white w-full sm:w-auto"
          onClick={() => onPageChange('upload')}
          disabled={isLoading}
        >
          <Upload className="h-4 w-4" />
          Upload Dataset
        </Button>
      </div>

      <DashboardStats />

      <div className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-foreground">Dataset Workspace</h2>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1 border-muted-foreground/20 hover:bg-muted"
            onClick={() => onRunAnalysis()}
            disabled={!datasetInfo || isLoading}
          >
            <Upload className="h-3.5 w-3.5" />
            Run Analysis
          </Button>
        </div>
        
        <div className="grid gap-5 md:grid-cols-3">
          {datasetInfo ? (
            <>
              <Card 
                className="hover:shadow-md cursor-pointer transition-shadow border-muted bg-card text-card-foreground"
                onClick={() => onRunAnalysis()}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate max-w-[180px]">
                    {datasetInfo.filename || "Current Dataset"}
                  </CardTitle>
                  <FileSpreadsheet className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(datasetInfo.rows || 0).toLocaleString()} Rows</div>
                  <p className="text-xs text-muted-foreground">
                    {(datasetInfo.actual_columns || datasetInfo.features?.length || 0)} columns • {(datasetInfo.filename?.split('.').pop() || 'csv').toUpperCase()}
                  </p>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-0">
                  Click to start analysis
                </CardFooter>
              </Card>
              
              {/* Show dataset overview */}
              <div className="col-span-2">
                <Card className="border-muted bg-card text-card-foreground">
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
                            <dd className="text-sm font-medium text-foreground">{datasetInfo.rows || 0}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm">Columns:</dt>
                            <dd className="text-sm font-medium text-foreground">{datasetInfo.actual_columns || datasetInfo.features?.length || 0}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm">File Type:</dt>
                            <dd className="text-sm font-medium text-foreground">{(datasetInfo.filename || "").split('.').pop()?.toUpperCase() || "CSV"}</dd>
                          </div>
                        </dl>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Features</h3>
                        <div className="max-h-32 overflow-y-auto">
                          <ul className="space-y-1">
                            {datasetInfo.features?.map((column: string, index: number) => (
                              <li key={index} className="text-sm text-foreground">{column}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    {/* Show data sample if available */}
                    {datasetInfo.data_sample && datasetInfo.data_sample.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Data Sample Preview</h3>
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
                      className="gap-1 w-full bg-primary text-primary-foreground hover:bg-primary/95"
                      onClick={() => onRunAnalysis()}
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
              <Card className="bg-slate-50 border-dashed border-2 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <FileSpreadsheet className="h-12 w-12 text-slate-400 mb-4" />
                  <CardTitle className="text-center mb-2">No Dataset Available</CardTitle>
                  <CardDescription className="text-center mb-6">
                    Upload a dataset to begin your data analysis
                  </CardDescription>
                  <Button 
                    onClick={() => onPageChange('upload')}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/95"
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
};
