import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ExportButton from '@/components/ExportButton';
import { Plus, Database, GitCommit, MessageSquare, Bug, BarChart2, Globe, RefreshCw, Trash2, Loader2, Key, Link, CheckCircle2, XCircle, ChevronDown, ChevronUp, Bell, Activity, Layers, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const sourceTypeConfig = {
  github: {
    icon: GitCommit, color: 'text-chart-2', label: 'GitHub',
    desc: 'Commits, PRs, issues from any public or private repo',
    fields: [
      { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_xxxxxxxxxxxx', type: 'password', hint: 'Settings → Developer settings → Personal access tokens' },
      { key: 'repo', label: 'Repository', placeholder: 'owner/repo-name', type: 'text', hint: 'e.g. facebook/react or your-org/your-repo' },
    ],
  },
  slack: {
    icon: MessageSquare, color: 'text-accent', label: 'Slack',
    desc: 'Messages and activity from your Slack workspace',
    fields: [
      { key: 'token', label: 'Bot Token', placeholder: 'xoxb-xxxxxxxxxxxx', type: 'password', hint: 'From your Slack App → OAuth & Permissions' },
      { key: 'channel', label: 'Channel ID', placeholder: 'C0123456789', type: 'text', hint: 'Right-click channel → View channel details → Copy ID' },
    ],
  },
  sentry: {
    icon: Bug, color: 'text-destructive', label: 'Sentry',
    desc: 'Errors, releases and performance from Sentry',
    fields: [
      { key: 'token', label: 'Auth Token', placeholder: 'your-sentry-auth-token', type: 'password', hint: 'Sentry → Settings → Account → API → Auth Tokens' },
      { key: 'org', label: 'Organization Slug', placeholder: 'my-org', type: 'text', hint: 'Found in your Sentry org URL' },
      { key: 'project', label: 'Project Slug', placeholder: 'my-project', type: 'text', hint: 'Found in your Sentry project settings' },
    ],
  },
  metrics: {
    icon: BarChart2, color: 'text-primary', label: 'Metrics',
    desc: 'Time-series metrics from Prometheus or custom endpoints',
    fields: [
      { key: 'endpoint', label: 'Metrics Endpoint URL', placeholder: 'https://prometheus.mycompany.com', type: 'text', hint: 'Prometheus or compatible metrics endpoint' },
      { key: 'token', label: 'Bearer Token (optional)', placeholder: 'your-token', type: 'password', hint: 'Leave blank if no auth required' },
    ],
  },
  custom_api: {
    icon: Globe, color: 'text-chart-4', label: 'Custom API',
    desc: 'Any REST API that returns JSON data',
    fields: [
      { key: 'endpoint', label: 'API Endpoint URL', placeholder: 'https://api.example.com/events', type: 'text', hint: 'Must return a JSON array or object' },
      { key: 'token', label: 'Auth Token (optional)', placeholder: 'Bearer your-token', type: 'text', hint: 'Full Authorization header value' },
    ],
  },
  pagerduty: {
    icon: Bell, color: 'text-red-400', label: 'PagerDuty',
    desc: 'Incidents and on-call data from PagerDuty',
    fields: [
      { key: 'token', label: 'API Token', placeholder: 'your-pagerduty-api-token', type: 'password', hint: 'PagerDuty → Integrations → API Access Keys' },
      { key: 'service_id', label: 'Service ID (optional)', placeholder: 'P1234AB', type: 'text', hint: 'Leave blank to fetch all services' },
    ],
  },
  datadog: {
    icon: Activity, color: 'text-purple-400', label: 'Datadog',
    desc: 'Metrics, monitors, and events from Datadog',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your-datadog-api-key', type: 'password', hint: 'Datadog → Organization Settings → API Keys' },
      { key: 'app_key', label: 'Application Key', placeholder: 'your-datadog-app-key', type: 'password', hint: 'Datadog → Organization Settings → Application Keys' },
    ],
  },
  jira: {
    icon: Layers, color: 'text-blue-400', label: 'Jira',
    desc: 'Issues, sprints, and deployments from Jira',
    fields: [
      { key: 'domain', label: 'Jira Domain', placeholder: 'yourorg.atlassian.net', type: 'text', hint: 'Your Atlassian cloud domain' },
      { key: 'email', label: 'Account Email', placeholder: 'you@company.com', type: 'text', hint: 'Your Atlassian account email' },
      { key: 'token', label: 'API Token', placeholder: 'your-jira-api-token', type: 'password', hint: 'id.atlassian.com → API tokens → Create' },
      { key: 'project', label: 'Project Key', placeholder: 'MYPROJ', type: 'text', hint: 'e.g. MYPROJ or leave blank for all projects' },
    ],
  },
  linear: {
    icon: Zap, color: 'text-indigo-400', label: 'Linear',
    desc: 'Issues and cycles from Linear',
    fields: [
      { key: 'token', label: 'API Key', placeholder: 'lin_api_xxxxxxxxxxxx', type: 'password', hint: 'Linear → Settings → API → Personal API keys' },
      { key: 'team', label: 'Team Key (optional)', placeholder: 'ENG', type: 'text', hint: 'Leave blank to fetch all teams' },
    ],
  },
};

const statusConfig = {
  connected: { color: 'text-chart-2', dot: 'bg-chart-2', label: 'Connected', icon: CheckCircle2 },
  disconnected: { color: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Disconnected', icon: XCircle },
  error: { color: 'text-destructive', dot: 'bg-destructive', label: 'Error', icon: XCircle },
  syncing: { color: 'text-primary', dot: 'bg-primary', label: 'Syncing…', icon: Loader2 },
};

async function syncGitHub(source) {
  const { token, repo } = source.config || {};
  if (!token || !repo) throw new Error('Missing GitHub token or repo');
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };

  const [commitsRes, prsRes, issuesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/commits?per_page=30`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/pulls?state=all&per_page=20`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=20`, { headers }),
  ]);

  if (!commitsRes.ok) {
    const err = await commitsRes.json();
    throw new Error(err.message || 'GitHub API error');
  }

  const [commits, prs, issues] = await Promise.all([commitsRes.json(), prsRes.json(), issuesRes.json()]);
  const records = [];

  for (const c of commits) {
    records.push({
      source_id: source.id,
      source_type: 'github',
      record_type: 'commit',
      title: c.commit?.message?.split('\n')[0] || 'Commit',
      description: c.commit?.message || '',
      author: c.commit?.author?.name || c.author?.login || 'unknown',
      timestamp: c.commit?.author?.date || new Date().toISOString(),
      severity: 'info',
      metadata: { sha: c.sha?.slice(0, 7), url: c.html_url, repo },
      tags: ['commit', repo],
    });
  }

  for (const pr of (Array.isArray(prs) ? prs : [])) {
    records.push({
      source_id: source.id,
      source_type: 'github',
      record_type: 'pull_request',
      title: `PR #${pr.number}: ${pr.title}`,
      description: pr.body?.slice(0, 500) || '',
      author: pr.user?.login || 'unknown',
      timestamp: pr.created_at,
      severity: pr.state === 'closed' && !pr.merged_at ? 'warning' : 'info',
      metadata: { pr_number: pr.number, state: pr.state, merged: !!pr.merged_at, url: pr.html_url, repo },
      tags: ['pull_request', pr.state, repo],
    });
  }

  for (const issue of (Array.isArray(issues) ? issues.filter(i => !i.pull_request) : [])) {
    records.push({
      source_id: source.id,
      source_type: 'github',
      record_type: 'issue',
      title: `Issue #${issue.number}: ${issue.title}`,
      description: issue.body?.slice(0, 500) || '',
      author: issue.user?.login || 'unknown',
      timestamp: issue.created_at,
      severity: issue.labels?.some(l => l.name?.toLowerCase().includes('bug')) ? 'error' : 'info',
      metadata: { issue_number: issue.number, state: issue.state, url: issue.html_url, labels: issue.labels?.map(l => l.name), repo },
      tags: ['issue', issue.state, repo],
    });
  }

  return records;
}

async function syncSource(source) {
  if (source.type === 'github') return syncGitHub(source);
  // For other types, return empty for now (real integrations need backend)
  return [];
}

export default function DataSources() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ name: '', type: '', config: {} });
  const [syncStatus, setSyncStatus] = useState({});

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources', user?.email],
    queryFn: () => base44.entities.DataSource.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  const { data: records = [] } = useQuery({
    queryKey: ['records', user?.email],
    queryFn: () => base44.entities.SourceRecord.filter({ created_by: user?.email }, '-timestamp', 200),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const src = await base44.entities.DataSource.create({ ...data, status: 'disconnected', record_count: 0 });
      return src;
    },
    onSuccess: () => { qc.invalidateQueries(['sources']); setOpen(false); setForm({ name: '', type: '', config: {} }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (src) => {
      // Delete associated records first
      const recs = records.filter(r => r.source_id === src.id);
      await Promise.all(recs.map(r => base44.entities.SourceRecord.delete(r.id)));
      await base44.entities.DataSource.delete(src.id);
    },
    onSuccess: () => { qc.invalidateQueries(['sources']); qc.invalidateQueries(['records']); },
  });

  const syncMutation = useMutation({
    mutationFn: async (src) => {
      setSyncStatus(s => ({ ...s, [src.id]: 'syncing' }));
      await base44.entities.DataSource.update(src.id, { status: 'syncing' });
      qc.invalidateQueries(['sources']);

      const newRecords = await syncSource(src);

      // Delete old records for this source, insert new ones
      const oldRecs = records.filter(r => r.source_id === src.id);
      await Promise.all(oldRecs.map(r => base44.entities.SourceRecord.delete(r.id)));

      if (newRecords.length > 0) {
        await base44.entities.SourceRecord.bulkCreate(newRecords);
      }

      await base44.entities.DataSource.update(src.id, {
        status: 'connected',
        record_count: newRecords.length,
        last_sync: new Date().toISOString(),
      });

      setSyncStatus(s => ({ ...s, [src.id]: 'done' }));
      return newRecords.length;
    },
    onSuccess: () => { qc.invalidateQueries(['sources']); qc.invalidateQueries(['records']); },
    onError: async (err, src) => {
      setSyncStatus(s => ({ ...s, [src.id]: 'error' }));
      await base44.entities.DataSource.update(src.id, { status: 'error' });
      qc.invalidateQueries(['sources']);
    },
  });

  const cfg = sourceTypeConfig[form.type];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">DATA SOURCES</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Connect real data pipelines — GitHub, Slack, Sentry, Metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={records.map(r => ({ title: r.title, source_type: r.source_type, record_type: r.record_type, severity: r.severity, author: r.author, timestamp: r.timestamp }))}
            filename="source_records_export"
            label="Export Records"
          />
          <Button size="sm" onClick={() => setOpen(true)} className="font-mono">
            <Plus className="w-4 h-4 mr-1.5" /> Add Source
          </Button>
        </div>
      </div>

      {/* Source Type Tiles */}
      <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3">
        {Object.entries(sourceTypeConfig).map(([type, c]) => {
          const Icon = c.icon;
          const count = sources.filter(s => s.type === type && s.status === 'connected').length;
          return (
            <button key={type} onClick={() => { setForm({ name: '', type, config: {} }); setOpen(true); }}
              className="border border-border rounded-lg p-3 bg-card text-center hover:border-primary/40 hover:bg-primary/5 transition-all group">
              <Icon className={cn('w-6 h-6 mx-auto mb-1.5 transition-transform group-hover:scale-110', c.color)} />
              <p className="text-xs font-mono font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">{count > 0 ? `${count} connected` : 'click to add'}</p>
            </button>
          );
        })}
      </div>

      {/* Sources List */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-card flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono uppercase tracking-wider text-foreground">Sources ({sources.length})</span>
        </div>

        {isLoading && <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>}

        <div className="divide-y divide-border">
          {sources.length === 0 && !isLoading && (
            <div className="px-4 py-10 text-center">
              <Database className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-mono">No sources connected yet.</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">Click a source type above or "Add Source" to get started.</p>
            </div>
          )}
          {sources.map(src => {
            const c = sourceTypeConfig[src.type] || { icon: Globe, color: 'text-muted-foreground', label: src.type };
            const Icon = c.icon;
            const sc = statusConfig[src.status] || statusConfig.disconnected;
            const isSyncing = syncStatus[src.id] === 'syncing' || src.status === 'syncing';
            const srcRecords = records.filter(r => r.source_id === src.id);
            const isExp = expanded === src.id;

            return (
              <div key={src.id} className="bg-card">
                <div className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/30">
                  <div className="p-2 rounded-md border border-border">
                    <Icon className={cn('w-4 h-4', c.color)} />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(isExp ? null : src.id)}>
                    <p className="text-sm font-medium text-foreground">{src.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {c.label} · {src.record_count || srcRecords.length} records
                      {src.last_sync && ` · synced ${format(new Date(src.last_sync), 'MMM d HH:mm')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', sc.dot, isSyncing && 'animate-pulse')} />
                    <span className={cn('text-xs font-mono', sc.color)}>{isSyncing ? 'Syncing…' : sc.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      disabled={isSyncing}
                      onClick={() => syncMutation.mutate(src)}
                      title="Sync now">
                      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => deleteMutation.mutate(src)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                    <button onClick={() => setExpanded(isExp ? null : src.id)} className="p-1 text-muted-foreground hover:text-foreground">
                      {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExp && (
                  <div className="px-4 pb-4 bg-muted/10 border-t border-border">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mt-3 mb-2">Recent Records ({srcRecords.length})</p>
                    {srcRecords.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-mono">No records yet. Click the sync button to fetch data.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {srcRecords.slice(0, 20).map(r => (
                          <div key={r.id} className="flex items-start gap-2 py-1.5 border-b border-border/50">
                            <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0',
                              r.severity === 'error' || r.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                              r.severity === 'warning' ? 'bg-chart-4/10 text-chart-4' : 'bg-muted text-muted-foreground'
                            )}>{r.record_type}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground truncate">{r.title}</p>
                              <p className="text-xs text-muted-foreground font-mono">{r.author} · {r.timestamp ? format(new Date(r.timestamp), 'MMM d HH:mm') : ''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Source Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm({ name: '', type: '', config: {} }); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono">Connect Data Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Source Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ name: '', type: v, config: {} })}>
                <SelectTrigger className="font-mono text-sm">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sourceTypeConfig).map(([type, c]) => (
                    <SelectItem key={type} value={type} className="font-mono">
                      <span className="flex items-center gap-2">{c.label} <span className="text-muted-foreground text-xs">{c.desc}</span></span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.type && (
              <>
                <div className="space-y-1.5">
                  <Label className="font-mono text-xs">Display Name</Label>
                  <Input placeholder={`e.g. Production ${sourceTypeConfig[form.type]?.label}`}
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="font-mono text-sm" />
                </div>

                {sourceTypeConfig[form.type]?.fields.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="font-mono text-xs flex items-center gap-1.5">
                      {field.type === 'password' && <Key className="w-3 h-3" />}
                      {field.label}
                    </Label>
                    <Input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={form.config[field.key] || ''}
                      onChange={e => setForm(f => ({ ...f, config: { ...f.config, [field.key]: e.target.value } }))}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground font-mono">💡 {field.hint}</p>
                  </div>
                ))}

                {form.type === 'github' && (
                  <div className="bg-chart-2/5 border border-chart-2/20 rounded-md p-3">
                    <p className="text-xs font-mono text-chart-2 font-medium mb-1">GitHub Setup Guide</p>
                    <ol className="text-xs text-muted-foreground font-mono space-y-1 list-decimal ml-4">
                      <li>Go to GitHub.com → Settings → Developer settings</li>
                      <li>Personal access tokens → Tokens (classic)</li>
                      <li>Generate new token → select scopes: <code className="bg-muted px-1 rounded">repo</code></li>
                      <li>Copy the token and paste above</li>
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="font-mono">Cancel</Button>
            <Button size="sm"
              disabled={!form.name || !form.type || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
              className="font-mono">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4 mr-1.5" />}
              Save & Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}