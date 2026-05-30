import { cn } from '@/lib/utils';

const colorMap = {
  primary: 'text-primary border-primary/20 bg-primary/5',
  destructive: 'text-destructive border-destructive/20 bg-destructive/5',
  accent: 'text-accent border-accent/20 bg-accent/5',
  'chart-2': 'text-chart-2 border-chart-2/20 bg-chart-2/5',
};

export default function StatCard({ label, value, total, badge, icon: Icon, color = 'primary' }) {
  return (
    <div className={cn('border rounded-lg p-4 glow-subtle', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold font-mono">{value}</span>
            {total !== undefined && (
              <span className="text-sm text-muted-foreground font-mono">/ {total}</span>
            )}
          </div>
          {badge && (
            <span className="inline-block mt-1 text-xs font-mono px-1.5 py-0.5 rounded bg-current/10 opacity-80">
              {badge}
            </span>
          )}
        </div>
        <Icon className="w-5 h-5 opacity-50 mt-0.5" />
      </div>
    </div>
  );
}