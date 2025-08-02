import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (!import.meta.env.VITE_GEMINI_API_KEY) {
  throw new Error('Missing VITE_GEMINI_API_KEY. Set it in .env.local');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
