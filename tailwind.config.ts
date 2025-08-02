import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brown: '#7A5230',
        cream: '#F5EDE3',
        'light-bg': '#F5EDE3',
        'dark-bg': '#1c1917',
        'light-surface': '#f8f5f2',
        'dark-surface': '#1c1917',
        primary: '#7A5230',
        secondary: '#F5EDE3',
        'light-text': '#7A5230',
        'dark-text': '#F5EDE3',
        success: '#16a34a',
        warning: '#facc15',
        error: '#dc2626',
        info: '#2563eb',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pop-in': 'pop-in 0.3s ease-out forwards',
      },
      keyframes: {
        'pop-in': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.5)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
