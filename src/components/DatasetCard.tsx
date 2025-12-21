import { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FileSpreadsheet, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatasetCardProps {
  name: string;
  size: number;
  type: string;
  status: 'processing' | 'ready' | 'error';
  uploadedAt: Date;
  onClick: () => void;
}

const formatFileSize = (bytes: number): string => {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;
};

export const DatasetCard: FC<DatasetCardProps> = ({
  name,
  size,
  type,
  status,
  uploadedAt,
  onClick,
}) => {
  const statusConfig = {
    ready: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30' },
    processing: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
  };

  const StatusIcon = statusConfig[status].icon;

  return (
    <Card 
      className="hover:shadow-md hover:border-accent/40 transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      <div className={cn(
        "h-1", 
        status === 'processing' ? 'bg-amber-500/50' : 
        status === 'ready' ? 'bg-accent' :
        'bg-red-500/50'
      )} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate max-w-[80%]">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-md", 
              type === 'xlsx' ? "bg-green-100 dark:bg-green-950/30" :
              type === 'csv' ? "bg-blue-100 dark:bg-blue-950/30" :
              "bg-slate-100 dark:bg-slate-800"
            )}>
              <FileSpreadsheet className="h-4 w-4 text-foreground/80" />
            </div>
            <span className="truncate">{name}</span>
          </div>
        </CardTitle>
        <div className={cn("p-1 rounded-full", statusConfig[status].bg)}>
          <StatusIcon className={cn("h-4 w-4", statusConfig[status].color)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{type.toUpperCase()}</span> • {formatFileSize(size)}
          </div>
          <div className="text-xs text-muted-foreground">
            {uploadedAt.toLocaleDateString()}
          </div>
        </div>
        {status === 'processing' && (
          <div className="mt-2.5">
            <Progress value={45} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Processing...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};