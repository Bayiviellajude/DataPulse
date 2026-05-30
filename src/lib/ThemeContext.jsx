import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('datapulse-theme') || 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      root.classList.toggle('dark', mq.matches);
      root.classList.toggle('light', !mq.matches);
      const handler = e => { root.classList.toggle('dark', e.matches); root.classList.toggle('light', !e.matches); };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      root.classList.toggle('dark', theme === 'dark');
      root.classList.toggle('light', theme === 'light');
    }
    localStorage.setItem('datapulse-theme', theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);