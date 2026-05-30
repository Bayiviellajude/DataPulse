import { GitCommit, MessageSquare, Bug, BarChart2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const sourceIcons = {
  github: GitCommit,
  slack: MessageSquare,
  sentry: Bug,
  metrics: BarChart2,
  custom_api: Globe,
};
const sourceColors = {
  github: 'text-chart-2 border-chart-2/30 bg-chart-2/10',
  slack: 'text-accent border-accent/30 bg-accent/10',
  sentry: 'text-destructive border-destructive/30 bg-destructive/10',
  metrics: 'text-primary border-primary/30 bg-primary/10',
  custom_api: 'text-chart-4 border-chart-4/30 bg-chart-4/10',
};
const severityDot = {
  info: 'bg-primary',
  warning: 'bg-chart-4',
  error: 'bg-destructive',
  critical: 'bg-destructive animate-pulse',
};

export default function ActivityTimeline({ records }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card">
        <span className="w-2 h-2 bg-chart-2 rounded-full animate-pulse-dot" />
        <span className="text-xs font-mono font-medium uppercase tracking-wider text-foreground">Live Event Stream</span>
        <span className="ml-auto text-xs font-mono text-muted-foreground">{records.length} events</span>
      </div>

      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {records.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground font-mono">No events yet. Connect a data source to start streaming.</p>
          </div>
        )}
        {records.map(rec => {
          const Icon = sourceIcons[rec.source_type] || Globe;
          const colorClass = sourceColors[rec.source_type] || 'text-muted-foreground border-border bg-muted/10';
          return (
            <div key={rec.id} className="flex items-start gap-3 px-4 py-2.5 bg-card hover:bg-secondary/30 transition-colors">
              <div className={cn('mt-0.5 p-1 rounded border flex-shrink-0', colorClass)}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', severityDot[rec.severity] || 'bg-primary')} />
                  <p className="text-xs text-foreground truncate">{rec.title}</p>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {rec.author && `${rec.author} · `}
                  {rec.record_type} · {rec.timestamp ? format(new Date(rec.timestamp), 'HH:mm:ss') : '—'}
                </p>
              </div>
              <span className={cn('flex-shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border', colorClass)}>
                {rec.source_type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}