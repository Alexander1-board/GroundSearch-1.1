import type { Config } from 'tailwindcss';

const themeColors = {
  brown: '#7A5230',
  cream: '#F5EDE3',
  lightBg: '#F5EDE3',
  darkBg: '#1c1917',
};

export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brown: themeColors.brown,
        cream: themeColors.cream,
        'light-bg': themeColors.lightBg,
        'dark-bg': themeColors.darkBg,
        'light-surface': '#f8f5f2',
        'dark-surface': '#1c1917',
        primary: themeColors.brown,
        secondary: themeColors.cream,
        'light-text': themeColors.brown,
        'dark-text': themeColors.cream,
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
