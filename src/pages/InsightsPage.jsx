import { useState } from 'react';
import ExportButton from '@/components/ExportButton';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Lightbulb, Sparkles, AlertCircle, GitMerge, Zap, TrendingUp, Check, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const typeConfig = {
  anomaly: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/20' },
  correlation: { icon: GitMerge, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
  recommendation: { icon: Lightbulb, color: 'text-accent', bg: 'bg-accent/5 border-accent/20' },
  alert: { icon: Zap, color: 'text-chart-4', bg: 'bg-chart-4/5 border-chart-4/20' },
  trend: { icon: TrendingUp, color: 'text-chart-2', bg: 'bg-chart-2/5 border-chart-2/20' },
};

export default function InsightsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['insights', user?.email],
    queryFn: () => base44.entities.AgentInsight.filter({ created_by: user?.email }, '-created_date'),
    enabled: !!user,
  });

  const { data: records = [] } = useQuery({
    queryKey: ['records', user?.email],
    queryFn: () => base44.entities.SourceRecord.filter({ created_by: user?.email }, '-timestamp', 100),
    enabled: !!user,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents', user?.email],
    queryFn: () => base44.entities.Incident.filter({ created_by: user?.email }, '-detected_at', 20),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: id => base44.entities.AgentInsight.update(id, { is_read: true }),
    onSuccess: () => qc.invalidateQueries(['insights']),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.AgentInsight.delete(id),
    onSuccess: () => qc.invalidateQueries(['insights']),
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      if (records.length === 0) throw new Error('No records to analyze. Sync a data source first.');

      const summary = records.slice(0, 60).map(r => ({
        type: r.source_type,
        kind: r.record_type,
        title: r.title,
        author: r.author,
        severity: r.severity,
        timestamp: r.timestamp,
        tags: r.tags,
      }));

      const incidentSummary = incidents.slice(0, 10).map(i => ({
        title: i.title,
        severity: i.severity,
        status: i.status,
        sources: i.correlated_sources,
      }));

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert AI operations analyst with deep knowledge of software engineering, DevOps, and SRE practices.

Analyze the following REAL operational data from connected sources and generate 4-6 actionable insights. Focus on:
- Temporal patterns (e.g. activity bursts, off-hours commits)
- Author-level patterns (e.g. one person causing most errors)
- Cross-source correlations (e.g. commits followed by issues)
- Anomalies vs normal baseline
- Risk signals in open PRs or recurring error types

SOURCE RECORDS (${records.length} total, showing ${summary.length}):
${JSON.stringify(summary, null, 2)}

OPEN INCIDENTS (${incidents.length}):
${JSON.stringify(incidentSummary, null, 2)}

Generate insights that are specific to THIS data, not generic advice. Reference actual authors, titles, and patterns you observe.`,
        response_json_schema: {
          type: 'object',
          properties: {
            insights: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  insight_type: { type: 'string', enum: ['anomaly', 'correlation', 'recommendation', 'alert', 'trend'] },
                  severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
                  sources_involved: { type: 'array', items: { type: 'string' } },
                  action_suggested: { type: 'string' },
                  confidence: { type: 'number' },
                },
              },
            },
          },
        },
      });

      for (const insight of (result.insights || [])) {
        await base44.entities.AgentInsight.create({ ...insight, is_read: false });
      }
      return result.insights?.length || 0;
    },
    onSuccess: () => qc.invalidateQueries(['insights']),
  });

  const filtered = filter === 'all' ? insights
    : filter === 'unread' ? insights.filter(i => !i.is_read)
    : insights.filter(i => i.insight_type === filter);

  const types = ['all', 'unread', ...Object.keys(typeConfig)];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">AI INSIGHTS</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {insights.filter(i => !i.is_read).length} unread · {insights.length} total · based on {records.length} records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={insights.map(i => ({ title: i.title, type: i.insight_type, severity: i.severity, description: i.description, action: i.action_suggested, confidence: i.confidence }))}
            filename="insights_export"
            label="Export"
          />
          <Button size="sm" onClick={() => generateInsightsMutation.mutate()}
            disabled={generateInsightsMutation.isPending || records.length === 0} className="font-mono">
            {generateInsightsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            Generate Insights
          </Button>
        </div>
      </div>

      {records.length === 0 && (
        <div className="border border-chart-4/30 bg-chart-4/5 rounded-lg px-4 py-3 text-xs font-mono text-chart-4">
          ⚠ No data to analyze yet. Go to <strong>Data Sources</strong> and sync a source first.
        </div>
      )}

      {generateInsightsMutation.isPending && (
        <div className="border border-primary/20 bg-primary/5 rounded-lg px-4 py-3 text-xs font-mono text-primary flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Analyzing {records.length} records across your connected sources…
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={cn('px-2.5 py-1 text-xs font-mono rounded border transition-colors',
              filter === t ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/20')}>
            {t}
            {t === 'unread' && insights.filter(i => !i.is_read).length > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground rounded-full text-xs px-1">{insights.filter(i => !i.is_read).length}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}

      {filtered.length === 0 && !isLoading && (
        <div className="border border-border rounded-lg px-4 py-12 text-center">
          <Lightbulb className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">No insights yet.</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {records.length > 0 ? 'Click "Generate Insights" to analyze your real data.' : 'Connect a data source first.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(insight => {
          const cfg = typeConfig[insight.insight_type] || typeConfig.correlation;
          const Icon = cfg.icon;
          return (
            <div key={insight.id} className={cn('border rounded-lg p-4 transition-all', cfg.bg, !insight.is_read && 'ring-1 ring-primary/30')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', cfg.color)} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{insight.title}</p>
                      {!insight.is_read && (
                        <span className="text-xs font-mono px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">NEW</span>
                      )}
                      <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border',
                        insight.severity === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        insight.severity === 'warning' ? 'bg-chart-4/10 text-chart-4 border-chart-4/20' :
                        'bg-muted text-muted-foreground border-border')}>
                        {insight.severity}
                      </span>
                    </div>
                    {insight.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {insight.sources_involved?.map(s => (
                        <span key={s} className="text-xs font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                      {insight.confidence && (
                        <span className="text-xs font-mono text-muted-foreground">{insight.confidence}% confidence</span>
                      )}
                      <span className="text-xs font-mono text-muted-foreground">{format(new Date(insight.created_date), 'MMM d HH:mm')}</span>
                    </div>
                    {insight.action_suggested && (
                      <div className="mt-2 border-l-2 border-current/30 pl-3">
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Suggested Action</p>
                        <p className="text-xs text-foreground mt-0.5">{insight.action_suggested}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!insight.is_read && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0"
                      title="Mark as read"
                      onClick={() => markReadMutation.mutate(insight.id)}>
                      <Check className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0"
                    title="Delete"
                    onClick={() => deleteMutation.mutate(insight.id)}>
                    <span className="text-muted-foreground text-xs">✕</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}