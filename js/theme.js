"use strict";

const ThemeToggle = (() => {
  let currentTheme = localStorage.getItem('subtile_theme') || 'dark';

  function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('subtile_theme', theme);
    applyTheme();
  }

  function toggle() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  function applyTheme() {
    const isDark = currentTheme === 'dark';
    const root = document.documentElement;
    if (isDark) {
      root.style.setProperty('--bg-main', '#050507');
      root.style.setProperty('--bg-card', 'rgba(15,15,18,0.75)');
      root.style.setProperty('--bg-card-hover', 'rgba(20,20,24,0.85)');
      root.style.setProperty('--border-color', 'rgba(255,255,255,0.08)');
      root.style.setProperty('--border-hover', 'rgba(255,255,255,0.25)');
      root.style.setProperty('--text-main', '#ffffff');
      root.style.setProperty('--text-muted', '#9ca3af');
      document.body.style.backgroundColor = '#050507';
      document.body.style.color = '#ffffff';
    } else {
      root.style.setProperty('--bg-main', '#f8f9fa');
      root.style.setProperty('--bg-card', 'rgba(255,255,255,0.9)');
      root.style.setProperty('--bg-card-hover', 'rgba(255,255,255,1)');
      root.style.setProperty('--border-color', 'rgba(0,0,0,0.08)');
      root.style.setProperty('--border-hover', 'rgba(0,0,0,0.2)');
      root.style.setProperty('--text-main', '#111827');
      root.style.setProperty('--text-muted', '#6b7280');
      document.body.style.backgroundColor = '#f8f9fa';
      document.body.style.color = '#111827';
    }
    document.body.classList.toggle('light-theme', !isDark);
  }

  return { toggle, applyTheme };
})();
