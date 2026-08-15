import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, BarChart2, ChevronDown, FileText, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DatasetInfo {
  filename?: string;
  size?: number;
  rows?: number;
}

interface AnalysisResults {
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
}

interface AnalysisPageProps {
  datasetInfo: DatasetInfo | null;
  analysisResults: AnalysisResults | null;
  isLoading: boolean;
  onRunAnalysis: () => Promise<void>;
  onGenerateBIReport: () => Promise<void>;
  onPageChange: (page: string) => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  datasetInfo,
  analysisResults,
  isLoading,
  onRunAnalysis,
  onGenerateBIReport,
  onPageChange,
}) => {
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
          className="gap-2 bg-accent hover:bg-accent/90 text-white"
          onClick={onRunAnalysis}
          disabled={!datasetInfo || isLoading}
        >
          <BarChart2 className="h-4 w-4" />
          Run Analysis
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-60 flex-col">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium text-foreground">Analyzing data...</p>
          <p className="text-sm text-muted-foreground mt-2">This may take a minute or two</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="border-muted bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Analysis Options</CardTitle>
              <CardDescription>
                Select the types of analysis to perform on your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 grid-cols-2">
                <div 
                  className="border border-muted rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
                  onClick={onRunAnalysis}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronDown className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-foreground">Trend Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Identify key trends and patterns in your data
                  </p>
                </div>
                
                <div 
                  className="border border-muted rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
                  onClick={onRunAnalysis}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronDown className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-foreground">Correlation Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Find relationships between different data factors
                  </p>
                </div>
                
                <div 
                  className="border border-muted rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
                  onClick={onRunAnalysis}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronDown className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-foreground">Predictive Modeling</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Forecast future trends based on historical data
                  </p>
                </div>
                
                <div 
                  className="border border-muted rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
                  onClick={onRunAnalysis}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronDown className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-foreground">Segment Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Identify key data segments and their characteristics
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                onClick={onRunAnalysis}
                disabled={!datasetInfo || isLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/95"
              >
                Run Data Analysis
              </Button>
            </CardFooter>
          </Card>

          {analysisResults && (
            <>
              {/* Feature Relationships Card */}
              {analysisResults.relationships && analysisResults.relationships.length > 0 && (
                <Card className="border-muted bg-card text-card-foreground">
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
                            <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                              <td className="p-3 border text-foreground">{rel.feature1}</td>
                              <td className="p-3 border text-foreground">{rel.feature2}</td>
                              <td className="p-3 border text-foreground">{rel.type}</td>
                              <td className="p-3 border text-foreground">{rel.description}</td>
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
                <Card className="border-muted bg-card text-card-foreground">
                  <CardHeader>
                    <CardTitle>BI Report Preview</CardTitle>
                    <CardDescription>
                      Preview of the business intelligence report
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-96 overflow-y-auto">
                    <div className="bg-card p-4 border border-muted rounded prose max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {String(analysisResults.report).length > 500 ? 
                          String(analysisResults.report).slice(0, 500) + '...' : 
                          String(analysisResults.report)}
                      </ReactMarkdown>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={() => onPageChange('reports')}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/95"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Full Report
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {/* Column Statistics */}
              {analysisResults.column_stats && Object.keys(analysisResults.column_stats).length > 0 && (
                <Card className="border-muted bg-card text-card-foreground">
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
                            <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                              <td className="p-2 text-xs border font-medium text-foreground">{column}</td>
                              <td className="p-2 text-xs border text-foreground">{stats.min?.toFixed(2) || 'N/A'}</td>
                              <td className="p-2 text-xs border text-foreground">{stats.max?.toFixed(2) || 'N/A'}</td>
                              <td className="p-2 text-xs border text-foreground">{stats.mean?.toFixed(2) || 'N/A'}</td>
                              <td className="p-2 text-xs border text-foreground">{stats.median?.toFixed(2) || 'N/A'}</td>
                              <td className="p-2 text-xs border text-foreground">{stats.std?.toFixed(2) || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-muted bg-card text-card-foreground">
                <CardFooter className="justify-between pt-6">
                  <Button
                    variant="outline"
                    className="border-muted-foreground/20 hover:bg-muted"
                    onClick={() => onPageChange('dashboard')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                  </Button>
                  <Button
                    onClick={onGenerateBIReport}
                    disabled={isLoading}
                    className="bg-primary text-primary-foreground hover:bg-primary/95"
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
};
