import React, { useEffect, useState } from 'react';

const ThemeSmoke: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        className="bg-secondary text-dark-text px-3 py-1 rounded-md"
      >
        Toggle Theme
      </button>
      <div className="flex gap-4">
        <div className="w-8 h-8 bg-brown" title="brown" />
        <div className="w-8 h-8 bg-cream" title="cream" />
        <div className="w-8 h-8 bg-light-bg dark:bg-dark-bg" title="background" />
      </div>
    </div>
  );
};

export default ThemeSmoke;
