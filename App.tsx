

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import ConfigModal from './components/ConfigModal';
import { ResearchJob, AppConfig, TraceEvent, ExecutionStep, ChatMessage } from './types';
import { REASONING_MODELS, TOOL_MODELS, createNewJob } from './constants';
import * as GeminiService from './services/geminiService';
import * as Pipeline from './services/pipeline';
import * as Tools from './services/tools';


const App: React.FC = () => {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>({
    reasoningModel: REASONING_MODELS[0],
    toolModel: TOOL_MODELS[0],
    allowToolPlanFallback: true,
    isWolframEnabled: false,
    wolframAppId: '',
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [traceLog, setTraceLog] = useState<TraceEvent[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Load state from localStorage on initial render
  useEffect(() => {
    try {
      const savedJobs = localStorage.getItem('groundsearch_jobs');
      const savedActiveId = localStorage.getItem('groundsearch_activeJobId');
      const savedConfig = localStorage.getItem('groundsearch_config');
      const savedTheme = localStorage.getItem('groundsearch_theme');

      if (savedJobs) {
        setJobs(JSON.parse(savedJobs));
      }
      if (savedActiveId) {
        setActiveJobId(JSON.parse(savedActiveId));
      }
      if (savedConfig) {
        setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig)}));
      }
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error("Failed to load state from localStorage", error);
    }
    setIsLoading(false);
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if(isLoading) return;
    try {
      localStorage.setItem('groundsearch_jobs', JSON.stringify(jobs));
      localStorage.setItem('groundsearch_activeJobId', JSON.stringify(activeJobId));
      localStorage.setItem('groundsearch_config', JSON.stringify(config));
      localStorage.setItem('groundsearch_theme', theme);
    } catch (error) {
      console.error("Failed to save state to localStorage", error);
    }
  }, [jobs, activeJobId, config, theme, isLoading]);
  
  // Apply theme class to root element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
      setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }

  const logTrace = useCallback((event: Omit<TraceEvent, 'start_ts'> & {start_ts?: number}) => {
    const newEvent = { ...event, start_ts: event.start_ts || Date.now() };
    setTraceLog(prev => [...prev, newEvent]);
  }, []);


  const handleNewJob = () => {
    const newJob = createNewJob(config);
    setJobs(prev => [...prev, newJob]);
    setActiveJobId(newJob.id);
    setTraceLog([]); // Clear trace for new job
  };

  const handleDeleteJob = (jobId: string) => {
    const remainingJobs = jobs.filter(job => job.id !== jobId);
    setJobs(remainingJobs);
    if (activeJobId === jobId) {
      setActiveJobId(remainingJobs.length > 0 ? remainingJobs[0].id : null);
    }
  };

  const handleSelectJob = (id: string) => {
    setActiveJobId(id);
    setTraceLog([]); // Clear trace when switching jobs
  };

  const handleUpdateJob = useCallback((updatedJob: ResearchJob) => {
    setJobs(prevJobs => prevJobs.map(job => job.id === updatedJob.id ? updatedJob : job));
  }, []);
  
  const handleSetJobStatus = useCallback((id: string, status: ResearchJob['status']) => {
      setJobs(prevJobs => prevJobs.map(job => {
          if (job.id === id) {
              return { ...job, status };
          }
          return job;
      }));
  }, []);

  const handleExecutePlan = useCallback((job: ResearchJob, resume: boolean = false, stepId?: string) => {
      if (!job) return;
      Pipeline.executePlan(job, {
          updateJob: handleUpdateJob,
          setJobStatus: (status) => handleSetJobStatus(job.id, status),
          logTrace
      }, resume, stepId);
  }, [handleUpdateJob, handleSetJobStatus, logTrace]);


  const handleGeneratePlan = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.brief) return;

    handleSetJobStatus(jobId, 'Planning');
    logTrace({ step_id: 'plan-generation', action: 'INFO', status: 'running', summary: 'Generating execution plan...' });
    try {
      let plan;
      try {
        plan = await GeminiService.runOrchestrationAgent(job.models.reasoning, job.brief);
      } catch (e) {
          if (config.allowToolPlanFallback) {
              logTrace({ 
                  step_id: 'plan-generation', 
                  action: 'INFO', 
                  status: 'info', 
                  summary: `Reasoning model failed. Retrying with tool model as fallback...`, 
                  error: e instanceof Error ? e.message : String(e),
                  fallback_used: true
              });
              plan = await GeminiService.runOrchestrationAgent(job.models.tool, job.brief);
          } else {
              throw e;
          }
      }

      const planWithStatus = {
          ...plan,
          steps: plan.steps.map(s => ({ ...s, status: 'Pending' as const}))
      };
      
      const updatedJobWithPlan = { ...job, plan: planWithStatus, status: 'Running' };

      handleUpdateJob(updatedJobWithPlan);
      logTrace({ step_id: 'plan-generation', action: 'INFO', status: 'success', summary: 'Plan generated successfully.', output_snapshot: plan });
      
      // Auto-kickoff execution
      logTrace({ step_id: 'system', action: 'INFO', status: 'info', summary: 'Auto-starting execution...' });
      handleExecutePlan(updatedJobWithPlan, false); // Start execution from the beginning

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during plan generation';
      console.error("Failed to generate plan:", error);
      handleUpdateJob({ ...job, status: 'Error', lastError: errorMessage });
      logTrace({ step_id: 'plan-generation', action: 'ERROR', status: 'failed', error: errorMessage });
    }
  };
  
  const handleManualIngest = async (job: ResearchJob, step: ExecutionStep, content: string) => {
    if (!job || !step) return;

    const manualIngestStartTime = Date.now();

    logTrace({
        step_id: step.id,
        action: 'TOOL_CALL',
        status: 'running',
        summary: `Manually ingesting content for ${step.params.url}`,
        input_snapshot: { textLength: content.length, url: step.params.url }
    });

    try {
        const evidence = await Tools.extract_claims(job.models.tool, content, step.params.url);
        const manualIngestDuration = Date.now() - manualIngestStartTime;

        const updatedJob = {
            ...job,
            evidence: [...(job.evidence || []), ...evidence],
            plan: {
                ...job.plan!,
                steps: job.plan!.steps.map(s => 
                    s.id === step.id 
                    ? { ...s, status: 'Completed' as const, result: { extracted: evidence.length }, duration: (s.duration || 0) + manualIngestDuration } 
                    : s
                )
            },
            lastError: undefined
        };
        handleUpdateJob(updatedJob);

        logTrace({
            step_id: step.id,
            action: 'TOOL_RESPONSE',
            status: 'success',
            summary: `Successfully extracted ${evidence.length} claims. Resuming pipeline.`,
            output_snapshot: evidence,
            end_ts: Date.now(),
            duration_ms: manualIngestDuration
        });
        
        handleExecutePlan(updatedJob, true);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during manual ingest.';
        const manualIngestDuration = Date.now() - manualIngestStartTime;
        logTrace({
            step_id: step.id,
            action: 'ERROR',
            status: 'failed',
            error: errorMessage,
            end_ts: Date.now(),
            duration_ms: manualIngestDuration
        });

        // Update the job with an error message, but keep it in a runnable state.
        // The step remains CORS_BLOCKED, so the user can try again.
        const jobUpdateOnError = {
            ...job,
            lastError: `Manual ingest for step '${step.id}' failed. See step details for the error.`,
        };
        handleUpdateJob(jobUpdateOnError);
    }
  };
  
  const handleFollowUpChat = async (jobId: string, question: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.answererResult) return;

    const newUserMessage: ChatMessage = { role: 'user', text: question };
    const updatedHistory = [...(job.followUpHistory || []), newUserMessage];
    
    handleUpdateJob({ ...job, followUpHistory: updatedHistory });

    try {
        const result = await GeminiService.runFollowUpChat(
            job.models.reasoning,
            job,
            updatedHistory,
            question
        );
        
        const newModelMessage: ChatMessage = { role: 'model', text: result };
        const finalHistory = [...updatedHistory, newModelMessage];
        handleUpdateJob({ ...job, followUpHistory: finalHistory });

    } catch (error) {
        console.error(error);
        const errorMessageText = `Sorry, an error occurred while processing your question: ${error instanceof Error ? error.message : 'Unknown error'}`;
        const errorMessage: ChatMessage = { role: 'model', text: errorMessageText };
        const finalHistory = [...updatedHistory, errorMessage];
        handleUpdateJob({ ...job, followUpHistory: finalHistory });
    }
  };


  const activeJob = jobs.find(job => job.id === activeJobId) || null;

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        <div className="text-xl text-light-text/60 dark:text-dark-text/60">Loading GroundSearch...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen font-sans">
      <Sidebar
        jobs={jobs}
        activeJobId={activeJobId}
        onSelectJob={handleSelectJob}
        onNewJob={handleNewJob}
        onOpenConfig={() => setIsConfigOpen(true)}
        onDeleteJob={handleDeleteJob}
      />
      <div className="flex-grow flex flex-col relative">
        <MainContent 
          job={activeJob} 
          updateJob={handleUpdateJob}
          setJobStatus={handleSetJobStatus}
          generatePlan={handleGeneratePlan}
          traceLog={traceLog}
          logTrace={logTrace}
          executePlan={handleExecutePlan}
          manualIngest={handleManualIngest}
          handleFollowUpChat={handleFollowUpChat}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        {config.isWolframEnabled && !config.wolframAppId && (
            <div className="absolute bottom-4 right-4 bg-warning text-black p-3 rounded-lg shadow-lg text-sm z-20">
                <strong>Configuration Warning:</strong> Wolfram|Alpha agent is enabled, but the App ID is missing. This agent will be skipped.
            </div>
        )}
      </div>
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />
       {!process.env.API_KEY && (
                <div className="absolute bottom-4 right-4 bg-error text-white p-3 rounded-lg shadow-lg text-sm z-20">
                    <strong>Configuration Error:</strong> API_KEY is not set. The app will not function correctly.
                </div>
            )}
    </div>
  );
};

export default App;