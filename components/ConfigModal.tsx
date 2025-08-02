

import React from 'react';
import { AppConfig } from '../types';
import { REASONING_MODELS, TOOL_MODELS } from '../constants';
import { WolframIcon } from './icons';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfigChange: (newConfig: AppConfig) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, config, onConfigChange }) => {
  if (!isOpen) return null;

  const handleReasoningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ ...config, reasoningModel: e.target.value });
  };
  
  const handleToolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ ...config, toolModel: e.target.value });
  };
  
  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ ...config, allowToolPlanFallback: e.target.checked });
  };

  const handleWolframEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ ...config, isWolframEnabled: e.target.checked });
  };
  
  const handleWolframAppIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ ...config, wolframAppId: e.target.value });
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-light-surface dark:bg-dark-surface rounded-lg shadow-2xl p-8 w-full max-w-lg m-4">
        <h2 className="text-2xl font-bold mb-6">Configuration</h2>
        
        <div className="space-y-6">
          {/* Models Section */}
          <div className="p-4 border border-secondary/10 dark:border-primary/10 rounded-lg">
             <h3 className="font-bold mb-4">Model Selection</h3>
              <div>
                <label htmlFor="reasoning-model" className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  Reasoning Model
                </label>
                <select
                  id="reasoning-model"
                  value={config.reasoningModel}
                  onChange={handleReasoningChange}
                  className="w-full bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 focus:ring-primary focus:border-primary"
                >
                  {REASONING_MODELS.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <p className="text-xs text-light-text/60 dark:text-dark-text/60 mt-1">For planning, synthesis, and complex reasoning.</p>
              </div>

              <div className="mt-4">
                <label htmlFor="tool-model" className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  Tool Model
                </label>
                <select
                  id="tool-model"
                  value={config.toolModel}
                  onChange={handleToolChange}
                  className="w-full bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 focus:ring-primary focus:border-primary"
                >
                  {TOOL_MODELS.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <p className="text-xs text-light-text/60 dark:text-dark-text/60 mt-1">For fast function calls like search and data extraction.</p>
              </div>

              <div className="relative flex items-start mt-4">
                <div className="flex h-6 items-center">
                  <input
                    id="fallback"
                    aria-describedby="fallback-description"
                    name="fallback"
                    type="checkbox"
                    checked={config.allowToolPlanFallback}
                    onChange={handleFallbackChange}
                    className="h-4 w-4 rounded border-light-text/30 dark:border-dark-text/30 text-secondary focus:ring-secondary"
                  />
                </div>
                <div className="ml-3 text-sm leading-6">
                  <label htmlFor="fallback" className="font-medium">
                    Tool Plan Fallback
                  </label>
                  <p id="fallback-description" className="text-light-text/60 dark:text-dark-text/60 text-xs">
                    If the reasoning model times out, retry with the tool model.
                  </p>
                </div>
              </div>
          </div>
          
          {/* Wolfram Section */}
          <div className="p-4 border border-secondary/10 dark:border-primary/10 rounded-lg">
            <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><WolframIcon className="w-5 h-5"/> Wolfram|Alpha Agent</h3>
                <input
                    type="checkbox"
                    className="toggle toggle-sm checked:bg-primary"
                    checked={config.isWolframEnabled}
                    onChange={handleWolframEnabledChange}
                    aria-label="Enable or disable Wolfram|Alpha agent"
                />
            </div>
            <p className="text-xs text-light-text/60 dark:text-dark-text/60 mt-2 mb-4">Enable parallel search for quantitative and computational facts using the Wolfram|Alpha API.</p>

            {config.isWolframEnabled && (
                <div>
                  <label htmlFor="wolfram-key" className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                    Wolfram|Alpha App ID
                  </label>
                  <input
                    id="wolfram-key"
                    type="password"
                    value={config.wolframAppId}
                    onChange={handleWolframAppIdChange}
                    placeholder="Enter your App ID..."
                    className="w-full bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
            )}
          </div>

        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="bg-secondary hover:bg-secondary/90 text-dark-text font-bold py-2 px-6 rounded-md transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;