import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { BarChart2, CircleDot, Box, AlertTriangle } from 'lucide-react';

// Define types for our chart data
interface ChartDataPoint {
  [key: string]: any;
  x: number;
  y: number;
  z: number;
  color?: string;
  name?: string;
}

interface BarChartDataPoint {
  [key: string]: any;
  name: string;
}

interface DataVisualizationProps {
  data: any[];
  features: string[];
}

// Error boundary class component for catching rendering errors
class ChartErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chart rendering error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Chart Rendering Error</span>
            </CardTitle>
            <CardDescription>
              There was a problem rendering the visualization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <p className="text-muted-foreground mt-2">
              Try selecting different data or chart options
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export const DataVisualization: React.FC<DataVisualizationProps> = ({ data, features }) => {
  // Additional debugging 
  console.log("DataVisualization component rendering with:", { 
    dataExists: Array.isArray(data),
    dataLength: Array.isArray(data) ? data.length : 0,
    featuresExist: Array.isArray(features),
    featuresLength: Array.isArray(features) ? features.length : 0
  });
  
  // Validate input data with additional defensive checks
  const hasValidData = Array.isArray(data) && data.length > 0;
  const validFeatures = Array.isArray(features) && features.length > 0 ? features : 
    (hasValidData && data[0] ? Object.keys(data[0]) : []);
  
  // Add debug for valid features
  console.log("Valid features determined:", validFeatures);

  // States for chart configuration
  const [chartType, setChartType] = useState<'bar' | 'scatter' | 'bubble'>('bar');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [zAxis, setZAxis] = useState<string>('');
  const [colorBy, setColorBy] = useState<string>('');
  const [pointSize, setPointSize] = useState<number>(20);
  const [error, setError] = useState<string>('');
  
  // More reliable feature type detection
  const determineFeatureTypes = () => {
    if (!hasValidData) return { numeric: [], categorical: [] };
    
    try {
      const sample = data[0] || {};
      const numeric: string[] = [];
      const categorical: string[] = [];
      
      validFeatures.forEach(feature => {
        if (!feature) return; // Skip empty feature names
          
        // Check value in the first few rows for more reliable type detection
        const sampleRows = data.slice(0, Math.min(5, data.length));
        const hasNumberValue = sampleRows.some(row => 
          row && typeof row[feature] === 'number' && !isNaN(row[feature])
        );
        const hasStringValue = sampleRows.some(row => 
          row && typeof row[feature] === 'string'
        );
        
        if (hasNumberValue) {
          numeric.push(feature);
        } else if (hasStringValue) {
          categorical.push(feature);
        } else if (sample[feature] !== undefined) {
          // Fallback for unknown types - check first row
          if (typeof sample[feature] === 'number' && !isNaN(sample[feature])) {
            numeric.push(feature);
          } else {
            categorical.push(feature);
          }
        }
      });
      
      console.log("Numeric features:", numeric);
      console.log("Categorical features:", categorical);
      
      return { numeric, categorical };
    } catch (err) {
      console.error("Error determining feature types:", err);
      return { numeric: [], categorical: [] };
    }
  };
  
  const { numeric: numericFeatures, categorical: categoricalFeatures } = determineFeatureTypes();
  
  // Set default axes when data changes or feature types are determined
  useEffect(() => {
    try {
      // Reset error state
      setError('');
      
      if (!hasValidData || validFeatures.length === 0) {
        setError('No valid data or features available');
        return;
      }
      
      console.log("Setting default axes with numeric features:", numericFeatures);
      console.log("And categorical features:", categoricalFeatures);
      
      // Set default Y axis - numeric feature
      if (numericFeatures.length > 0) {
        setYAxis(numericFeatures[0]);
        
        // Set default Z axis if in bubble mode
        if (numericFeatures.length > 1) {
          setZAxis(numericFeatures[1]);
        } else {
          setZAxis(numericFeatures[0]); // Fallback to the same as Y if only one numeric feature
        }
      } else {
        // If no numeric features, create a count metric for categorical data
        setYAxis('count');
      }
      
      // Set default X axis - categorical feature if available, otherwise first numeric
      if (categoricalFeatures.length > 0) {
        setXAxis(categoricalFeatures[0]);
        setColorBy(categoricalFeatures[0]);
      } else if (numericFeatures.length > 0) {
        setXAxis(numericFeatures[0]);
        // No color by default for all numeric data
        setColorBy('');
      }
    } catch (err) {
      console.error('Error setting default axes:', err);
      setError('Error initializing chart. Please check console for details.');
    }
  }, [data, hasValidData, validFeatures]);
  
  // Process data for charts
  const processDataForCharts = (): BarChartDataPoint[] | ChartDataPoint[] => {
    try {
      if (!hasValidData) {
        console.log("No valid data for chart processing");
        return [];
      }
      
      if (!xAxis || (!yAxis && yAxis !== 'count')) {
        console.log("Missing axes for chart processing:", { xAxis, yAxis });
        return [];
      }
      
      // For bar chart: aggregate values by x-axis category
      if (chartType === 'bar') {
        const aggregated: Record<string, BarChartDataPoint> = {};
        
        // Special case for counting categorical data
        if (yAxis === 'count') {
          data.forEach(item => {
            if (!item) return;
            
            const xValue = String(item[xAxis] || 'undefined');
            if (!aggregated[xValue]) {
              aggregated[xValue] = { name: xValue, count: 0 };
            }
            
            // Increment count
            aggregated[xValue].count = (aggregated[xValue].count || 0) + 1;
            
            // Color by another categorical variable if selected
            if (colorBy && colorBy !== 'none' && colorBy !== xAxis && item[colorBy] !== undefined) {
              const colorValue = String(item[colorBy] || 'undefined');
              if (!aggregated[xValue][colorValue]) {
                aggregated[xValue][colorValue] = 0;
              }
              aggregated[xValue][colorValue] = (aggregated[xValue][colorValue] || 0) + 1;
            }
          });
        } else {
          // Regular numeric aggregation
          data.forEach(item => {
            if (!item) return;
            
            const xValue = String(item[xAxis] || 'undefined');
            if (!aggregated[xValue]) {
              aggregated[xValue] = { name: xValue };
            }
            
            // Sum up the y-axis values, ensure it's a number
            const yValue = Number(item[yAxis]) || 0;
            aggregated[xValue][yAxis] = (aggregated[xValue][yAxis] || 0) + yValue;
            
            // If coloring by a category, track those values too
            if (colorBy && colorBy !== 'none' && colorBy !== xAxis && item[colorBy] !== undefined) {
              const colorValue = String(item[colorBy] || 'undefined');
              aggregated[xValue][colorValue] = (aggregated[xValue][colorValue] || 0) + yValue;
            }
          });
        }
        
        return Object.values(aggregated);
      }
      
      // For scatter and bubble charts: format the data properly
      return data
        .filter(item => item && item[xAxis] !== undefined && 
                (yAxis === 'count' || item[yAxis] !== undefined))
        .map(item => ({
          ...item,
          x: Number(item[xAxis]) || 0,
          y: yAxis === 'count' ? 1 : Number(item[yAxis]) || 0,  // Count = 1 per point
          z: zAxis && item[zAxis] !== undefined ? Number(item[zAxis]) || 0 : 1,
          color: colorBy && colorBy !== 'none' && item[colorBy] !== undefined ? String(item[colorBy]) : 'default'
        }));
    } catch (err) {
      console.error('Error processing chart data:', err);
      setError('Error processing data for chart. Please try different axes.');
      return [];
    }
  };
  
  // Process chart data with memoization to avoid unnecessary recalculations
  const chartData = useMemo(() => processDataForCharts(), [
    data, xAxis, yAxis, zAxis, colorBy, chartType, hasValidData
  ]);
  
  // Get unique values for color grouping
  const uniqueColorValues = useMemo(() => {
    if (!hasValidData || !colorBy || colorBy === 'none') return [];
    try {
      const values = [...new Set(data
        .map(item => item && item[colorBy])
        .filter(Boolean)
      )];
      return values.map(val => String(val));
    } catch (err) {
      console.error('Error getting unique color values:', err);
      return [];
    }
  }, [data, colorBy, hasValidData]);
  
  // Helper function to get color for a category (used in charts)
  const getColorForCategory = (index: number): string => {
    const colors = [
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
      "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
    ];
    return colors[index % colors.length];
  };
  
  // Handle dropdown changes 
  const handleChangeAxis = (axis: 'x' | 'y' | 'z' | 'color', value: string) => {
    try {
      switch (axis) {
        case 'x':
          setXAxis(value);
          break;
        case 'y':
          setYAxis(value);
          break;
        case 'z':
          setZAxis(value);
          break;
        case 'color':
          setColorBy(value);
          break;
      }
    } catch (err) {
      console.error(`Error changing ${axis} axis to ${value}:`, err);
    }
  };
  
  // Check if we have enough data to render a chart
  const canRenderChart = hasValidData && chartData.length > 0 && xAxis && (yAxis || yAxis === 'count');

  // If we haven't set axes yet, but we have data, show a loading state
  if ((!xAxis || !yAxis) && hasValidData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Data Visualization</CardTitle>
          <CardDescription>
            Preparing visualization...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Setting up chart with your data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Data Visualization Error</span>
          </CardTitle>
          <CardDescription>
            There was a problem setting up the visualization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-muted-foreground mt-2">
            Try uploading a dataset with more numerical features for better visualizations.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Everything below here gets wrapped in error boundary
  return (
    <ChartErrorBoundary>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Data Visualization</CardTitle>
          <CardDescription>
            Explore your data with interactive charts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Tabs defaultValue="bar" onValueChange={(value) => setChartType(value as 'bar' | 'scatter' | 'bubble')}>
              <TabsList className="grid w-full grid-cols-3 bg-muted">
                <TabsTrigger value="bar" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
                  <BarChart2 className="h-4 w-4 text-muted-foreground dark:text-foreground" />
                  <span className="truncate">Bar Chart</span>
                </TabsTrigger>
                <TabsTrigger value="scatter" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
                  <CircleDot className="h-4 w-4 text-muted-foreground dark:text-foreground" />
                  <span className="truncate">Scatter Plot</span>
                </TabsTrigger>
                <TabsTrigger value="bubble" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
                  <Box className="h-4 w-4 text-muted-foreground dark:text-foreground" />
                  <span className="truncate">Bubble Chart</span>
                </TabsTrigger>
              </TabsList>
              
              <div className="grid gap-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="x-axis">X-Axis</Label>
                    <Select value={xAxis} onValueChange={(value) => handleChangeAxis('x', value)}>
                      <SelectTrigger id="x-axis">
                        <SelectValue placeholder="Select X-Axis" />
                      </SelectTrigger>
                      <SelectContent>
                        {validFeatures.map((feature) => (
                          <SelectItem key={`x-${feature}`} value={feature}>
                            {feature}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="y-axis">Y-Axis</Label>
                    <Select value={yAxis} onValueChange={(value) => handleChangeAxis('y', value)}>
                      <SelectTrigger id="y-axis">
                        <SelectValue placeholder="Select Y-Axis" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoricalFeatures.length > 0 && (
                          <SelectItem value="count">Count (frequency)</SelectItem>
                        )}
                        {numericFeatures.map((feature) => (
                          <SelectItem key={`y-${feature}`} value={feature}>
                            {feature}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {(chartType === 'scatter' || chartType === 'bubble') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {chartType === 'bubble' && (
                      <div>
                        <Label htmlFor="z-axis" className="text-foreground">Bubble Size Variable (Z-Axis)</Label>
                        <Select value={zAxis} onValueChange={setZAxis}>
                          <SelectTrigger id="z-axis" className="border-muted bg-card text-card-foreground">
                            <SelectValue placeholder="Select Z-Axis" />
                          </SelectTrigger>
                          <SelectContent>
                            {numericFeatures.map((feature) => (
                              <SelectItem key={`z-${feature}`} value={feature}>
                                {feature}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="point-size">Point Size</Label>
                      <Slider
                        id="point-size"
                        min={5}
                        max={50}
                        step={1}
                        value={[pointSize]}
                        onValueChange={(value) => setPointSize(value[0])}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="color-by">Color By</Label>
                  <Select value={colorBy} onValueChange={setColorBy}>
                    <SelectTrigger id="color-by">
                      <SelectValue placeholder="Select Color Feature" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Color Grouping</SelectItem>
                      {validFeatures.map((feature) => (
                        <SelectItem key={`color-${feature}`} value={feature}>
                          {feature}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {canRenderChart ? (
                <>
                  <TabsContent value="bar" className="mt-4">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <defs>
                            <linearGradient id="barColorGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.9}/>
                              <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" className="text-muted-foreground" />
                          <YAxis className="text-muted-foreground" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--card)', 
                              borderColor: 'var(--border)',
                              borderRadius: 'var(--radius)',
                              color: 'var(--foreground)'
                            }} 
                          />
                          <Legend />
                          {colorBy && colorBy !== 'none' && colorBy !== xAxis && uniqueColorValues.length > 0 ? (
                            // If coloring by a separate category, create bars for each category
                            uniqueColorValues.map((colorValue, index) => (
                              <Bar 
                                key={`bar-${colorValue}`}
                                dataKey={colorValue}
                                fill={getColorForCategory(index)}
                                name={colorValue}
                                radius={[4, 4, 0, 0]}
                              />
                            ))
                          ) : (
                            // Otherwise, just show one bar with gradient fill
                            <Bar 
                              dataKey={yAxis} 
                              fill="url(#barColorGradient)" 
                              name={yAxis} 
                              radius={[4, 4, 0, 0]}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="scatter" className="mt-4">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            type="number" 
                            dataKey="x" 
                            name={xAxis} 
                            label={{ value: xAxis, position: 'insideBottomRight', offset: -5 }} 
                          />
                          <YAxis 
                            type="number" 
                            dataKey="y" 
                            name={yAxis} 
                            label={{ value: yAxis, angle: -90, position: 'insideLeft' }} 
                          />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Legend />
                          
                          {colorBy && colorBy !== 'none' && uniqueColorValues.length > 0 ? (
                            // If coloring by a category, create scatter plots for each category
                            uniqueColorValues.map((colorValue, index) => {
                              const filteredData = chartData.filter(item => String(item.color) === colorValue);
                              return filteredData.length > 0 ? (
                                <Scatter
                                  key={`scatter-${colorValue}`}
                                  name={colorValue}
                                  data={filteredData}
                                  fill={getColorForCategory(index)}
                                  shape="circle"
                                />
                              ) : null;
                            })
                          ) : (
                            // Otherwise, just one scatter plot
                            <Scatter
                              name={`${xAxis} vs ${yAxis}`}
                              data={chartData}
                              fill="#8884d8"
                              shape="circle"
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="bubble" className="mt-4">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            type="number" 
                            dataKey="x" 
                            name={xAxis} 
                            label={{ value: xAxis, position: 'insideBottomRight', offset: -5 }} 
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            type="number" 
                            dataKey="y" 
                            name={yAxis} 
                            label={{ value: yAxis, angle: -90, position: 'insideLeft' }} 
                            className="text-muted-foreground"
                          />
                          <ZAxis
                            type="number"
                            dataKey="z"
                            range={[100, 1000]}
                            name={zAxis}
                          />
                          <Tooltip 
                            cursor={{ strokeDasharray: '3 3' }} 
                            contentStyle={{ 
                              backgroundColor: 'var(--card)', 
                              borderColor: 'var(--border)',
                              borderRadius: 'var(--radius)',
                              color: 'var(--foreground)'
                            }}
                          />
                          <Legend />
                          
                          {colorBy && colorBy !== 'none' && uniqueColorValues.length > 0 ? (
                            // If coloring by a category, create scatter plots for each category
                            uniqueColorValues.map((colorValue, index) => {
                              const filteredData = chartData.filter(item => String(item.color) === colorValue);
                              return filteredData.length > 0 ? (
                                <Scatter
                                  key={`bubble-${colorValue}`}
                                  name={colorValue}
                                  data={filteredData}
                                  fill={getColorForCategory(index)}
                                  shape="circle"
                                />
                              ) : null;
                            })
                          ) : (
                            // Otherwise, just one scatter plot
                            <Scatter
                              name={`${xAxis} vs ${yAxis} vs ${zAxis}`}
                              data={chartData}
                              fill="hsl(var(--accent))"
                              shape="circle"
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 mt-4 bg-slate-50 border rounded-md">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                  <p className="text-muted-foreground text-center">
                    {!hasValidData 
                      ? "No data available for visualization" 
                      : "Please select valid axes to display the chart"}
                  </p>
                </div>
              )}
            </Tabs>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-xs text-muted-foreground">
            Tip: Click on legend items to toggle visibility
          </div>
        </CardFooter>
      </Card>
    </ChartErrorBoundary>
  );
}; 