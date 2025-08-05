import React, { useState, useEffect } from 'react';
import { ResearchBrief } from '../types';
import { loadBrief, saveBrief } from '../store/jobs';

type Props = { jobId: string };

const ScopingAgent: React.FC<Props> = ({ jobId }) => {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<ResearchBrief>(() => loadBrief(jobId));

  useEffect(() => {
    saveBrief(jobId, brief);
  }, [brief, jobId]);

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const updateBrief = (update: Partial<ResearchBrief>) => {
    setBrief((prev) => ({ ...prev, ...update }));
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <label>
              Objective
              <textarea
                aria-label="objective"
                value={brief.objective}
                onChange={(e) => updateBrief({ objective: e.target.value })}
              />
            </label>
          </div>
        );
      case 1:
        return (
          <div>
            <label>
              Key Questions
              <textarea
                aria-label="key-questions"
                value={brief.key_questions.join('\n')}
                onChange={(e) =>
                  updateBrief({ key_questions: e.target.value.split(/\n+/).filter(Boolean) })
                }
              />
            </label>
          </div>
        );
      case 2:
        return (
          <div>
            <label>
              Comparators
              <textarea
                aria-label="comparators"
                value={brief.scope.comparators.join('\n')}
                onChange={(e) =>
                  updateBrief({
                    scope: {
                      ...brief.scope,
                      comparators: e.target.value.split(/\n+/).filter(Boolean),
                    },
                  })
                }
              />
            </label>
          </div>
        );
      case 3:
        return (
          <div>
            <label>
              From
              <input
                aria-label="from"
                type="number"
                value={brief.scope.timeframe.from}
                onChange={(e) =>
                  updateBrief({
                    scope: {
                      ...brief.scope,
                      timeframe: { ...brief.scope.timeframe, from: Number(e.target.value) },
                    },
                  })
                }
              />
            </label>
            <label>
              To
              <input
                aria-label="to"
                type="number"
                value={brief.scope.timeframe.to}
                onChange={(e) =>
                  updateBrief({
                    scope: {
                      ...brief.scope,
                      timeframe: { ...brief.scope.timeframe, to: Number(e.target.value) },
                    },
                  })
                }
              />
            </label>
          </div>
        );
      case 4:
        return (
          <div>
            <label>
              Deliverable
              <textarea
                aria-label="deliverable"
                value={brief.deliverable}
                onChange={(e) => updateBrief({ deliverable: e.target.value })}
              />
            </label>
          </div>
        );
      case 5:
        return (
          <div>
            <label>
              Success Criteria
              <textarea
                aria-label="success-criteria"
                value={brief.success_criteria.join('\n')}
                onChange={(e) =>
                  updateBrief({ success_criteria: e.target.value.split(/\n+/).filter(Boolean) })
                }
              />
            </label>
            <div data-testid="summary">Brief Complete</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {renderStep()}
      <div>
        {step > 0 && <button onClick={back}>Back</button>}
        {step < 5 && <button onClick={next}>Next</button>}
      </div>
    </div>
  );
};

export default ScopingAgent;
