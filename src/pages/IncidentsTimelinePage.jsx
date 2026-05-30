import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, AlertTriangle, GitCommit, MessageSquare, Bug, BarChart2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subHours, isAfter } from 'date-fns';

const sourceIcons = { github: GitCommit, slack: MessageSquare, sentry: Bug, metrics: BarChart2, custom_api: Globe };
const sourceColors = { github: 'text-chart-2 bg-chart-2/10 border-chart-2/30', slack: 'text-accent bg-accent/10 border-accent/30', sentry: 'text-destructive bg-destructive/10 border-destructive/30', metrics: 'text-primary bg-primary/10 border-primary/30', custom_api: 'text-chart-4 bg-chart-4/10 border-chart-4/30' };
const severityColors = { critical: 'bg-destructive border-destructive text-white', high: 'bg-orange-500 border-orange-500 text-white', medium: 'bg-chart-4 border-chart-4 text-background', low: 'bg-muted-foreground border-muted-foreground text-background', info: 'bg-muted border-border text-muted-foreground', warning: 'bg-chart-4/70 border-chart-4 text-background', error: 'bg-destructive/80 border-destructive text-white' };

const WINDOWS = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '7d', hours: 168 },
];

export default function IncidentTimelinePage() {
  const [timeWindow, setTimeWindow] = useState(24);
  const { user } = useAuth();

  const { data: incidents = [], isLoading: loadingInc } = useQuery({
    queryKey: ['incidents', user?.email], queryFn: () => base44.entities.Incident.filter({ created_by: user?.email }, '-detected_at'),
    enabled: !!user,
  });
  const { data: records = [], isLoading: loadingRec } = useQuery({
    queryKey: ['records', user?.email], queryFn: () => base44.entities.SourceRecord.filter({ created_by: user?.email }, '-timestamp', 200),
    enabled: !!user,
  });

  const now = new Date();
  const windowStart = subHours(now, timeWindow);

  const filteredIncidents = incidents.filter(i => i.detected_at && isAfter(new Date(i.detected_at), windowStart));
  const filteredRecords = records.filter(r => r.timestamp && isAfter(new Date(r.timestamp), windowStart));

  const allEvents = [
    ...filteredIncidents.map(i => ({ kind: 'incident', time: new Date(i.detected_at), data: i })),
    ...filteredRecords.map(r => ({ kind: 'record', time: new Date(r.timestamp), data: r })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  const timeRange = now.getTime() - windowStart.getTime();

  const getX = (time) => ((time.getTime() - windowStart.getTime()) / timeRange) * 100;

  const loading = loadingInc || loadingRec;

  // Group records into rows to avoid overlap
  const rows = [];
  for (const ev of allEvents.filter(e => e.kind === 'record')) {
    let placed = false;
    for (const row of rows) {
      const last = row[row.length - 1];
      if (getX(ev.time) - getX(last.time) > 3) {
        row.push(ev); placed = true; break;
      }
    }
    if (!placed) rows.push([ev]);
  }



  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">INCIDENT TIMELINE</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {filteredIncidents.length} incidents · {filteredRecords.length} events in last {timeWindow}h
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          {WINDOWS.map(w => (
            <button key={w.hours} onClick={() => setTimeWindow(w.hours)}
              className={cn('px-3 py-1 text-xs font-mono rounded transition-colors',
                timeWindow === w.hours ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}

      {!loading && allEvents.length === 0 && (
        <div className="border border-border rounded-lg py-16 text-center">
          <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">No events in this time window.</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">Try a wider window or sync a data source.</p>
        </div>
      )}

      {!loading && allEvents.length > 0 && (
        <div className="border border-border rounded-xl bg-card p-6 space-y-6 overflow-x-auto">
          {/* Time axis */}
          <div className="relative min-w-[600px]">
            <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <span key={f}>{format(new Date(windowStart.getTime() + f * timeRange), 'MMM d HH:mm')}</span>
              ))}
            </div>
            <div className="h-px bg-border w-full" />

            {/* Incident markers on axis */}
            <div className="relative h-8 w-full">
              {filteredIncidents.map(inc => {
                const x = getX(new Date(inc.detected_at));
                return (
                  <div key={inc.id} className="absolute -translate-x-1/2 group" style={{ left: `${x}%`, top: 4 }}>
                    <div className={cn('w-3 h-3 rotate-45 border-2 cursor-pointer', severityColors[inc.severity])} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-card border border-border rounded-md p-2 text-xs font-mono hidden group-hover:block z-20 shadow-xl">
                      <p className={cn('font-bold', inc.severity === 'critical' ? 'text-destructive' : inc.severity === 'high' ? 'text-orange-400' : 'text-chart-4')}>{inc.severity?.toUpperCase()}</p>
                      <p className="text-foreground mt-0.5 leading-tight">{inc.title}</p>
                      <p className="text-muted-foreground mt-1">{format(new Date(inc.detected_at), 'MMM d HH:mm:ss')}</p>
                      <p className={cn('mt-1', inc.status === 'resolved' ? 'text-chart-2' : 'text-chart-4')}>{inc.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-1 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rotate-45 bg-destructive border-2 border-destructive" /><span>Incident</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-chart-2" /><span>Event</span></div>
            </div>
          </div>

          {/* Event rows */}
          <div className="space-y-2 min-w-[600px]">
            {rows.slice(0, 12).map((row, ri) => (
              <div key={ri} className="relative h-7">
                <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                  <div className="w-full h-px bg-border/50" />
                </div>
                {row.map((ev, ei) => {
                  const x = getX(ev.time);
                  const r = ev.data;
                  const Icon = sourceIcons[r.source_type] || Globe;
                  const color = sourceColors[r.source_type] || sourceColors.custom_api;
                  const sevColor = severityColors[r.severity] || severityColors.info;
                  return (
                    <div key={ei} className="absolute -translate-x-1/2 -translate-y-1/2 group top-1/2 cursor-pointer z-10"
                      style={{ left: `${x}%` }}>
                      <div className={cn('w-4 h-4 rounded-full border flex items-center justify-center', color)}>
                        <Icon className="w-2.5 h-2.5" />
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-card border border-border rounded-md p-2 text-xs font-mono hidden group-hover:block z-30 shadow-xl">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={cn('px-1 py-0.5 rounded text-xs', sevColor)}>{r.severity}</span>
                          <span className="text-muted-foreground">{r.source_type} · {r.record_type}</span>
                        </div>
                        <p className="text-foreground leading-tight line-clamp-2">{r.title}</p>
                        <p className="text-muted-foreground mt-1">{r.author}</p>
                        <p className="text-muted-foreground">{format(ev.time, 'HH:mm:ss')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Source type legend */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            {Object.entries(sourceIcons).map(([type, Icon]) => (
              <div key={type} className={cn('flex items-center gap-1.5 text-xs font-mono border rounded px-2 py-0.5', sourceColors[type])}>
                <Icon className="w-3 h-3" />
                {type}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incident details list */}
      {filteredIncidents.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-card">
            <p className="text-xs font-mono uppercase tracking-wider text-foreground">Incidents in Window ({filteredIncidents.length})</p>
          </div>
          <div className="divide-y divide-border">
            {filteredIncidents.map(inc => (
              <div key={inc.id} className="px-4 py-3 bg-card flex items-start gap-3">
                <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5',
                  inc.severity === 'critical' ? 'text-destructive border-destructive/40 bg-destructive/5' :
                  inc.severity === 'high' ? 'text-orange-400 border-orange-400/40 bg-orange-400/5' :
                  'text-chart-4 border-chart-4/40 bg-chart-4/5')}>
                  {inc.severity?.toUpperCase()}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{inc.title}</p>
                  <div className="flex gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{inc.status}</span>
                    {inc.detected_at && <span className="text-xs font-mono text-muted-foreground">{format(new Date(inc.detected_at), 'MMM d HH:mm')}</span>}
                    {inc.correlated_sources?.length > 0 && <span className="text-xs font-mono text-muted-foreground">{inc.correlated_sources.join(' + ')}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}