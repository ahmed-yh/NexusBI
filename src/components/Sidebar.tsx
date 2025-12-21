import { FC } from 'react';
import { BarChart3, Upload, FileText, GanttChart, Braces, BarChart, LineChart, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  className?: string;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Sidebar: FC<SidebarProps> = ({ className, currentPage, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'upload', icon: Upload, label: 'Upload Data' },
    { id: 'web-import', icon: GanttChart, label: 'Web Import' },
    { id: 'analysis', icon: BarChart, label: 'Data Analysis' },
    { id: 'reports', icon: FileText, label: 'BI Report Generator' },
    { id: 'visualization', icon: LineChart, label: 'Visualization' },
  ];

  return (
    <div className={cn(
      'w-64 bg-white border-r h-screen p-4 flex flex-col fixed left-0 top-0 z-50 shadow-sm sidebar-transition', 
      className
    )}>
      <div className="flex items-center px-2 py-2">
        <div className="flex items-center gap-2">
          <LineChart className="h-8 w-8 text-accent" />
          <h1 className="text-2xl font-bold text-gray-800">Nexus<span className="text-accent">BI</span></h1>
        </div>
      </div>
      
      <nav className="space-y-1.5 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-150 font-medium group relative',
                isActive
                  ? 'bg-blue-50 text-primary border-l-4 border-primary shadow-sm'
                  : 'text-gray-700 hover:bg-blue-50 hover:text-primary hover:shadow-sm hover:border-l-4 hover:border-primary'
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isActive ? "text-primary" : "text-gray-600 group-hover:text-primary"
              )} />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
      
      <div className="mt-auto pt-4 border-t border-gray-200">
        <div className="flex px-2 py-1.5 text-xs text-muted-foreground">
          <span>NexusBI v1.0</span>
        </div>
      </div>
    </div>
  );
};

export { Sidebar }