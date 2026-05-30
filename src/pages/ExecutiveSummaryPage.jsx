import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Sparkles, Loader2, RefreshCw, AlertTriangle, Lightbulb, Activity, TrendingUp, Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, subHours } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function ExecutiveSummaryPage() {
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const { data: incidents = [] } = useQuery({ queryKey: ['incidents'], queryFn: () => base44.entities.Incident.list('-detected_at', 50) });
  const { data: insights = [] } = useQuery({ queryKey: ['insights'], queryFn: () => base44.entities.AgentInsight.list('-created_date', 50) });
  const { data: records = [] } = useQuery({ queryKey: ['records'], queryFn: () => base44.entities.SourceRecord.list('-timestamp', 200) });
  const { data: sources = [] } = useQuery({ queryKey: ['sources'], queryFn: () => base44.entities.DataSource.list() });

  const cutoff24h = subHours(new Date(), 24);

  const recent = {
    incidents: incidents.filter(i => i.detected_at && new Date(i.detected_at) >= cutoff24h),
    records: records.filter(r => r.timestamp && new Date(r.timestamp) >= cutoff24h),
    insights: insights.filter(i => i.created_date && new Date(i.created_date) >= cutoff24h),
  };

  const generateReport = async () => {
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are preparing a daily executive summary report for a software engineering leadership team. Use the operational data below to write a clear, concise, professional report. Format using Markdown with clear sections.

## DATA FROM THE LAST 24 HOURS

### Active Incidents (${recent.incidents.length})
${JSON.stringify(recent.incidents.map(i => ({ title: i.title, severity: i.severity, status: i.status, sources: i.correlated_sources, time: i.detected_at })), null, 2)}

### All Incidents Total: ${incidents.length} | Open: ${incidents.filter(i => ['detected','investigating'].includes(i.status)).length} | Resolved: ${incidents.filter(i => i.status === 'resolved').length}

### AI Insights (${recent.insights.length} new)
${JSON.stringify(recent.insights.map(i => ({ title: i.title, type: i.insight_type, severity: i.severity, description: i.description })), null, 2)}

### Data Source Events (${recent.records.length} events)
Event breakdown by source:
${['github','slack','sentry','metrics','custom_api'].map(t => `- ${t}: ${recent.records.filter(r => r.source_type === t).length} events`).join('\n')}

Severity breakdown:
- Critical: ${recent.records.filter(r => r.severity === 'critical').length}
- Error: ${recent.records.filter(r => r.severity === 'error').length}
- Warning: ${recent.records.filter(r => r.severity === 'warning').length}
- Info: ${recent.records.filter(r => r.severity === 'info').length}

Connected sources: ${sources.filter(s => s.status === 'connected').map(s => s.name).join(', ') || 'none'}

## REPORT STRUCTURE
Write the report with these sections:
1. **Executive Summary** (2-3 sentences, the most important takeaway)
2. **System Health Score** (score 0-100 with brief rationale)
3. **Critical Issues Requiring Attention** (bullet list, only if any critical/high incidents)
4. **Key Activity Highlights** (notable commits, deployments, or patterns)
5. **AI-Detected Trends & Anomalies** (from insights data)
6. **Recommendations** (3-5 actionable items for the next 24 hours)
7. **Metrics at a Glance** (a brief table of key numbers)

Be direct, factual, and executive-friendly. Reference specific incidents and data points by name. If data is sparse, acknowledge it honestly.`,
      model: 'claude_sonnet_4_6',
    });
    setReport(result);
    setGeneratedAt(new Date());
    setGenerating(false);
  };

  const statBoxes = [
    { label: '24h Incidents', value: recent.incidents.length, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/20' },
    { label: 'Open Incidents', value: incidents.filter(i => ['detected','investigating'].includes(i.status)).length, icon: Shield, color: 'text-orange-400', bg: 'bg-orange-400/5 border-orange-400/20' },
    { label: 'New Insights', value: recent.insights.length, icon: Lightbulb, color: 'text-accent', bg: 'bg-accent/5 border-accent/20' },
    { label: '24h Events', value: recent.records.length, icon: Activity, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
    { label: 'Critical Events', value: recent.records.filter(r => r.severity === 'critical' || r.severity === 'error').length, icon: TrendingUp, color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/20' },
    { label: 'Resolved', value: incidents.filter(i => i.status === 'resolved').length, icon: CheckCircle2, color: 'text-chart-2', bg: 'bg-chart-2/5 border-chart-2/20' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">EXECUTIVE SUMMARY</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            AI-generated daily report · {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
        <Button onClick={generateReport} disabled={generating} className="font-mono">
          {generating
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
            : report
              ? <><RefreshCw className="w-4 h-4 mr-2" /> Regenerate Report</>
              : <><Sparkles className="w-4 h-4 mr-2" /> Generate Report</>
          }
        </Button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statBoxes.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={cn('border rounded-lg p-3', bg)}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={cn('w-3.5 h-3.5', color)} />
              <p className="text-xs font-mono text-muted-foreground truncate">{label}</p>
            </div>
            <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Report */}
      {!report && !generating && (
        <div className="border border-border rounded-lg p-16 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium text-foreground font-mono">No report generated yet</p>
          <p className="text-xs text-muted-foreground font-mono mt-2 max-w-sm mx-auto">
            Click "Generate Report" to have the AI analyze the last 24 hours of data and produce an executive summary.
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1 opacity-60">
            Note: Uses Claude Sonnet — consumes more integration credits.
          </p>
        </div>
      )}

      {generating && (
        <div className="border border-border rounded-lg p-16 text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-sm font-mono text-foreground">Analyzing 24h of operational data…</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">This may take 10-20 seconds</p>
        </div>
      )}

      {report && !generating && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-foreground">Daily Report</span>
            </div>
            {generatedAt && (
              <span className="text-xs text-muted-foreground font-mono">Generated {format(generatedAt, 'HH:mm:ss')}</span>
            )}
          </div>
          <div className="p-6 bg-background">
            <ReactMarkdown
              className="prose prose-sm max-w-none text-foreground
                [&_h1]:text-foreground [&_h1]:font-mono [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:first:mt-0
                [&_h2]:text-foreground [&_h2]:font-mono [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5
                [&_h3]:text-foreground [&_h3]:font-mono [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-4
                [&_p]:text-foreground [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3
                [&_ul]:text-foreground [&_ul]:text-sm [&_ul]:mb-3 [&_ul]:ml-4 [&_ul]:list-disc
                [&_ol]:text-foreground [&_ol]:text-sm [&_ol]:mb-3 [&_ol]:ml-4 [&_ol]:list-decimal
                [&_li]:mb-1.5
                [&_strong]:text-foreground [&_strong]:font-semibold
                [&_table]:border-collapse [&_table]:w-full [&_table]:mb-4 [&_table]:text-sm
                [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:bg-secondary [&_th]:font-mono [&_th]:text-xs
                [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5
                [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-primary
                [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground"
            >
              {report}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}