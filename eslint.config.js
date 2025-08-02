// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,

  // TS/React files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // TS handles undefineds; don't double-report
      'no-undef': 'off',
      // So dev builds pass; tighten later
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-case-declarations': 'off',
    },
  },

  // JS files
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'off',
    },
  },
];