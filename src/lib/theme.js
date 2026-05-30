// Theme management utility
export const THEMES = ['dark', 'light', 'auto'];

export function getStoredTheme() {
  return localStorage.getItem('datapulse-theme') || 'dark';
}

export function setStoredTheme(theme) {
  localStorage.getItem('datapulse-theme');
  localStorage.setItem('datapulse-theme', theme);
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
  } else if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
}