import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, Upload, FileSpreadsheet, LineChart, AlertTriangle } from 'lucide-react';
import { DataVisualization } from '../DataVisualization';
import { toast } from 'sonner';

interface DatasetInfo {
  filename?: string;
  size?: number;
  rows?: number;
  columns?: number;
  actual_columns?: number;
  features?: string[];
  data_sample?: any[];
  status?: string;
  uploadedAt?: Date;
}

interface VisualizationPageProps {
  datasetInfo: DatasetInfo | null;
  isLoading: boolean;
  onPageChange: (page: string) => void;
  onSetDatasetInfo: (info: DatasetInfo | null) => void;
}

export const VisualizationPage: React.FC<VisualizationPageProps> = ({
  datasetInfo,
  isLoading,
  onPageChange,
  onSetDatasetInfo
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LineChart className="h-5 w-5 text-accent" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Data Visualization</h1>
          </div>
          <p className="text-muted-foreground">
            Create interactive charts and visualizations from your dataset
          </p>
        </div>

        <Button
          className="gap-2 bg-accent hover:bg-accent/90 text-white w-full sm:w-auto"
          onClick={() => onPageChange('upload')}
          disabled={isLoading}
        >
          <Upload className="h-4 w-4" />
          Upload New Dataset
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-40 flex-col">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium text-foreground">Loading data...</p>
          <p className="text-sm text-muted-foreground mt-2">Preparing your data for visualization</p>
        </div>
      ) : (
        <div className="space-y-6">
          {datasetInfo && datasetInfo.data_sample && datasetInfo.data_sample.length > 0 ? (
            <>
              <Card className="p-4 bg-blue-50/50 border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-900/30">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full">
                    <FileSpreadsheet className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1 text-foreground">Dataset: {datasetInfo.filename || "Unknown"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(datasetInfo.rows || 0).toLocaleString()} rows, {datasetInfo.features?.length || 0} features
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
                    <Card className="w-full border-destructive/20 bg-destructive/5 text-destructive-foreground">
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
            <Card className="border-muted bg-card text-card-foreground">
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <Card 
                    className="p-4 cursor-pointer hover:bg-muted/50 border border-muted transition-colors" 
                    onClick={() => onPageChange('upload')}
                  >
                    <div className="flex flex-col items-center">
                      <Upload className="h-8 w-8 text-primary mb-2" />
                      <h3 className="font-medium mb-1 text-foreground">Upload Dataset</h3>
                      <p className="text-xs text-center text-muted-foreground">Upload your own CSV or Excel file</p>
                    </div>
                  </Card>
                  
                  <Card 
                    className="p-4 cursor-pointer hover:bg-muted/50 border border-muted transition-colors" 
                    onClick={() => {
                      console.log("Loading sample dataset for visualization");
                      const sampleData = Array(100).fill(null).map((_, i) => ({
                        id: i,
                        age: Math.floor(Math.random() * 80) + 15,
                        income: Math.floor(Math.random() * 150000) + 20000,
                        education: ['High School', 'Bachelors', 'Masters', 'PhD'][Math.floor(Math.random() * 4)],
                        gender: Math.random() > 0.5 ? 'Female' : 'Male',
                        satisfaction: Math.floor(Math.random() * 10) + 1
                      }));
                      
                      onSetDatasetInfo({
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
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <FileSpreadsheet className="h-8 w-8 text-primary mb-2" />
                      <h3 className="font-medium mb-1 text-foreground">Use Sample Data</h3>
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
};
