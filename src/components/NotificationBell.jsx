import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Bell, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const typeColors = {
  incident: 'text-destructive',
  insight: 'text-accent',
  data_update: 'text-primary',
  mention: 'text-chart-4',
  system: 'text-muted-foreground',
};

export default function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_email: user?.email }, '-created_date', 30),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unread = notifications.filter(n => !n.is_read);

  const markRead = useMutation({
    mutationFn: id => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => qc.invalidateQueries(['notifications', user?.email]),
  });

  const markAllRead = useMutation({
    mutationFn: () => Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true }))),
    onSuccess: () => qc.invalidateQueries(['notifications', user?.email]),
  });

  const dismiss = useMutation({
    mutationFn: id => base44.entities.Notification.delete(id),
    onSuccess: () => qc.invalidateQueries(['notifications', user?.email]),
  });

  const handleClick = (n) => {
    markRead.mutate(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
          <Bell className="w-4 h-4 text-sidebar-foreground" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full text-xs text-white font-mono flex items-center justify-center leading-none">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-xs font-mono font-semibold text-foreground">Notifications</span>
          {unread.length > 0 && (
            <button onClick={() => markAllRead.mutate()} className="text-xs text-primary font-mono hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground font-mono">No notifications yet</div>
          )}
          {notifications.map(n => (
            <div key={n.id} className={cn('flex items-start gap-2 px-3 py-2.5 hover:bg-muted/30 cursor-pointer group transition-colors', !n.is_read && 'bg-primary/5')}>
              <div className="flex-1 min-w-0" onClick={() => handleClick(n)}>
                <div className="flex items-center gap-1.5">
                  {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                  <p className={cn('text-xs font-mono font-medium truncate', typeColors[n.type] || 'text-foreground')}>{n.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{format(new Date(n.created_date), 'MMM d HH:mm')}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); dismiss.mutate(n.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        {notifications.length > 0 && (
          <div className="px-3 py-2 border-t border-border">
            <button onClick={() => { setOpen(false); }} className="text-xs text-muted-foreground font-mono hover:text-foreground">
              {notifications.length} total notifications
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}