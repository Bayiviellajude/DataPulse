import { Lightbulb, ChevronRight, Zap, TrendingUp, AlertCircle, GitMerge } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const typeIcons = {
  anomaly: AlertCircle,
  correlation: GitMerge,
  recommendation: Lightbulb,
  alert: Zap,
  trend: TrendingUp,
};
const severityColors = {
  critical: 'text-destructive',
  warning: 'text-chart-4',
  info: 'text-primary',
};

export default function InsightsFeed({ insights }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-mono font-medium uppercase tracking-wider text-foreground">AI Insights</span>
        </div>
        <Link to="/insights" className="text-xs text-muted-foreground hover:text-primary font-mono flex items-center gap-0.5">
          all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {insights.length === 0 && (
          <p className="text-xs text-muted-foreground font-mono px-4 py-3">No insights yet</p>
        )}
        {insights.map(insight => {
          const Icon = typeIcons[insight.insight_type] || Lightbulb;
          return (
            <div key={insight.id} className={cn('px-4 py-2.5 bg-card hover:bg-secondary/50 transition-colors', !insight.is_read && 'border-l-2 border-primary')}>
              <div className="flex items-start gap-2">
                <Icon className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', severityColors[insight.severity])} />
                <p className="text-xs text-foreground leading-tight line-clamp-2">{insight.title}</p>
              </div>
              {insight.confidence && (
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {insight.confidence}% confidence
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}