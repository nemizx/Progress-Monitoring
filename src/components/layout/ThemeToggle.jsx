import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || null);

  useEffect(() => {
    if (!theme) return;
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggle() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <button
      onClick={toggle}
      className={"inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-primary/10 transition-colors " + className}
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4 text-primary-foreground" /> : <Moon className="w-4 h-4 text-primary-foreground" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
