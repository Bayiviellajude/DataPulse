import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot, Plus, Send, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import MessageBubble from '@/components/agent/MessageBubble';
import { format } from 'date-fns';

export default function AgentPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    const unsub = base44.agents.subscribeToConversation(activeConv.id, data => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [activeConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    setLoadingConvs(true);
    const convs = await base44.agents.listConversations({ agent_name: 'datapulse_agent' });
    // Filter out soft-deleted conversations
    setConversations((convs || []).filter(c => !c.metadata?.deleted));
    setLoadingConvs(false);
  };

  const newConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: 'datapulse_agent',
      metadata: { name: `Session ${new Date().toLocaleTimeString()}` },
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConv(conv);
    setMessages([]);
  };

  const selectConversation = async (conv) => {
    setActiveConv(conv);
    const full = await base44.agents.getConversation(conv.id);
    setMessages(full.messages || []);
  };

  const deleteConversation = async (e, conv) => {
    e.stopPropagation();
    // Optimistically remove from UI immediately
    setConversations(prev => prev.filter(c => c.id !== conv.id));
    if (activeConv?.id === conv.id) {
      setActiveConv(null);
      setMessages([]);
    }
    try {
      await base44.agents.deleteConversation(conv.id);
    } catch {
      // deleteConversation not available — silently ignore, UI already updated
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    // Optimistically add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    await base44.agents.addMessage(activeConv, { role: 'user', content: text });
    setSending(false);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-foreground">Sessions</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={newConversation}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvs && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>}
          {conversations.length === 0 && !loadingConvs && (
            <p className="text-xs text-muted-foreground font-mono px-3 py-4 text-center">No sessions yet</p>
          )}
          {conversations.filter(c => !c.metadata?.deleted).map(conv => (
            <button key={conv.id} onClick={() => selectConversation(conv)}
              className={cn('w-full text-left px-3 py-2.5 border-b border-border hover:bg-secondary/50 transition-colors group',
                activeConv?.id === conv.id && 'bg-primary/10')}>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-foreground truncate flex-1">{conv.metadata?.name || 'Session'}</p>
                <button
                  onClick={(e) => deleteConversation(e, conv)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-destructive"
                  title="Delete session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {format(new Date(conv.created_date), 'MMM d HH:mm')}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-12 border-b border-border px-4 flex items-center gap-3 bg-card">
          <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">DataPulse Agent</p>
            <p className="text-xs text-muted-foreground font-mono">Cross-source correlation AI</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeConv && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Bot className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">DataPulse Intelligence Agent</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Ask me to analyze correlations, explain incidents, generate Coral SQL queries, or surface insights from your connected data.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 max-w-sm w-full">
                {[
                  'Show me errors that happened after the last deploy',
                  'What caused the incident spike last hour?',
                  'Generate a query to find slow API calls',
                ].map(prompt => (
                  <button key={prompt}
                    onClick={async () => { await newConversation(); }}
                    className="text-left text-xs text-muted-foreground border border-border rounded-md px-3 py-2 hover:bg-secondary/50 hover:text-foreground transition-colors font-mono">
                    "{prompt}"
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={newConversation} className="font-mono">
                <Plus className="w-4 h-4 mr-1.5" /> New Session
              </Button>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {activeConv && (
          <div className="border-t border-border p-3 bg-card">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about correlations, incidents, or request a query…"
                className="font-mono text-sm"
                disabled={sending}
              />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim() || sending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}