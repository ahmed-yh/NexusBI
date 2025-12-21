import { FC, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { webScraperAgent } from '@/lib/agents';

interface WebImportFormProps {
  onImportSuccess: (data: any) => void;
}

export const WebImportForm: FC<WebImportFormProps> = ({ onImportSuccess }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSuccess(false);

    try {
      // Validate URL
      if (!url.trim().startsWith('http')) {
        toast.error('Please enter a valid URL starting with http:// or https://');
        setIsLoading(false);
        return;
      }

      // Use the webScraperAgent to import data
      const response = await webScraperAgent.scrapeUrl(url, {
        table_selector: 'table', // Default selector for tables
        skip_rows: 0,
        use_headers: true
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to import data');
      }

      setIsSuccess(true);
      toast.success(`Successfully imported data from ${url}`);

      if (onImportSuccess) {
        onImportSuccess(response);
      }
    } catch (error: any) {
      console.error('Web import error:', error);
      toast.error(`Import failed: ${error.message || 'Could not import data from the URL'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Web Data Import
        </CardTitle>
        <CardDescription>
          Import market data directly from websites, APIs, or online datasets
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/data-table"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full"
              disabled={isLoading || isSuccess}
            />
            <p className="text-xs text-muted-foreground">
              Enter the URL of a website containing tabular data you want to import
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-green-50 p-4 rounded-md border border-green-100 flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Data successfully imported!</span>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="justify-between gap-2">
          <Button 
            variant="outline" 
            type="button"
            onClick={() => {
              setUrl('');
              setIsSuccess(false);
            }}
            disabled={isLoading}
          >
            Clear
          </Button>
          <Button type="submit" disabled={isLoading || isSuccess || !url.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import Data'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}; 