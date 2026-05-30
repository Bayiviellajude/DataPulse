import { useState } from 'react';
import { Bell, BellOff, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'datapulse-slack-webhook';

export function getSlackWebhook() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export default function SlackAlertConfig() {
  const [open, setOpen] = useState(false);
  const [webhook, setWebhook] = useState(getSlackWebhook);
  const [saved, setSaved] = useState(!!getSlackWebhook());
  const [localVal, setLocalVal] = useState(getSlackWebhook);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, localVal);
    setWebhook(localVal);
    setSaved(!!localVal);
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setWebhook('');
    setLocalVal('');
    setSaved(false);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-card hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {saved ? <Bell className="w-3.5 h-3.5 text-chart-2" /> : <BellOff className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-xs font-mono uppercase tracking-wider text-foreground">Slack Alerts</span>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-mono text-chart-2">
              <CheckCircle2 className="w-3 h-3" /> Configured
            </span>
          )}
          {!saved && <span className="text-xs font-mono text-muted-foreground">· Not configured</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-muted/10 border-t border-border space-y-3">
          <p className="text-xs text-muted-foreground font-mono">
            Paste a Slack Incoming Webhook URL to automatically send alerts whenever a <strong className="text-foreground">critical</strong> or <strong className="text-foreground">high</strong> severity incident is created.
          </p>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Slack Webhook URL</Label>
            <Input
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={localVal}
              onChange={e => setLocalVal(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground font-mono">💡 Slack App → Incoming Webhooks → Add New Webhook</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={!localVal} className="font-mono text-xs">Save</Button>
            {saved && <Button size="sm" variant="outline" onClick={clear} className="font-mono text-xs text-destructive border-destructive/30 hover:bg-destructive/10">Remove</Button>}
          </div>
        </div>
      )}
    </div>
  );
}