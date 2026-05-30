import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, isAfter } from 'date-fns';
import { TrendingUp, AlertTriangle, Lightbulb, Database, Activity } from 'lucide-react';
import ExportButton from '@/components/ExportButton';

const COLORS = ['hsl(190,95%,55%)', 'hsl(145,70%,50%)', 'hsl(265,85%,65%)', 'hsl(35,95%,60%)', 'hsl(0,72%,55%)'];

export default function AnalyticsPage() {
  const { user } = useAuth();

  const { data: records = [] } = useQuery({
    queryKey: ['records', user?.email],
    queryFn: () => base44.entities.SourceRecord.filter({ created_by: user?.email }, '-timestamp', 200),
    enabled: !!user,
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents', user?.email],
    queryFn: () => base44.entities.Incident.filter({ created_by: user?.email }, '-detected_at'),
    enabled: !!user,
  });
  const { data: insights = [] } = useQuery({
    queryKey: ['insights', user?.email],
    queryFn: () => base44.entities.AgentInsight.filter({ created_by: user?.email }, '-created_date'),
    enabled: !!user,
  });
  const { data: sources = [] } = useQuery({
    queryKey: ['sources', user?.email],
    queryFn: () => base44.entities.DataSource.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  // Activity trend: last 7 days
  const activityByDay = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const label = format(day, 'MMM d');
    const dayStart = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    return {
      day: label,
      events: records.filter(r => r.timestamp && new Date(r.timestamp) >= dayStart && new Date(r.timestamp) < dayEnd).length,
      incidents: incidents.filter(inc => inc.detected_at && new Date(inc.detected_at) >= dayStart && new Date(inc.detected_at) < dayEnd).length,
    };
  });

  // Source type breakdown
  const sourceBreakdown = ['github', 'slack', 'sentry', 'metrics', 'custom_api'].map(type => ({
    name: type,
    value: records.filter(r => r.source_type === type).length,
  })).filter(s => s.value > 0);

  // Severity distribution
  const severityData = ['info', 'warning', 'error', 'critical'].map(sev => ({
    name: sev,
    count: records.filter(r => r.severity === sev).length,
  }));

  // Incident severity breakdown
  const incidentSeverity = ['low', 'medium', 'high', 'critical'].map(sev => ({
    name: sev,
    value: incidents.filter(i => i.severity === sev).length,
  })).filter(s => s.value > 0);

  const connectedSources = sources.filter(s => s.status === 'connected').length;
  const openIncidents = incidents.filter(i => ['detected', 'investigating'].includes(i.status)).length;
  const recentRecords = records.filter(r => r.timestamp && isAfter(new Date(r.timestamp), subDays(new Date(), 1))).length;

  const exportData = records.map(r => ({
    title: r.title,
    source_type: r.source_type,
    record_type: r.record_type,
    severity: r.severity,
    author: r.author,
    timestamp: r.timestamp,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">ANALYTICS</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Performance metrics & trends for your workspace</p>
        </div>
        <ExportButton data={exportData} filename="analytics_export" label="Export Data" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Connected Sources', value: connectedSources, Ico: Database, color: 'text-primary' },
          { label: 'Open Incidents', value: openIncidents, Ico: AlertTriangle, color: 'text-destructive' },
          { label: 'AI Insights', value: insights.length, Ico: Lightbulb, color: 'text-accent' },
          { label: 'Events (24h)', value: recentRecords, Ico: Activity, color: 'text-chart-2' },
        ].map(({ label, value, Ico, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-muted ${color}`}>
              <Ico className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">{label}</p>
              <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Trend */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-sm font-mono font-semibold text-foreground">Activity Trend (Last 7 Days)</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={activityByDay}>
            <defs>
              <linearGradient id="eventsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(190,95%,55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(190,95%,55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0,72%,55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0,72%,55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,16%)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'hsl(215,20%,55%)' }} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'hsl(215,20%,55%)' }} />
            <Tooltip contentStyle={{ background: 'hsl(220,18%,7%)', border: '1px solid hsl(220,15%,16%)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} />
            <Legend />
            <Area type="monotone" dataKey="events" stroke="hsl(190,95%,55%)" fill="url(#eventsGrad)" strokeWidth={2} name="Events" />
            <Area type="monotone" dataKey="incidents" stroke="hsl(0,72%,55%)" fill="url(#incGrad)" strokeWidth={2} name="Incidents" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Severity Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-mono font-semibold text-foreground mb-4">Event Severity Breakdown</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,16%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'hsl(215,20%,55%)' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'hsl(215,20%,55%)' }} />
              <Tooltip contentStyle={{ background: 'hsl(220,18%,7%)', border: '1px solid hsl(220,15%,16%)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} />
              <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                {severityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source Pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-mono font-semibold text-foreground mb-4">Source Distribution</p>
          {sourceBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground font-mono">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sourceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {sourceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(220,18%,7%)', border: '1px solid hsl(220,15%,16%)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Incident Severity Pie */}
      {incidentSeverity.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-mono font-semibold text-foreground mb-4">Incident Severity Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={incidentSeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                {incidentSeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(220,18%,7%)', border: '1px solid hsl(220,15%,16%)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}