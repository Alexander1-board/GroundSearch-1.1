import React from 'react';

const ApiKeyMissing: React.FC = () => (
  <div
    className="absolute top-0 left-0 right-0 bg-error text-white p-4 text-center z-50"
    role="alert"
    aria-live="assertive"
  >
    <strong>Configuration Error:</strong> VITE_GEMINI_API_KEY is not set. Gemini features are
    disabled.
  </div>
);

export default ApiKeyMissing;
