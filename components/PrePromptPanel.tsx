import React, { useEffect, useState } from 'react';
import { loadPrePrompt, savePrePrompt } from '../store/jobs';

interface PrePromptPanelProps {
  jobId: string;
}

const PrePromptPanel: React.FC<PrePromptPanelProps> = ({ jobId }) => {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const existing = loadPrePrompt(jobId);
    setText(existing);
    setSaved(existing);
  }, [jobId]);

  const handleSave = () => {
    savePrePrompt(jobId, text);
    setSaved(text);
  };

  const handleReset = () => {
    savePrePrompt(jobId, '');
    setText('');
    setSaved('');
  };

  return (
    <div className="mb-4 p-4 rounded-lg bg-light-surface dark:bg-dark-surface">
      <h3 className="font-semibold mb-2">Pre-Prompt</h3>
      <textarea
        className="w-full p-2 mb-2 rounded border border-secondary/20 bg-light-bg dark:bg-dark-bg"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />
      <div className="flex gap-2 mb-2">
        <button onClick={handleSave} className="bg-secondary text-dark-text px-3 py-1 rounded-md">
          Save
        </button>
        <button onClick={handleReset} className="bg-error text-white px-3 py-1 rounded-md">
          Reset
        </button>
      </div>
      {saved && (
        <div className="text-xs text-light-text dark:text-dark-text">
          Applied pre-prompt: {saved}
        </div>
      )}
    </div>
  );
};

export default PrePromptPanel;
