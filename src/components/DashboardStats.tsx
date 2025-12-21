import { FC, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Database, FileSpreadsheet, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { datasetManagerAgent } from '@/lib/agents';

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: FC<{ className?: string }>;
  trend?: number;
  color?: 'default' | 'blue' | 'green' | 'amber';
  isLoading?: boolean;
}

const StatsCard: FC<StatsCardProps> = ({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend, 
  color = 'default',
  isLoading = false
}) => {
  const colorStyles = {
    default: {
      bg: 'bg-primary/10',
      icon: 'text-primary',
      border: 'border-primary/20',
    },
    blue: {
      bg: 'bg-accent/10',
      icon: 'text-accent',
      border: 'border-accent/20',
    },
    green: {
      bg: 'bg-green-500/10',
      icon: 'text-green-500',
      border: 'border-green-500/20',
    },
    amber: {
      bg: 'bg-amber-500/10',
      icon: 'text-amber-500',
      border: 'border-amber-500/20',
    },
  };

  return (
    <Card className={cn("border overflow-hidden", colorStyles[color].border)}>
      <div className={cn("h-1", 
        color === 'default' ? 'bg-primary' : 
        color === 'blue' ? 'bg-accent' : 
        color === 'green' ? 'bg-green-500' : 
        'bg-amber-500'
      )} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn("p-2 rounded-full", colorStyles[color].bg)}>
          <Icon className={cn("h-4 w-4", colorStyles[color].icon)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <CardDescription>{description}</CardDescription>
          </div>
          {trend !== undefined && (
            <div className={cn(
              "flex items-center text-xs font-medium px-2 py-1 rounded-full",
              trend >= 0 
                ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950/30" 
                : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/30"
            )}>
              <TrendingUp className={cn(
                "h-3 w-3 mr-1", 
                trend < 0 && "transform rotate-180"
              )} />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const DashboardStats: FC = () => {
  const [stats, setStats] = useState({
    totalDatasets: 0,
    processedFiles: 0,
    pendingAnalysis: 0,
    isLoading: true
  });
  const [noDataAvailable, setNoDataAvailable] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get dataset info using the datasetManagerAgent
        const datasetInfo = await datasetManagerAgent.getDatasetInfo();
        
        if (datasetInfo.success && datasetInfo.dataset_info) {
          // Extract stats from dataset info
          setStats({
            totalDatasets: datasetInfo.dataset_info.columns || 0,
            processedFiles: 1, // Assuming one file is processed
            pendingAnalysis: 0, // No pending analysis in this case
            isLoading: false
          });
          setNoDataAvailable(false);
        } else {
          // No data available
          setStats({
            totalDatasets: 0,
            processedFiles: 0,
            pendingAnalysis: 0,
            isLoading: false
          });
          setNoDataAvailable(true);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        // In case of error, use sample data
        setStats({
          totalDatasets: 0,
          processedFiles: 0,
          pendingAnalysis: 0,
          isLoading: false
        });
        setNoDataAvailable(true);
      }
    };
    
    fetchStats();
  }, []);

  if (noDataAvailable) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <FileSpreadsheet className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Dataset Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a dataset using the "Upload Dataset" button above to get started.
          </p>
          <div className="text-xs text-muted-foreground">
            Supported formats: CSV, Excel, JSON
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatsCard
        title="Total Datasets"
        value={stats.isLoading ? "..." : stats.totalDatasets}
        description="Active datasets in analysis"
        icon={Database}
        trend={8}
        color="blue"
        isLoading={stats.isLoading}
      />
      <StatsCard
        title="Processed Files"
        value={stats.isLoading ? "..." : stats.processedFiles}
        description="Successfully processed"
        icon={FileSpreadsheet}
        trend={15}
        color="green"
        isLoading={stats.isLoading}
      />
      <StatsCard
        title="Pending Analysis"
        value={stats.isLoading ? "..." : stats.pendingAnalysis}
        description="Awaiting processing"
        icon={Clock}
        trend={-5}
        color="amber"
        isLoading={stats.isLoading}
      />
    </div>
  );
};