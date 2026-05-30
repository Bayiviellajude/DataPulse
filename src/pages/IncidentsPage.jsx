import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
// Notification entity used inline via base44.entities.Notification
import { AlertTriangle, Sparkles, Loader2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import ExportButton from '@/components/ExportButton';
import { useAuth } from '@/lib/AuthContext';

const severityColors = {
  critical: 'text-destructive border-destructive/40 bg-destructive/5',
  high: 'text-orange-400 border-orange-400/40 bg-orange-400/5',
  medium: 'text-chart-4 border-chart-4/40 bg-chart-4/5',
  low: 'text-muted-foreground border-border bg-muted/30',
};
const statusColors = {
  detected: 'text-destructive',
  investigating: 'text-chart-4',
  resolved: 'text-chart-2',
  dismissed: 'text-muted-foreground',
};

export default function IncidentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium', correlated_sources: [] });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', user?.email],
    queryFn: () => base44.entities.Incident.filter({ created_by: user?.email }, '-detected_at'),
    enabled: !!user,
  });

  const { data: records = [] } = useQuery({
    queryKey: ['records', user?.email],
    queryFn: () => base44.entities.SourceRecord.filter({ created_by: user?.email }, '-timestamp', 50),
    enabled: !!user,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources', user?.email],
    queryFn: () => base44.entities.DataSource.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  // Find connected Slack source for notifications
  const slackSource = sources.find(s => s.type === 'slack' && s.status === 'connected');

  const sendSlackAlert = async (incident) => {
    if (!slackSource?.config?.token || !slackSource?.config?.channel) return;
    const severityEmoji = { critical: '🚨', high: '🔴', medium: '🟡', low: '🟢' }[incident.severity] || '⚠️';
    const text = `${severityEmoji} *New ${incident.severity?.toUpperCase()} Incident Detected*\n*${incident.title}*\n${incident.description || ''}\nSeverity: ${incident.severity} | Status: detected\n<${window.location.origin}/incidents|View in DataPulse>`;
    // Call Slack API directly via fetch
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${slackSource.config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: slackSource.config.channel, text, mrkdwn: true }),
    }).catch(() => {}); // Silently fail if blocked by CORS (backend function needed for production)
  };

  const createMutation = useMutation({
    mutationFn: async data => {
      const incident = await base44.entities.Incident.create({ ...data, status: 'detected', detected_at: new Date().toISOString() });
      if (['critical', 'high'].includes(data.severity)) {
        await sendSlackAlert(incident);
      }
      // In-app notification
      if (user?.email) {
        await base44.entities.Notification.create({
          user_email: user.email,
          title: `New ${data.severity?.toUpperCase()} Incident`,
          message: data.title,
          type: 'incident',
          link: '/incidents',
          is_read: false,
        });
      }
      return incident;
    },
    onSuccess: () => { qc.invalidateQueries(['incidents']); qc.invalidateQueries(['notifications', user?.email]); setOpen(false); setForm({ title: '', description: '', severity: 'medium', correlated_sources: [] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Incident.update(id, data),
    onSuccess: () => qc.invalidateQueries(['incidents']),
  });

  const analyzeMutation = useMutation({
    mutationFn: async (incident) => {
      setAnalyzing(incident.id);
      // Fetch relevant records for context
      const relevantRecords = records.filter(r =>
        incident.correlated_sources?.includes(r.source_type) ||
        incident.correlated_sources?.length === 0
      ).slice(0, 20);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert SRE (Site Reliability Engineer). Analyze this incident using the available operational data and provide a detailed root cause analysis.

INCIDENT:
Title: ${incident.title}
Description: ${incident.description || 'No description provided'}
Severity: ${incident.severity}
Correlated Sources: ${(incident.correlated_sources || []).join(', ') || 'none specified'}

RELATED OPERATIONAL DATA (${relevantRecords.length} recent records):
${JSON.stringify(relevantRecords.map(r => ({ type: r.source_type, kind: r.record_type, title: r.title, author: r.author, severity: r.severity, time: r.timestamp })), null, 2)}

Provide:
1. **Root Cause Analysis** — What likely caused this incident based on the data
2. **Impact Assessment** — What systems/users are affected
3. **Immediate Remediation Steps** — What to do right now (numbered list)
4. **Prevention Measures** — How to prevent recurrence

Be specific and reference any relevant data points from the operational records above.`,
      });
      await base44.entities.Incident.update(incident.id, {
        ai_analysis: result,
        status: 'investigating',
      });
      return result;
    },
    onSuccess: () => { qc.invalidateQueries(['incidents']); setAnalyzing(null); },
    onError: () => setAnalyzing(null),
  });

  const autoDetectMutation = useMutation({
    mutationFn: async () => {
      const errorRecords = records.filter(r => r.severity === 'error' || r.severity === 'critical');
      if (errorRecords.length === 0) return null;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze these ${errorRecords.length} error/critical events and identify if any should be escalated as incidents. Group related events together.

Events:
${JSON.stringify(errorRecords.map(r => ({ type: r.source_type, kind: r.record_type, title: r.title, author: r.author, time: r.timestamp })))}

Return up to 3 incidents worth creating. Only return incidents for genuinely concerning patterns.`,
        response_json_schema: {
          type: 'object',
          properties: {
            incidents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  severity: { type: 'string' },
                  correlated_sources: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      });

      for (const inc of (result.incidents || [])) {
        const created = await base44.entities.Incident.create({
          ...inc,
          status: 'detected',
          detected_at: new Date().toISOString(),
        });
        if (['critical', 'high'].includes(inc.severity)) {
          await sendSlackAlert(created);
        }
      }
      return result.incidents?.length || 0;
    },
    onSuccess: () => qc.invalidateQueries(['incidents']),
  });

  const statusOptions = ['detected', 'investigating', 'resolved', 'dismissed'];
  const sourceTypes = ['github', 'slack', 'sentry', 'metrics', 'custom_api'];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">INCIDENTS</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {incidents.filter(i => i.status === 'detected').length} active · {incidents.length} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {slackSource && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-chart-2/10 border border-chart-2/20 rounded text-xs font-mono text-chart-2">
              <span className="w-1.5 h-1.5 rounded-full bg-chart-2" />
              Slack alerts on
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => autoDetectMutation.mutate()}
            disabled={autoDetectMutation.isPending || records.length === 0} className="font-mono text-xs">
            {autoDetectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            AI Auto-Detect
          </Button>
          <ExportButton
            data={incidents.map(i => ({ title: i.title, severity: i.severity, status: i.status, detected_at: i.detected_at, sources: (i.correlated_sources||[]).join(', ') }))}
            filename="incidents_export"
            label="Export"
          />
          <Button size="sm" onClick={() => setOpen(true)} className="font-mono">
            <Plus className="w-4 h-4 mr-1.5" /> New Incident
          </Button>
        </div>
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-4 gap-3">
        {['critical', 'high', 'medium', 'low'].map(sev => (
          <div key={sev} className={cn('border rounded-lg p-3', severityColors[sev])}>
            <p className="text-xs font-mono uppercase tracking-wider opacity-70">{sev}</p>
            <p className="text-2xl font-bold font-mono mt-0.5">
              {incidents.filter(i => i.severity === sev).length}
            </p>
          </div>
        ))}
      </div>

      {/* Incidents List */}
      <div className="border border-border rounded-lg overflow-hidden">
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
        {incidents.length === 0 && !isLoading && (
          <div className="px-4 py-10 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-mono">No incidents detected.</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {records.length > 0 ? 'Click "AI Auto-Detect" to scan your data for issues.' : 'Connect and sync a data source first.'}
            </p>
          </div>
        )}
        <div className="divide-y divide-border">
          {incidents.map(inc => (
            <div key={inc.id} className="bg-card">
              <div className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30"
                onClick={() => setExpanded(expanded === inc.id ? null : inc.id)}>
                <span className={cn('mt-0.5 px-1.5 py-0.5 text-xs font-mono rounded border flex-shrink-0', severityColors[inc.severity])}>
                  {inc.severity?.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{inc.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className={cn('text-xs font-mono', statusColors[inc.status])}>{inc.status}</span>
                    {inc.correlated_sources?.length > 0 && (
                      <span className="text-xs text-muted-foreground font-mono">{inc.correlated_sources.join(' + ')}</span>
                    )}
                    {inc.detected_at && (
                      <span className="text-xs text-muted-foreground font-mono">{format(new Date(inc.detected_at), 'MMM d HH:mm')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {analyzing === inc.id ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-mono text-accent border border-accent/30 hover:bg-accent/10"
                      onClick={e => { e.stopPropagation(); analyzeMutation.mutate(inc); }}>
                      <Sparkles className="w-3 h-3 mr-1" /> AI Analyze
                    </Button>
                  )}
                  {expanded === inc.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expanded === inc.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-border bg-muted/20">
                  {inc.description && (
                    <div className="pt-3">
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                      <p className="text-xs text-foreground">{inc.description}</p>
                    </div>
                  )}
                  {inc.root_cause && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Root Cause</p>
                      <p className="text-xs text-foreground">{inc.root_cause}</p>
                    </div>
                  )}
                  {inc.ai_analysis && (
                    <div>
                      <p className="text-xs font-mono text-accent uppercase tracking-wider mb-1">AI Analysis</p>
                      <div className="bg-accent/5 border border-accent/20 rounded-md p-3">
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{inc.ai_analysis}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Update Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {statusOptions.map(s => (
                        <Button key={s} variant="outline" size="sm"
                          className={cn('h-7 text-xs font-mono', inc.status === s && 'border-primary text-primary')}
                          onClick={() => updateMutation.mutate({ id: inc.id, data: { status: s } })}>
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Incident Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Create Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Title</Label>
              <Input placeholder="e.g. API response time spike"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Description</Label>
              <Input placeholder="What happened?"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['critical', 'high', 'medium', 'low'].map(s => (
                    <SelectItem key={s} value={s} className="font-mono">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Correlated Sources</Label>
              <div className="flex flex-wrap gap-1.5">
                {sourceTypes.map(s => (
                  <button key={s} onClick={() => setForm(f => ({
                    ...f,
                    correlated_sources: f.correlated_sources.includes(s)
                      ? f.correlated_sources.filter(x => x !== s)
                      : [...f.correlated_sources, s]
                  }))}
                    className={cn('text-xs font-mono px-2 py-1 rounded border transition-colors',
                      form.correlated_sources.includes(s) ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="font-mono">Cancel</Button>
            <Button size="sm" disabled={!form.title || createMutation.isPending}
              onClick={() => createMutation.mutate(form)} className="font-mono">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Incident'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}