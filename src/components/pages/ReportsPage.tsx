import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, Upload, Download, ArrowLeft, FileQuestionIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DatasetInfo {
  filename?: string;
}

interface AnalysisResults {
  analyzed_at?: string;
  report?: string;
}

interface ReportsPageProps {
  datasetInfo: DatasetInfo | null;
  analysisResults: AnalysisResults | null;
  isLoading: boolean;
  onGenerateBIReport: () => Promise<void>;
  onPageChange: (page: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  datasetInfo,
  analysisResults,
  isLoading,
  onGenerateBIReport,
  onPageChange
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          BI Report Generator
        </h2>
        <Button
          onClick={onGenerateBIReport}
          disabled={isLoading}
          className="bg-primary text-primary-foreground hover:bg-primary/95 w-full sm:w-auto"
        >
          <Upload className="mr-2 h-4 w-4" />
          Generate New Report
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center p-12">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Generating BI Report...</p>
          <p className="text-sm text-muted-foreground mt-2">
            This may take a moment. We're analyzing your data and creating a comprehensive report.
          </p>
        </div>
      ) : (
        <>
          {analysisResults && analysisResults.report ? (
            <Card className="w-full border-muted bg-card text-card-foreground">
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
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
                <div className="bg-muted/40 rounded-md p-4 overflow-auto max-h-[800px] prose max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {String(analysisResults.report)}
                  </ReactMarkdown>
                </div>
              </CardContent>
              <CardFooter className="justify-between flex-wrap gap-2">
                <Button 
                  variant="outline"
                  className="border-muted-foreground/20 hover:bg-muted"
                  onClick={() => onPageChange('analysis')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Analysis
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-muted-foreground/20 hover:bg-muted"
                    disabled={!analysisResults.report}
                    onClick={() => {
                      if (analysisResults.report) {
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
            <Card className="w-full border-muted bg-card text-card-foreground">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileQuestionIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium mb-2 text-foreground">No Reports Generated Yet</h3>
                <p className="text-center text-muted-foreground mb-6">
                  Generate a report from the analysis page to see the results here.
                </p>
                <Button 
                  onClick={() => onPageChange('analysis')}
                  className="w-1/2 mx-auto bg-primary text-primary-foreground hover:bg-primary/95"
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
};
