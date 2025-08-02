import React from 'react';
import { ResearchJob } from '../types';
import { BeakerIcon, LightBulbIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon } from './icons';

type View = 'scope' | 'orchestration' | 'results';

interface JobTimelineProps {
  job: ResearchJob | null;
  activeView: View;
  onSelectView: (view: View) => void;
}

interface Stage {
  name: string;
  view: View;
  status: 'pending' | 'active' | 'completed' | 'error';
  icon: React.ReactNode;
  statusIcon: React.ReactNode;
  progress?: number;
}

const JobTimeline: React.FC<JobTimelineProps> = ({ job, activeView, onSelectView }) => {
    if (!job) return null;

    const getStageStatus = (): Stage[] => {
        const stages: Omit<Stage, 'icon' | 'statusIcon' | 'progress'>[] = [
            { name: 'Scope', view: 'scope', status: 'pending' },
            { name: 'Research', view: 'orchestration', status: 'pending' },
            { name: 'Analyze', view: 'orchestration', status: 'pending' },
            { name: 'Answer', view: 'results', status: 'pending' },
        ];
        
        const runningStepAction = job.plan?.steps.find(s => s.status === 'Running')?.action;

        if (job.status === 'Error') {
            const errorStep = job.plan?.steps.find(s => s.status === 'Failed' || s.status === 'CORS_BLOCKED');
            let errorStageIndex = 3; // Default to last stage
            
            if (errorStep) {
                switch(errorStep.action) {
                    case 'RESEARCH_FACET':
                    case 'SYNTHESIZE_RESEARCH':
                        errorStageIndex = 1;
                        break;
                    case 'COMPARE':
                        errorStageIndex = 2;
                        break;
                    case 'ANSWER':
                        errorStageIndex = 3;
                        break;
                    default:
                        errorStageIndex = 1;
                }
            } else if (job.status === 'Planning') {
                 errorStageIndex = 1;
            }

            for(let i=0; i < errorStageIndex; i++) stages[i].status = 'completed';
            stages[errorStageIndex].status = 'error';

        } else {
            // Scope
            stages[0].status = job.plan ? 'completed' : 'active';
            
            // Research (covers Plan generation, RESEARCH_FACET, and SYNTHESIZE_RESEARCH)
            if (job.status === 'Planning' || runningStepAction === 'RESEARCH_FACET' || runningStepAction === 'SYNTHESIZE_RESEARCH') {
                stages[1].status = 'active';
            }
            if (job.deepResearchResult) stages[1].status = 'completed';
            if (stages[1].status === 'completed') stages[0].status = 'completed';

            // Analyze (covers COMPARE)
            if (job.status === 'Comparing' || runningStepAction === 'COMPARE') stages[2].status = 'active';
            if (job.insightPackResult) stages[2].status = 'completed';
            if (stages[2].status === 'completed') stages[1].status = 'completed';


            // Answer
            if (job.status === 'Answering' || runningStepAction === 'ANSWER') stages[3].status = 'active';
            if (job.status === 'Complete') {
                stages.forEach(s => s.status = 'completed');
            }
        }
        
        const statusIcons = {
            pending: <div className="w-3 h-3 rounded-full bg-light-text/20 dark:bg-dark-text/20" />,
            active: <ArrowPathIcon className="w-5 h-5 text-primary animate-spin-slow" />,
            completed: <CheckCircleIcon className="w-5 h-5 text-success" />,
            error: <XCircleIcon className="w-5 h-5 text-error" />,
        };

        const stageIcons = {
            Scope: <BeakerIcon className="w-5 h-5" />,
            Research: <InformationCircleIcon className="w-5 h-5" />,
            Analyze: <ArrowPathIcon className="w-5 h-5" />,
            Answer: <LightBulbIcon className="w-5 h-5" />,
        };

        return stages.map(s => ({
            ...s,
            icon: stageIcons[s.name as keyof typeof stageIcons] || <div />,
            statusIcon: statusIcons[s.status]
        }));
    };

    const timelineStages = getStageStatus();

    const canSelectView = (view: View) => {
        if(view === 'orchestration') return !!job.plan;
        if(view === 'results') return job.status === 'Complete';
        return true; // scope is always selectable
    }

    return (
        <div className="w-full bg-light-surface dark:bg-dark-surface rounded-lg p-4 overflow-x-auto">
            <div className="flex items-center justify-between min-w-max">
                {timelineStages.map((stage, index) => {
                    const isLast = index === timelineStages.length - 1;
                    const canSelect = canSelectView(stage.view);
                    const isActiveView = stage.view === activeView;
                    
                    const stageColor = stage.status === 'completed' ? 'text-success' :
                                       stage.status === 'active' ? 'text-primary' :
                                       stage.status === 'error' ? 'text-error' :
                                       'text-light-text/40 dark:text-dark-text/40';

                    const connectorColor = stage.status === 'completed' ? 'bg-success' :
                                           stage.status === 'active' || stage.status === 'error' ? 'bg-primary' :
                                           'bg-light-text/20 dark:bg-dark-text/20';
                                           
                    const ringColor = isActiveView ? 'ring-2 ring-primary' : stage.status === 'active' ? 'ring-2 ring-primary/50' : '';


                    return (
                        <React.Fragment key={stage.name}>
                            <div
                                onClick={() => canSelect && onSelectView(stage.view)}
                                className={`flex flex-col items-center text-center gap-2 ${canSelect ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isActiveView ? 'bg-primary/20' : 'bg-light-bg dark:bg-dark-bg'} ${stageColor} ${ringColor}`}>
                                    {stage.icon}
                                </div>
                                <span className={`text-xs font-bold transition-colors ${isActiveView ? 'text-primary' : canSelect ? '' : 'opacity-50'}`}>{stage.name}</span>
                                <div className="w-5 h-5 mt-1 flex items-center justify-center">{stage.statusIcon}</div>
                            </div>
                            {!isLast && <div className={`flex-1 h-1 mx-4 rounded-full ${connectorColor}`}></div>}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default JobTimeline;