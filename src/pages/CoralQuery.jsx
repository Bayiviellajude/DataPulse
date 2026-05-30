import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Play, Sparkles, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const EXAMPLE_QUERIES = [
  {
    name: 'All recent commits',
    sql: `SELECT title, author, timestamp, metadata->>'sha' as sha
FROM source_records
WHERE source_type = 'github' AND record_type = 'commit'
ORDER BY timestamp DESC
LIMIT 20`,
  },
  {
    name: 'Open PRs',
    sql: `SELECT title, author, timestamp
FROM source_records
WHERE source_type = 'github' AND record_type = 'pull_request'
  AND metadata->>'state' = 'open'
ORDER BY timestamp DESC`,
  },
  {
    name: 'Error events only',
    sql: `SELECT source_type, record_type, title, author, timestamp
FROM source_records
WHERE severity IN ('error', 'critical', 'warning')
ORDER BY timestamp DESC
LIMIT 30`,
  },
  {
    name: 'Activity by author',
    sql: `SELECT author, COUNT(*) as events, source_type
FROM source_records
GROUP BY author, source_type
ORDER BY events DESC`,
  },
  {
    name: 'Issues summary',
    sql: `SELECT title, author, severity, timestamp, metadata->>'state' as state
FROM source_records
WHERE record_type = 'issue'
ORDER BY timestamp DESC`,
  },
];

const statusIcon = { draft: null, running: Loader2, completed: CheckCircle2, error: AlertCircle };
const statusColor = { draft: 'text-muted-foreground', running: 'text-primary', completed: 'text-chart-2', error: 'text-destructive' };

export default function CoralQueryPage() {
  const qc = useQueryClient();
  const [sql, setSql] = useState(EXAMPLE_QUERIES[0].sql);
  const [name, setName] = useState('');
  const [activeQuery, setActiveQuery] = useState(null);
  const [nlPrompt, setNlPrompt] = useState('');

  const { data: queries = [] } = useQuery({
    queryKey: ['queries'],
    queryFn: () => base44.entities.CoralQuery.list('-created_date', 20),
  });

  const { data: records = [] } = useQuery({
    queryKey: ['records'],
    queryFn: () => base44.entities.SourceRecord.list('-timestamp', 500),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const q = await base44.entities.CoralQuery.create({
        name: name || 'Untitled Query',
        sql,
        status: 'running',
        ai_generated: false,
        sources_used: [],
      });

      const startTime = Date.now();

      // Ask AI to execute query against actual records data
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a SQL query engine. Execute this SQL query against the following real dataset and return matching rows.

SQL Query:
${sql}

Available data (source_records table, ${records.length} total records):
${JSON.stringify(records.slice(0, 100).map(r => ({
  id: r.id,
  source_type: r.source_type,
  record_type: r.record_type,
  title: r.title,
  author: r.author,
  timestamp: r.timestamp,
  severity: r.severity,
  tags: r.tags,
  metadata: r.metadata,
})))}

Return ONLY matching rows based on the query's WHERE/GROUP/ORDER/LIMIT clauses. Be precise and accurate. Return up to 50 rows.`,
        response_json_schema: {
          type: 'object',
          properties: {
            rows: { type: 'array', items: { type: 'object' } },
            summary: { type: 'string' },
          },
        },
      });

      const ms = Date.now() - startTime;
      const updated = await base44.entities.CoralQuery.update(q.id, {
        status: 'completed',
        result_data: result.rows || [],
        result_count: result.rows?.length || 0,
        execution_time_ms: ms,
      });
      return { ...updated, summary: result.summary };
    },
    onSuccess: (q) => { setActiveQuery(q); qc.invalidateQueries(['queries']); },
    onError: () => qc.invalidateQueries(['queries']),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a SQL query for the following request against a table called "source_records" with columns: id, source_type (github/slack/sentry/metrics/custom_api), record_type (commit/pull_request/issue/message/error/metric_point), title, description, author, timestamp, severity (info/warning/error/critical), tags (array), metadata (json object).

Request: "${nlPrompt}"

Return ONLY the SQL string, no explanation, no markdown fences.`,
      });
      return typeof result === 'string' ? result : result?.sql || result?.query || String(result);
    },
    onSuccess: (generatedSql) => {
      setSql(generatedSql.trim());
      setName(nlPrompt);
      setNlPrompt('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.CoralQuery.delete(id),
    onSuccess: () => qc.invalidateQueries(['queries']),
  });

  const resultCols = activeQuery?.result_data?.[0] ? Object.keys(activeQuery.result_data[0]) : [];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">CORAL QUERY ENGINE</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          SQL across all connected sources · {records.length} records available
        </p>
      </div>

      {records.length === 0 && (
        <div className="border border-chart-4/30 bg-chart-4/5 rounded-lg px-4 py-3 text-xs font-mono text-chart-4">
          ⚠ No records yet. Go to <strong>Data Sources</strong> and click the sync button on a connected source first.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Query Editor */}
        <div className="lg:col-span-3 space-y-3">
          {/* AI Prompt */}
          <div className="border border-accent/30 rounded-lg p-3 bg-accent/5">
            <p className="text-xs font-mono text-accent mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> GENERATE WITH AI
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. show all commits from last 7 days by author"
                value={nlPrompt}
                onChange={e => setNlPrompt(e.target.value)}
                className="font-mono text-xs h-8 flex-1"
                onKeyDown={e => e.key === 'Enter' && nlPrompt && generateMutation.mutate()}
              />
              <Button size="sm" variant="outline" className="h-8 font-mono text-xs border-accent/30 text-accent"
                disabled={!nlPrompt || generateMutation.isPending}
                onClick={() => generateMutation.mutate()}>
                {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Generate'}
              </Button>
            </div>
          </div>

          {/* SQL Editor */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
              <span className="text-xs font-mono text-muted-foreground">coral.sql</span>
              <Input
                placeholder="Query name..."
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-6 text-xs font-mono w-48 border-0 bg-transparent text-right p-0 focus-visible:ring-0"
              />
            </div>
            <textarea
              value={sql}
              onChange={e => setSql(e.target.value)}
              className="w-full h-48 p-4 bg-muted/30 font-mono text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => runMutation.mutate()} disabled={!sql || runMutation.isPending} className="font-mono">
              {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
              Run Query
            </Button>
            {activeQuery && (
              <span className="text-xs font-mono text-muted-foreground">
                {activeQuery.result_count} rows · {activeQuery.execution_time_ms}ms
              </span>
            )}
            {activeQuery?.summary && (
              <span className="text-xs font-mono text-muted-foreground">· {activeQuery.summary}</span>
            )}
          </div>

          {/* Results */}
          {activeQuery?.result_data && activeQuery.result_data.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-chart-2" />
                <span className="text-xs font-mono text-foreground">{activeQuery.result_count} results</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {resultCols.map(col => (
                        <th key={col} className="text-left px-3 py-2 text-muted-foreground uppercase tracking-wider whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeQuery.result_data.map((row, i) => (
                      <tr key={i} className="hover:bg-secondary/30">
                        {resultCols.map(col => (
                          <td key={col} className="px-3 py-2 text-foreground max-w-xs truncate">
                            {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeQuery?.result_data?.length === 0 && (
            <div className="border border-border rounded-lg px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground font-mono">No results matched the query.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border bg-card">
              <span className="text-xs font-mono uppercase tracking-wider text-foreground">Examples</span>
            </div>
            <div className="divide-y divide-border">
              {EXAMPLE_QUERIES.map((q, i) => (
                <button key={i} onClick={() => { setSql(q.sql); setName(q.name); }}
                  className="w-full text-left px-3 py-2.5 bg-card hover:bg-secondary/50 transition-colors">
                  <p className="text-xs font-mono text-primary">{q.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border bg-card">
              <span className="text-xs font-mono uppercase tracking-wider text-foreground">History ({queries.length})</span>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {queries.length === 0 && <p className="text-xs text-muted-foreground font-mono px-3 py-3">No queries yet</p>}
              {queries.map(q => {
                const StatusIcon = statusIcon[q.status];
                return (
                  <div key={q.id} className="flex items-start gap-2 px-3 py-2.5 bg-card hover:bg-secondary/30 cursor-pointer"
                    onClick={() => setActiveQuery(q)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{q.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{q.result_count || 0} rows</p>
                    </div>
                    {StatusIcon && <StatusIcon className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', statusColor[q.status], q.status === 'running' && 'animate-spin')} />}
                    <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(q.id); }}
                      className="p-0.5 hover:text-destructive text-muted-foreground">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Schema reference */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border bg-card">
              <span className="text-xs font-mono uppercase tracking-wider text-foreground">Table: source_records</span>
            </div>
            <div className="px-3 py-2 space-y-1">
              {['source_type', 'record_type', 'title', 'author', 'timestamp', 'severity', 'tags', 'metadata'].map(col => (
                <p key={col} className="text-xs font-mono text-muted-foreground">{col}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}