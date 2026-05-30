import { useState, useEffect } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStoredTheme, setStoredTheme, applyTheme } from '@/lib/theme';

const options = [
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'auto', icon: Monitor, label: 'Auto' },
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);
  }, [theme]);

  // Listen for system preference changes when in auto mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'auto') applyTheme('auto'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <div className="flex items-center gap-0.5 bg-secondary/60 rounded-md p-0.5 border border-border">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded transition-all',
            theme === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
}