import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Lightbulb, Database, Activity } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import IncidentFeed from '@/components/dashboard/IncidentFeed';
import InsightsFeed from '@/components/dashboard/InsightsFeed';
import ActivityTimeline from '@/components/dashboard/ActivityTimeline';
import { useAuth } from '@/lib/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: sources = [] } = useQuery({ queryKey: ['sources', user?.email], queryFn: () => base44.entities.DataSource.filter({ created_by: user?.email }), enabled: !!user });
  const { data: incidents = [] } = useQuery({ queryKey: ['incidents', user?.email], queryFn: () => base44.entities.Incident.filter({ created_by: user?.email }, '-detected_at', 20), enabled: !!user });
  const { data: insights = [] } = useQuery({ queryKey: ['insights', user?.email], queryFn: () => base44.entities.AgentInsight.filter({ created_by: user?.email }, '-created_date', 20), enabled: !!user });
  const { data: records = [] } = useQuery({ queryKey: ['records', user?.email], queryFn: () => base44.entities.SourceRecord.filter({ created_by: user?.email }, '-timestamp', 50), enabled: !!user });

  const connectedSources = sources.filter(s => s.status === 'connected').length;
  const openIncidents = incidents.filter(i => i.status === 'detected' || i.status === 'investigating').length;
  const unreadInsights = insights.filter(i => !i.is_read).length;
  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">MISSION CONTROL</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Cross-source correlation engine · {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-chart-2/10 border border-chart-2/20 rounded-md">
          <span className="w-2 h-2 bg-chart-2 rounded-full animate-pulse-dot" />
          <span className="text-xs font-mono text-chart-2">LIVE</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Connected Sources" value={connectedSources} total={sources.length} icon={Database} color="primary" />
        <StatCard label="Open Incidents" value={openIncidents} badge={criticalIncidents > 0 ? `${criticalIncidents} critical` : null} icon={AlertTriangle} color="destructive" />
        <StatCard label="AI Insights" value={unreadInsights} badge="unread" icon={Lightbulb} color="accent" />
        <StatCard label="Events (24h)" value={records.length} icon={Activity} color="chart-2" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ActivityTimeline records={records} />
        </div>
        <div className="space-y-4">
          <IncidentFeed incidents={incidents.slice(0, 5)} />
          <InsightsFeed insights={insights.slice(0, 4)} />
        </div>
      </div>
    </div>
  );
}