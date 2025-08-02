import React from 'react';
import { ResearchJob } from '../types';
import { PlusIcon, CogIcon, CheckCircleIcon, ArrowPathIcon, XCircleIcon, BeakerIcon, LightBulbIcon, TrashIcon, InformationCircleIcon } from './icons';

interface JobCardProps {
  job: ResearchJob;
  isActive: boolean;
  onClick: () => void;
  onDelete: (jobId: string) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, isActive, onClick, onDelete }) => {
  const statusConfig = {
    Draft: { icon: <BeakerIcon className="w-4 h-4 text-blue-400" />, color: 'border-blue-500', description: 'Job is in draft state. Define the scope and generate a plan.' },
    Planning: { icon: <ArrowPathIcon className="w-4 h-4 text-yellow-400 animate-spin" />, color: 'border-yellow-500', description: 'The AI is generating the execution plan.' },
    Running: { icon: <ArrowPathIcon className="w-4 h-4 text-yellow-400 animate-spin" />, color: 'border-yellow-500', description: 'The research plan is currently being executed.' },
    Comparing: { icon: <ArrowPathIcon className="w-4 h-4 text-yellow-400 animate-spin" />, color: 'border-yellow-500', description: 'The AI is comparing sources and identifying themes.' },
    Answering: { icon: <ArrowPathIcon className="w-4 h-4 text-yellow-400 animate-spin" />, color: 'border-yellow-500', description: 'The AI is generating the final answer from all evidence.' },
    Synthesizing: { icon: <ArrowPathIcon className="w-4 h-4 text-yellow-400 animate-spin" />, color: 'border-yellow-500', description: 'The AI is generating the final narrative report.' },
    Complete: { icon: <CheckCircleIcon className="w-4 h-4 text-green-400" />, color: 'border-green-500', description: 'The research job has completed successfully.' },
    Error: { icon: <XCircleIcon className="w-4 h-4 text-red-400" />, color: 'border-red-500', description: 'An error occurred during execution.' },
  };

  const { icon, color, description } = statusConfig[job.status] || statusConfig.Draft;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${job.title}"?`)) {
      onDelete(job.id);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group p-3 rounded-lg border-l-4 cursor-pointer transition-all duration-200 ${
        isActive ? 'bg-primary/20 dark:bg-primary/20 border-primary' : 'bg-light-surface dark:bg-dark-surface hover:bg-primary/10 dark:hover:bg-primary/10'
      } ${isActive ? 'border-primary' : color}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate pr-2">{job.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative group">
            {icon}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-secondary text-dark-text text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 shadow-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <InformationCircleIcon className="w-4 h-4 text-primary" />
                <span>{description}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleDelete}
            className="text-light-text/60 dark:text-dark-text/60 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5"
            aria-label="Delete job"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="text-xs text-light-text/70 dark:text-dark-text/70 mt-2 flex justify-between">
        <span className="truncate">{job.models.reasoning}</span>
        <span className="px-1">/</span>
        <span className="truncate">{job.models.tool}</span>
      </div>
    </div>
  );
};

interface SidebarProps {
  jobs: ResearchJob[];
  activeJobId: string | null;
  onSelectJob: (id: string) => void;
  onNewJob: () => void;
  onOpenConfig: () => void;
  onDeleteJob: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ jobs, activeJobId, onSelectJob, onNewJob, onOpenConfig, onDeleteJob }) => {
  return (
    <div className="w-80 bg-light-surface dark:bg-dark-surface h-screen flex flex-col p-4 border-r border-secondary/10 dark:border-primary/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <LightBulbIcon className="w-8 h-8 text-primary"/>
            <h1 className="text-2xl font-bold">GroundSearch</h1>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={onNewJob}
          className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/90 text-dark-text font-bold py-2 px-4 rounded-md transition-colors duration-200"
        >
          <PlusIcon className="w-5 h-5" />
          New Job
        </button>
        <div className="relative group">
            <button
              onClick={onOpenConfig}
              className="p-2 bg-light-bg dark:bg-dark-bg hover:bg-light-bg/80 dark:hover:bg-dark-bg/80 rounded-md transition-colors duration-200 border border-secondary/10 dark:border-primary/10"
            >
              <CogIcon className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-secondary text-dark-text text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 shadow-lg border border-primary/20">
                Configure models and settings.
            </div>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto space-y-2 pr-2">
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isActive={job.id === activeJobId}
              onClick={() => onSelectJob(job.id)}
              onDelete={onDeleteJob}
            />
          ))
        ) : (
          <div className="text-center text-light-text/60 dark:text-dark-text/60 mt-10">
            <p>No research jobs yet.</p>
            <p>Click "New Job" to start.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;