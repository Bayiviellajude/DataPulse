import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Database, Search, AlertTriangle, Lightbulb,
  Bot, Activity, Clock, FileText, BarChart2, Users, User, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Mission Control' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  { path: '/sources', icon: Database, label: 'Data Sources' },
  { path: '/query', icon: Search, label: 'Coral Query' },
  { path: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { path: '/timeline', icon: Clock, label: 'Timeline' },
  { path: '/insights', icon: Lightbulb, label: 'Insights' },
  { path: '/summary', icon: FileText, label: 'Daily Summary' },
  { path: '/agent', icon: Bot, label: 'AI Agent' },
  { path: '/community', icon: Users, label: 'Community' },
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className="w-5 h-5 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full animate-pulse-dot" />
            </div>
            <span className="font-mono font-bold text-foreground tracking-tight">DataPulse</span>
          </div>
          <NotificationBell />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-sans truncate">{label}</span>
                {active && <span className="ml-auto w-1 h-4 bg-primary rounded-full flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
          {user && (
            <div className="text-xs font-mono text-muted-foreground truncate" title={user.email}>
              {user.full_name || user.email}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-chart-2 rounded-full animate-pulse-dot" />
            <span className="text-xs text-muted-foreground font-mono">SYSTEM ONLINE</span>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}