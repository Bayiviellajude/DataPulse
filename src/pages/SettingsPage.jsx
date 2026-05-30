import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Webhook, Bell, Shield, Trash2, Plus, Check, X, Loader2,
  AlertTriangle, Zap, Eye, EyeOff, Copy, RefreshCw, Globe,
  Mail, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EVENT_OPTIONS = [
  { value: 'incident.created', label: 'Incident Created' },
  { value: 'incident.resolved', label: 'Incident Resolved' },
  { value: 'insight.new', label: 'New Insight Generated' },
  { value: 'record.error', label: 'Error Record Ingested' },
  { value: 'alert.triggered', label: 'Alert Rule Triggered' },
  { value: 'source.sync_failed', label: 'Source Sync Failed' },
];

const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low'];

const CONDITION_TYPES = [
  { value: 'error_rate_spike', label: 'Error Rate Spike', desc: 'Triggers when error rate exceeds threshold %' },
  { value: 'error_count_threshold', label: 'Error Count Threshold', desc: 'Triggers when error count > N in last hour' },
  { value: 'source_offline', label: 'Source Offline', desc: 'Triggers when a source fails to sync' },
  { value: 'new_critical_record', label: 'New Critical Record', desc: 'Triggers on any critical severity record' },
  { value: 'incident_created', label: 'Incident Created', desc: 'Triggers when any new incident is detected' },
  { value: 'custom_keyword', label: 'Custom Keyword Match', desc: 'Triggers when a record title matches a keyword' },
];

// --- Webhook Tab ---
function WebhooksTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showSecret, setShowSecret] = useState({});
  const [testingId, setTestingId] = useState(null);
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: [], severity_filter: [], is_active: true });

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks', user?.email],
    queryFn: () => base44.entities.WebhookConfig.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: data => base44.entities.WebhookConfig.create(data),
    onSuccess: () => { qc.invalidateQueries(['webhooks']); setOpen(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.WebhookConfig.delete(id),
    onSuccess: () => qc.invalidateQueries(['webhooks']),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.WebhookConfig.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(['webhooks']),
  });

  const testWebhook = async (webhook) => {
    setTestingId(webhook.id);
    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      source: 'DataPulse',
      data: { message: 'Test payload from DataPulse', webhook_id: webhook.id },
    };
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-DataPulse-Event': 'webhook.test' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
      await base44.entities.WebhookConfig.update(webhook.id, { last_triggered: new Date().toISOString(), last_status: 'success' });
      qc.invalidateQueries(['webhooks']);
    } catch {
      await base44.entities.WebhookConfig.update(webhook.id, { last_status: 'failed', failure_count: (webhook.failure_count || 0) + 1 });
      qc.invalidateQueries(['webhooks']);
    }
    setTestingId(null);
  };

  const resetForm = () => setForm({ name: '', url: '', secret: '', events: [], severity_filter: [], is_active: true });

  const toggleEvent = (val) => setForm(f => ({
    ...f, events: f.events.includes(val) ? f.events.filter(e => e !== val) : [...f.events, val]
  }));

  const toggleSeverity = (val) => setForm(f => ({
    ...f, severity_filter: f.severity_filter.includes(val) ? f.severity_filter.filter(s => s !== val) : [...f.severity_filter, val]
  }));

  const copyUrl = (url) => navigator.clipboard.writeText(url);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Webhooks</p>
          <p className="text-xs text-muted-foreground font-mono">Send real-time HTTP POST payloads to external endpoints when events occur.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="font-mono">
          <Plus className="w-4 h-4 mr-1.5" /> Add Webhook
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}

      {webhooks.length === 0 && !isLoading && (
        <div className="border border-dashed border-border rounded-lg py-10 text-center">
          <Webhook className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">No webhooks configured</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">Add a webhook to receive real-time event notifications.</p>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.map(wh => (
          <div key={wh.id} className="border border-border rounded-lg bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{wh.name}</p>
                  <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border',
                    wh.last_status === 'success' ? 'text-chart-2 border-chart-2/30 bg-chart-2/5' :
                    wh.last_status === 'failed' ? 'text-destructive border-destructive/30 bg-destructive/5' :
                    'text-muted-foreground border-border bg-muted/30'
                  )}>{wh.last_status || 'never fired'}</span>
                  {!wh.is_active && <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded border border-border">paused</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <code className="text-xs text-muted-foreground truncate max-w-xs">{wh.url}</code>
                  <button onClick={() => copyUrl(wh.url)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(wh.events || []).map(e => (
                    <span key={e} className="text-xs font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{e}</span>
                  ))}
                </div>
                {wh.last_triggered && (
                  <p className="text-xs text-muted-foreground font-mono mt-1.5">Last fired: {format(new Date(wh.last_triggered), 'MMM d HH:mm')}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={!!wh.is_active}
                  onCheckedChange={v => toggleMutation.mutate({ id: wh.id, is_active: v })}
                />
                <Button size="sm" variant="outline" className="h-7 text-xs font-mono"
                  disabled={testingId === wh.id}
                  onClick={() => testWebhook(wh)}>
                  {testingId === wh.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  Test
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => deleteMutation.mutate(wh.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Add Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Name</Label>
              <Input placeholder="e.g. PagerDuty Alert" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Endpoint URL</Label>
              <Input placeholder="https://hooks.example.com/..." value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Signing Secret (optional)</Label>
              <Input placeholder="Used to verify payload integrity" value={form.secret}
                onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} className="font-mono text-sm" type="password" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Trigger Events</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {EVENT_OPTIONS.map(ev => (
                  <button key={ev.value} onClick={() => toggleEvent(ev.value)}
                    className={cn('text-left text-xs font-mono px-2 py-1.5 rounded border transition-colors',
                      form.events.includes(ev.value) ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    {ev.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Severity Filter (empty = all)</Label>
              <div className="flex gap-1.5 flex-wrap">
                {SEVERITY_OPTIONS.map(s => (
                  <button key={s} onClick={() => toggleSeverity(s)}
                    className={cn('text-xs font-mono px-2 py-1 rounded border transition-colors capitalize',
                      form.severity_filter.includes(s) ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="font-mono">Cancel</Button>
            <Button size="sm" className="font-mono"
              disabled={!form.name || !form.url || form.events.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Alert Rules Tab ---
function AlertRulesTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', condition_type: 'error_count_threshold',
    threshold: 10, keyword: '', source_types: [], severity_output: 'high',
    notify_in_app: true, notify_email: false, email_recipients: '', trigger_webhooks: false, is_active: true,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['alertrules', user?.email],
    queryFn: () => base44.entities.AlertRule.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: data => base44.entities.AlertRule.create(data),
    onSuccess: () => { qc.invalidateQueries(['alertrules']); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.AlertRule.delete(id),
    onSuccess: () => qc.invalidateQueries(['alertrules']),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.AlertRule.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(['alertrules']),
  });

  const toggleSource = (s) => setForm(f => ({
    ...f, source_types: f.source_types.includes(s) ? f.source_types.filter(x => x !== s) : [...f.source_types, s]
  }));

  const sourceTypes = ['github', 'slack', 'sentry', 'metrics', 'custom_api', 'pagerduty', 'datadog', 'jira'];

  const needsThreshold = ['error_rate_spike', 'error_count_threshold'].includes(form.condition_type);
  const needsKeyword = form.condition_type === 'custom_keyword';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Alert Rules</p>
          <p className="text-xs text-muted-foreground font-mono">Automatically detect conditions and notify your team.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="font-mono">
          <Plus className="w-4 h-4 mr-1.5" /> Add Rule
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}

      {rules.length === 0 && !isLoading && (
        <div className="border border-dashed border-border rounded-lg py-10 text-center">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">No alert rules configured</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">Create rules to automatically detect anomalies.</p>
        </div>
      )}

      <div className="space-y-3">
        {rules.map(rule => {
          const ct = CONDITION_TYPES.find(c => c.value === rule.condition_type);
          return (
            <div key={rule.id} className="border border-border rounded-lg bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{rule.name}</p>
                    <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border capitalize',
                      rule.severity_output === 'critical' ? 'text-destructive border-destructive/30 bg-destructive/5' :
                      rule.severity_output === 'high' ? 'text-orange-400 border-orange-400/30 bg-orange-400/5' :
                      'text-chart-4 border-chart-4/30 bg-chart-4/5'
                    )}>{rule.severity_output}</span>
                    {!rule.is_active && <span className="text-xs font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">paused</span>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{ct?.desc}</p>
                  {rule.threshold && <p className="text-xs text-muted-foreground font-mono">Threshold: {rule.threshold}</p>}
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {rule.notify_in_app && <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">in-app</span>}
                    {rule.notify_email && <span className="text-xs font-mono text-chart-3 bg-chart-3/10 px-1.5 py-0.5 rounded">email</span>}
                    {rule.trigger_webhooks && <span className="text-xs font-mono text-chart-4 bg-chart-4/10 px-1.5 py-0.5 rounded">webhooks</span>}
                  </div>
                  {rule.last_triggered && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">Last triggered: {format(new Date(rule.last_triggered), 'MMM d HH:mm')} · {rule.trigger_count || 0}x total</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={!!rule.is_active} onCheckedChange={v => toggleMutation.mutate({ id: rule.id, is_active: v })} />
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => deleteMutation.mutate(rule.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">Create Alert Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Rule Name</Label>
              <Input placeholder="e.g. High Error Rate" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Condition</Label>
              <Select value={form.condition_type} onValueChange={v => setForm(f => ({ ...f, condition_type: v }))}>
                <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="font-mono">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground font-mono">{CONDITION_TYPES.find(c => c.value === form.condition_type)?.desc}</p>
            </div>
            {needsThreshold && (
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Threshold</Label>
                <Input type="number" value={form.threshold}
                  onChange={e => setForm(f => ({ ...f, threshold: +e.target.value }))} className="font-mono text-sm" />
              </div>
            )}
            {needsKeyword && (
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Keyword</Label>
                <Input placeholder="e.g. OutOfMemoryError" value={form.keyword}
                  onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} className="font-mono text-sm" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Severity Output</Label>
              <Select value={form.severity_output} onValueChange={v => setForm(f => ({ ...f, severity_output: v }))}>
                <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'medium', 'high', 'critical'].map(s => (
                    <SelectItem key={s} value={s} className="font-mono capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs">Notifications</Label>
              {[
                { key: 'notify_in_app', label: 'In-app notification' },
                { key: 'notify_email', label: 'Email notification' },
                { key: 'trigger_webhooks', label: 'Trigger webhooks' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">{label}</span>
                  <Switch checked={!!form[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} />
                </div>
              ))}
              {form.notify_email && (
                <Input placeholder="Comma-separated emails" value={form.email_recipients}
                  onChange={e => setForm(f => ({ ...f, email_recipients: e.target.value }))} className="font-mono text-sm" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="font-mono">Cancel</Button>
            <Button size="sm" className="font-mono"
              disabled={!form.name || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Audit Log Tab ---
function AuditLogTab() {
  const { user } = useAuth();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditlogs', user?.email],
    queryFn: () => base44.entities.AuditLog.filter({ actor_email: user?.email }, '-created_date', 50),
    enabled: !!user,
  });

  const actionColors = {
    'incident.created': 'text-destructive',
    'incident.resolved': 'text-chart-2',
    'source.synced': 'text-primary',
    'source.deleted': 'text-destructive',
    'query.executed': 'text-chart-3',
    'insight.generated': 'text-accent',
    'webhook.fired': 'text-chart-4',
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Audit Log</p>
        <p className="text-xs text-muted-foreground font-mono">Full trail of all actions taken in your workspace.</p>
      </div>
      {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
      {logs.length === 0 && !isLoading && (
        <div className="border border-dashed border-border rounded-lg py-10 text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">No audit events yet</p>
        </div>
      )}
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 bg-card hover:bg-secondary/20">
            <span className={cn('text-xs font-mono mt-0.5 flex-shrink-0', actionColors[log.action] || 'text-muted-foreground')}>
              {log.action}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">{log.entity_type} {log.entity_id}</p>
              <p className="text-xs text-muted-foreground font-mono">{log.actor_email}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded',
                log.result === 'failed' ? 'text-destructive bg-destructive/10' : 'text-chart-2 bg-chart-2/10'
              )}>{log.result}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {log.created_date ? format(new Date(log.created_date), 'MMM d HH:mm') : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Settings Page ---
export default function SettingsPage() {
  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <Settings className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">SETTINGS</h1>
          <p className="text-xs text-muted-foreground font-mono">Configure webhooks, alerts, and workspace preferences.</p>
        </div>
      </div>

      <Tabs defaultValue="webhooks">
        <TabsList className="font-mono text-xs">
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="alerts">Alert Rules</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>
        <TabsContent value="webhooks" className="mt-4">
          <WebhooksTab />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertRulesTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}