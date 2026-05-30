import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const severityColors = {
  critical: 'text-destructive border-destructive/30 bg-destructive/5',
  high: 'text-orange-400 border-orange-400/30 bg-orange-400/5',
  medium: 'text-chart-4 border-chart-4/30 bg-chart-4/5',
  low: 'text-muted-foreground border-border bg-muted/30',
};

export default function IncidentFeed({ incidents }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs font-mono font-medium uppercase tracking-wider text-foreground">Incidents</span>
        </div>
        <Link to="/incidents" className="text-xs text-muted-foreground hover:text-primary font-mono flex items-center gap-0.5">
          all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {incidents.length === 0 && (
          <p className="text-xs text-muted-foreground font-mono px-4 py-3">No active incidents</p>
        )}
        {incidents.map(inc => (
          <div key={inc.id} className="px-4 py-2.5 bg-card hover:bg-secondary/50 transition-colors">
            <div className="flex items-start gap-2">
              <span className={cn('mt-0.5 px-1.5 py-0.5 text-xs font-mono rounded border flex-shrink-0', severityColors[inc.severity])}>
                {inc.severity?.toUpperCase()}
              </span>
              <p className="text-xs text-foreground leading-tight line-clamp-2">{inc.title}</p>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1 ml-0">
              {inc.status} · {inc.correlated_sources?.join(', ') || 'unknown'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}