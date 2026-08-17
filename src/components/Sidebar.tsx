import { FC } from 'react';
import { BarChart3, Upload, FileText, BarChart, LineChart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  className?: string;
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: FC<SidebarProps> = ({ className, currentPage, onNavigate, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'upload', icon: Upload, label: 'Upload Data' },
    { id: 'analysis', icon: BarChart, label: 'Data Analysis' },
    { id: 'reports', icon: FileText, label: 'BI Report Generator' },
    { id: 'visualization', icon: LineChart, label: 'Visualization' },
  ];

  return (
    <>
      {/* Backdrop, mobile only, shown while the drawer is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div className={cn(
        'w-64 bg-card border-r h-screen p-4 flex flex-col fixed left-0 top-0 z-50 shadow-sm sidebar-transition transition-transform duration-200',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0',
        className
      )}>
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <LineChart className="h-8 w-8 text-accent" />
            <h1 className="text-2xl font-bold text-foreground">Nexus<span className="text-accent">BI</span></h1>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1.5 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={cn(
                  'flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-150 font-medium group relative',
                  isActive
                    ? 'bg-primary/10 text-primary border-l-4 border-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary hover:shadow-sm hover:border-l-4 hover:border-primary'
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-border">
          <div className="flex px-2 py-1.5 text-xs text-muted-foreground">
            <span>NexusBI v1.0</span>
          </div>
        </div>
      </div>
    </>
  );
};

export { Sidebar }