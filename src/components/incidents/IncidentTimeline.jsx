import { useMemo } from 'react';
import { format, parseISO, subHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { AlertTriangle, GitCommit, MessageSquare, Bug, BarChart2, Globe } from 'lucide-react';

const severityDot = {
  critical: 'bg-destructive',
  high: 'bg-orange-400',
  medium: 'bg-chart-4',
  low: 'bg-muted-foreground',
  info: 'bg-chart-2',
  warning: 'bg-chart-4',
  error: 'bg-destructive',
};

const sourceIcon = {
  github: GitCommit,
  slack: MessageSquare,
  sentry: Bug,
  metrics: BarChart2,
  custom_api: Globe,
};

const sourceColor = {
  github: 'text-chart-2',
  slack: 'text-accent',
  sentry: 'text-destructive',
  metrics: 'text-primary',
  custom_api: 'text-chart-4',
};

export default function IncidentTimeline({ incidents, records }) {
  const now = new Date();
  const windowStart = subHours(now, 48);

  // Build unified events list
  const events = useMemo(() => {
    const incidentEvents = incidents
      .filter(i => i.detected_at)
      .map(i => ({
        id: `inc-${i.id}`,
        type: 'incident',
        time: parseISO(i.detected_at),
        label: i.title,
        severity: i.severity,
        status: i.status,
      }));

    const recordEvents = records
      .filter(r => r.timestamp)
      .map(r => ({
        id: `rec-${r.id}`,
        type: 'record',
        sourceType: r.source_type,
        time: parseISO(r.timestamp),
        label: r.title,
        severity: r.severity,
        recordType: r.record_type,
      }));

    return [...incidentEvents, ...recordEvents]
      .filter(e => e.time >= windowStart)
      .sort((a, b) => a.time - b.time);
  }, [incidents, records]);

  if (events.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground font-mono">No events in the last 48 hours.</p>
        <p className="text-xs text-muted-foreground font-mono mt-1">Sync a data source or create an incident to see the timeline.</p>
      </div>
    );
  }

  const totalMs = now - windowStart;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono uppercase tracking-wider text-foreground">Event Timeline (48h)</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Incident</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-2 inline-block" /> Source Event</span>
        </div>
      </div>

      {/* Timeline axis */}
      <div className="px-4 py-4 bg-background">
        <div className="relative">
          {/* Axis bar */}
          <div className="h-1.5 bg-border rounded-full relative mx-2">
            {/* Time labels */}
            {[0, 12, 24, 36, 48].map(h => (
              <div key={h} className="absolute top-3 text-xs text-muted-foreground font-mono"
                style={{ left: `${(h / 48) * 100}%`, transform: 'translateX(-50%)' }}>
                -{h}h
              </div>
            ))}

            {/* Event dots on axis */}
            {events.map(ev => {
              const pct = ((ev.time - windowStart) / totalMs) * 100;
              const isIncident = ev.type === 'incident';
              return (
                <div
                  key={ev.id}
                  className="absolute group"
                  style={{ left: `${pct}%`, top: isIncident ? '-6px' : '-4px', transform: 'translateX(-50%)' }}
                >
                  <div className={cn(
                    'rounded-full border-2 border-background cursor-pointer transition-transform group-hover:scale-150',
                    isIncident ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5',
                    severityDot[ev.severity] || 'bg-muted-foreground'
                  )} />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                    <div className="bg-popover border border-border rounded-md shadow-lg p-2 text-xs font-mono min-w-max max-w-xs">
                      <p className="font-medium text-foreground truncate">{ev.label}</p>
                      <p className="text-muted-foreground mt-0.5">{format(ev.time, 'MMM d HH:mm')}</p>
                      {isIncident && <p className={cn('mt-0.5', severityDot[ev.severity]?.replace('bg-', 'text-'))}>{ev.severity} · {ev.status}</p>}
                      {!isIncident && <p className="text-muted-foreground">{ev.sourceType} · {ev.recordType}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable event list */}
      <div className="divide-y divide-border max-h-72 overflow-y-auto">
        {[...events].reverse().map(ev => {
          const isIncident = ev.type === 'incident';
          const SourceIcon = !isIncident && sourceIcon[ev.sourceType];
          return (
            <div key={ev.id} className={cn('flex items-start gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors',
              isIncident && 'bg-destructive/5')}>
              <div className="flex-shrink-0 mt-0.5">
                {isIncident
                  ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  : SourceIcon ? <SourceIcon className={cn('w-3.5 h-3.5', sourceColor[ev.sourceType])} /> : null
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{ev.label}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {format(ev.time, 'MMM d HH:mm')}
                  {isIncident && ` · ${ev.severity} · ${ev.status}`}
                  {!isIncident && ` · ${ev.sourceType} · ${ev.recordType}`}
                </p>
              </div>
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', severityDot[ev.severity] || 'bg-muted-foreground')} />
            </div>
          );
        })}
      </div>
    </div>
  );
}