import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { User, Mail, Shield, LogOut, Save, Database, AlertTriangle, Lightbulb, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: user?.full_name || '' });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents_me'],
    queryFn: () => base44.entities.Incident.filter({ created_by: user?.email }, '-detected_at', 5),
    enabled: !!user,
  });
  const { data: records = [] } = useQuery({
    queryKey: ['records_me'],
    queryFn: () => base44.entities.SourceRecord.filter({ created_by: user?.email }, '-timestamp', 5),
    enabled: !!user,
  });
  const { data: sources = [] } = useQuery({
    queryKey: ['sources_me'],
    queryFn: () => base44.entities.DataSource.filter({ created_by: user?.email }),
    enabled: !!user,
  });
  const { data: insights = [] } = useQuery({
    queryKey: ['insights_me'],
    queryFn: () => base44.entities.AgentInsight.filter({ created_by: user?.email }, '-created_date', 50),
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: () => base44.auth.updateMe(form),
    onSuccess: () => setEditing(false),
  });

  if (!user) return null;

  const stats = [
    { label: 'Data Sources', value: sources.length, icon: Database, color: 'text-primary' },
    { label: 'Incidents', value: incidents.length, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'AI Insights', value: insights.length, icon: Lightbulb, color: 'text-accent' },
    { label: 'Events Tracked', value: records.length, icon: Activity, color: 'text-chart-2' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">PROFILE</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">Manage your account details</p>
      </div>

      {/* Avatar + Info */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-primary font-mono">
            {(user.full_name || user.email).charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-semibold text-foreground font-mono">{user.full_name || 'No name set'}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Mail className="w-3.5 h-3.5" />
            {user.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Shield className="w-3.5 h-3.5" />
            {user.role || 'user'}
          </div>
          {user.created_date && (
            <p className="text-xs text-muted-foreground font-mono">
              Member since {format(new Date(user.created_date), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="font-mono flex-shrink-0" onClick={() => setEditing(!editing)}>
          Edit
        </Button>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-mono font-semibold text-foreground">Edit Profile</p>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Display Name</Label>
            <Input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="font-mono text-sm"
              placeholder="Your name"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="font-mono">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="font-mono">Cancel</Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Ico, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${color}`}>
              <Ico className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">{label}</p>
              <p className="text-xl font-bold font-mono text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      {records.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-mono font-semibold text-foreground">Recent Events</p>
          <div className="space-y-2">
            {records.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-start gap-2 text-xs font-mono">
                <span className="text-muted-foreground flex-shrink-0 mt-0.5">{r.source_type}</span>
                <span className="text-foreground flex-1 truncate">{r.title}</span>
                {r.timestamp && <span className="text-muted-foreground flex-shrink-0">{format(new Date(r.timestamp), 'MMM d')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-5">
        <p className="text-sm font-mono font-semibold text-foreground mb-1">Sign Out</p>
        <p className="text-xs text-muted-foreground font-mono mb-3">End your current session and return to the login screen.</p>
        <Button variant="destructive" size="sm" className="font-mono" onClick={() => logout()}>
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}