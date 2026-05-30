import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { MessageSquare, ThumbsUp, CheckCircle, Plus, ChevronDown, ChevronUp, Tag, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function CommunityPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [openPost, setOpenPost] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [form, setForm] = useState({ title: '', body: '', type: 'question', tags: '' });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['community_posts'],
    queryFn: () => base44.entities.CommunityPost.list('-created_date', 50),
  });

  const { data: answers = [] } = useQuery({
    queryKey: ['community_answers'],
    queryFn: () => base44.entities.CommunityAnswer.list('-created_date', 200),
  });

  const createPost = useMutation({
    mutationFn: data => base44.entities.CommunityPost.create({
      ...data,
      tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      author_email: user.email,
      author_name: user.full_name || user.email,
      upvotes: 0,
      answer_count: 0,
    }),
    onSuccess: () => { qc.invalidateQueries(['community_posts']); setOpenPost(false); setForm({ title: '', body: '', type: 'question', tags: '' }); },
  });

  const createAnswer = useMutation({
    mutationFn: ({ post_id, body }) => base44.entities.CommunityAnswer.create({
      post_id,
      body,
      author_email: user.email,
      author_name: user.full_name || user.email,
      upvotes: 0,
      is_accepted: false,
    }),
    onSuccess: async (_, vars) => {
      const post = posts.find(p => p.id === vars.post_id);
      if (post) await base44.entities.CommunityPost.update(vars.post_id, { answer_count: (post.answer_count || 0) + 1 });
      qc.invalidateQueries(['community_posts']);
      qc.invalidateQueries(['community_answers']);
      setAnswerText('');
    },
  });

  const upvotePost = useMutation({
    mutationFn: post => base44.entities.CommunityPost.update(post.id, { upvotes: (post.upvotes || 0) + 1 }),
    onSuccess: () => qc.invalidateQueries(['community_posts']),
  });

  const upvoteAnswer = useMutation({
    mutationFn: ans => base44.entities.CommunityAnswer.update(ans.id, { upvotes: (ans.upvotes || 0) + 1 }),
    onSuccess: () => qc.invalidateQueries(['community_answers']),
  });

  const acceptAnswer = useMutation({
    mutationFn: ({ ans, post }) => Promise.all([
      base44.entities.CommunityAnswer.update(ans.id, { is_accepted: true }),
      base44.entities.CommunityPost.update(post.id, { is_answered: true }),
    ]),
    onSuccess: () => { qc.invalidateQueries(['community_posts']); qc.invalidateQueries(['community_answers']); },
  });

  const filtered = posts.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.body.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'unanswered' && !p.is_answered) || (filter === 'answered' && p.is_answered) || p.type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">COMMUNITY</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{posts.length} posts · Ask questions, share knowledge</p>
        </div>
        <Button size="sm" onClick={() => setOpenPost(true)} className="font-mono">
          <Plus className="w-4 h-4 mr-1.5" /> New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search posts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm font-mono" />
        </div>
        {['all', 'question', 'discussion', 'unanswered', 'answered'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('text-xs font-mono px-3 py-1.5 rounded-md border transition-colors',
              filter === f ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
            {f}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {isLoading && <div className="text-center py-8 text-muted-foreground text-sm font-mono">Loading...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="border border-border rounded-lg py-12 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-mono text-muted-foreground">No posts yet. Be the first to ask!</p>
          </div>
        )}
        {filtered.map(post => {
          const postAnswers = answers.filter(a => a.post_id === post.id);
          const isExpanded = expandedId === post.id;
          return (
            <div key={post.id} className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Upvote */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button onClick={() => upvotePost.mutate(post)} className="text-muted-foreground hover:text-primary transition-colors">
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono text-foreground">{post.upvotes || 0}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border',
                          post.type === 'question' ? 'text-accent border-accent/30 bg-accent/5' : 'text-primary border-primary/30 bg-primary/5')}>
                          {post.type}
                        </span>
                        {post.is_answered && (
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded border text-chart-2 border-chart-2/30 bg-chart-2/5 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> answered
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{format(new Date(post.created_date), 'MMM d')}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mt-1.5 leading-snug">{post.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{post.body}</p>
                    {post.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.tags.map(t => (
                          <span key={t} className="text-xs font-mono px-1.5 py-0.5 bg-secondary text-muted-foreground rounded flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />{t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground font-mono">{post.author_name || post.author_email}</span>
                      <button onClick={() => setExpandedId(isExpanded ? null : post.id)}
                        className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {postAnswers.length} {postAnswers.length === 1 ? 'answer' : 'answers'}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Answers */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/20">
                  {postAnswers.map(ans => (
                    <div key={ans.id} className={cn('p-4 border-b border-border/50 flex gap-3', ans.is_accepted && 'bg-chart-2/5')}>
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <button onClick={() => upvoteAnswer.mutate(ans)} className="text-muted-foreground hover:text-primary transition-colors">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono">{ans.upvotes || 0}</span>
                      </div>
                      <div className="flex-1">
                        {ans.is_accepted && (
                          <div className="flex items-center gap-1 text-chart-2 text-xs font-mono mb-1">
                            <CheckCircle className="w-3 h-3" /> Accepted Answer
                          </div>
                        )}
                        <p className="text-xs text-foreground leading-relaxed">{ans.body}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground font-mono">{ans.author_name || ans.author_email} · {format(new Date(ans.created_date), 'MMM d')}</span>
                          {!ans.is_accepted && post.author_email === user?.email && (
                            <button onClick={() => acceptAnswer.mutate({ ans, post })}
                              className="text-xs font-mono text-chart-2 hover:underline flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Accept
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Answer form */}
                  <div className="p-4 space-y-2">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Your Answer</p>
                    <Textarea
                      placeholder="Write a helpful answer..."
                      value={answerText}
                      onChange={e => setAnswerText(e.target.value)}
                      className="text-sm font-mono min-h-[80px]"
                    />
                    <Button size="sm" className="font-mono"
                      disabled={!answerText.trim() || createAnswer.isPending}
                      onClick={() => createAnswer.mutate({ post_id: post.id, body: answerText })}>
                      Post Answer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Post Dialog */}
      <Dialog open={openPost} onOpenChange={setOpenPost}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">New Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="font-mono text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="font-mono text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="question" className="font-mono">Question</SelectItem>
                  <SelectItem value="discussion" className="font-mono">Discussion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-mono text-xs">Title</Label>
              <Input placeholder="What's your question?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="font-mono text-sm mt-1" />
            </div>
            <div>
              <Label className="font-mono text-xs">Details</Label>
              <Textarea placeholder="Provide details, context, or what you've tried..." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className="font-mono text-sm mt-1 min-h-[100px]" />
            </div>
            <div>
              <Label className="font-mono text-xs">Tags (comma-separated)</Label>
              <Input placeholder="e.g. github, incidents, query" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="font-mono text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpenPost(false)} className="font-mono">Cancel</Button>
            <Button size="sm" disabled={!form.title || !form.body || createPost.isPending} onClick={() => createPost.mutate(form)} className="font-mono">
              Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}