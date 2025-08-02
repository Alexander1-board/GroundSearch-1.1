import {
  ResearchJob,
  ExecutionStep,
  TraceEvent,
  RecordLite,
  Evidence,
  InsightPackResult,
  FacetResult,
} from '../types';
import * as GeminiService from './geminiService';
import * as Tools from './tools';
import { TOOL_MODELS } from '../constants';

type PipelineCallbacks = {
  updateJob: (job: ResearchJob) => void;
  setJobStatus: (status: ResearchJob['status']) => void;
  logTrace: (event: Omit<TraceEvent, 'start_ts'> & { start_ts?: number }) => void;
};

const updateStepInJob = (
  job: ResearchJob,
  stepId: string,
  updates: Partial<ExecutionStep>,
): ResearchJob => {
  if (!job.plan) return job;
  const newSteps = job.plan.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s));
  return { ...job, plan: { ...job.plan, steps: newSteps } };
};

export async function executePlan(
  initialJob: ResearchJob,
  callbacks: PipelineCallbacks,
  resume: boolean = false,
  stepIdToResume?: string,
) {
  const { updateJob, setJobStatus, logTrace } = callbacks;
  GeminiService.setPrePromptFromLocalStorage(initialJob.id);
  let currentJob = { ...initialJob };

  // This will hold the results from the new granular research steps
  let accumulatedFacetResults: { [key: string]: string } = {};
  let accumulatedSources: RecordLite[] = [];

  const logHelper = (event: Partial<TraceEvent>) => {
    const fullEvent: Omit<TraceEvent, 'start_ts'> & { start_ts?: number } = {
      step_id: event.step_id || 'system',
      action: event.action || 'INFO',
      status: event.status || 'info',
      summary: event.summary || '',
      ...event,
    };
    logTrace(fullEvent);
  };

  if (resume) {
    logHelper({
      action: 'INFO',
      summary: `Resuming plan execution${stepIdToResume ? ` from step ${stepIdToResume}` : ''}.`,
    });
    currentJob = { ...currentJob, lastError: undefined };
    setJobStatus('Running');
  } else {
    logHelper({ action: 'INFO', summary: 'Starting plan execution.' });
    currentJob = { ...currentJob, lastError: undefined };
  }
  updateJob(currentJob);

  const stepsToRun = currentJob.plan?.steps || [];
  let startIndex = resume
    ? stepsToRun.findIndex(
        (s) => s.id === stepIdToResume || ['Pending', 'Failed', 'CORS_BLOCKED'].includes(s.status),
      )
    : 0;

  if (stepIdToResume) {
    const specificIndex = stepsToRun.findIndex((s) => s.id === stepIdToResume);
    if (specificIndex !== -1) {
      startIndex = specificIndex;
    }
  }

  if (startIndex === -1 && stepsToRun.every((s) => s.status === 'Completed')) {
    logHelper({ action: 'INFO', summary: 'Plan already complete.' });
    setJobStatus('Complete');
    return;
  }

  for (let i = startIndex; i < stepsToRun.length; i++) {
    GeminiService.clearLastPrompt();
    const step = stepsToRun[i];
    const startTime = Date.now();

    currentJob = updateStepInJob(currentJob, step.id, { status: 'Running' });
    logHelper({
      step_id: step.id,
      parent_step_id: step.action,
      action: step.action,
      agent: step.agent,
      status: 'running',
      summary: `Executing ${step.action} using ${step.agent}`,
      model: ['SEARCH', 'INGEST', 'RESEARCH_FACET'].includes(step.action)
        ? currentJob.models.tool
        : currentJob.models.reasoning,
      input_snapshot: {
        params: step.params,
        specialist_instructions: step.specialist_instructions,
      },
    });
    updateJob(currentJob);

    try {
      let result: any;

      const isToolStep = ['SEARCH', 'INGEST', 'RESEARCH_FACET'].includes(step.action);
      if (isToolStep && !TOOL_MODELS.includes(currentJob.models.tool)) {
        const message = `${step.action} must use a designated tool model. Current tool model is '${currentJob.models.tool}'.`;
        throw new Error(message);
      }

      switch (step.action) {
        case 'RESEARCH_FACET': {
          if (!currentJob.brief) {
            throw new Error('Cannot run RESEARCH_FACET without a research brief.');
          }
          setJobStatus('Running');
          const { resultText, sources } = await GeminiService.runFacetResearchAgent(
            currentJob.models.reasoning,
            step.params.facet_name,
            currentJob.brief,
          );

          accumulatedFacetResults[step.params.facet_name] = resultText;
          accumulatedSources.push(...sources);

          result = { summary: resultText, sourcesFound: sources.length };
          break;
        }
        case 'SYNTHESIZE_RESEARCH': {
          setJobStatus('Synthesizing');
          const uniqueSources = Tools.deduplicateRecords(accumulatedSources);
          const deepResearchResult = await GeminiService.runResearchSynthesisAgent(
            currentJob.models.reasoning,
            Object.values(accumulatedFacetResults),
            uniqueSources,
          );

          const evidenceFromDeepResearch: Evidence[] = (deepResearchResult.sources || []).map(
            (record: RecordLite) => {
              const { score } = Tools.score_credibility(record);
              return {
                ...record,
                id: record.id,
                title: record.title,
                url: record.url,
                snippet: record.snippet,
                source_id: record.source_id,
                year: record.published ? new Date(record.published).getFullYear() : undefined,
                quant_score: score,
                matches_questions: true,
                within_timeframe: true,
                has_comparators: true,
                has_quant_outcomes: false,
              };
            },
          );

          result = deepResearchResult;
          currentJob = {
            ...currentJob,
            deepResearchResult,
            evidence: evidenceFromDeepResearch,
            sources: [],
          }; // Reset sources after synthesis
          break;
        }
        case 'SEARCH': {
          const searchPromises: Promise<RecordLite[]>[] = [];

          searchPromises.push(Tools.search_web(currentJob.models.tool, step.params.query, 10));

          if (currentJob.config.isWolframEnabled && currentJob.config.wolframAppId) {
            searchPromises.push(
              Tools.wolfram_query(step.params.query, currentJob.config.wolframAppId),
            );
          }

          const settledResults = await Promise.allSettled(searchPromises);
          let allSources: RecordLite[] = [];

          settledResults.forEach((res, index) => {
            const sourceName = index === 0 ? 'Web Search' : 'Wolfram|Alpha';
            if (res.status === 'fulfilled') {
              logHelper({
                step_id: step.id,
                action: 'INFO',
                status: 'info',
                summary: `${sourceName} found ${res.value.length} sources.`,
              });
              allSources.push(...res.value);
            } else {
              logHelper({
                step_id: step.id,
                action: 'ERROR',
                status: 'failed',
                summary: `${sourceName} failed.`,
                error: res.reason.message,
              });
            }
          });

          result = allSources;

          const newSources = [
            ...(currentJob.sources || []),
            ...(Array.isArray(result) ? result : []),
          ];
          currentJob = { ...currentJob, sources: newSources };
          break;
        }
        case 'INGEST':
          try {
            result = await Tools.ingest_url(step.params.url);
          } catch (e) {
            if (e instanceof Error && e.message === 'CORS_BLOCKED') {
              const duration_ms = Date.now() - startTime;
              logHelper({
                step_id: step.id,
                parent_step_id: step.action,
                action: step.action,
                agent: step.agent,
                status: 'info',
                summary: `Execution paused due to CORS block on URL.`,
                recommendation: 'Please paste page content in the UI to proceed.',
                end_ts: Date.now(),
                duration_ms,
                error: 'CORS_BLOCKED',
                input_snapshot: step.params,
              });
              currentJob = updateStepInJob(currentJob, step.id, {
                status: 'CORS_BLOCKED',
                duration: duration_ms,
              });
              setJobStatus('Running');
              updateJob(currentJob);
              return; // Pause execution
            }
            throw e;
          }
          break;
        case 'SCREEN': {
          const sourcesToScreen = currentJob.sources || [];
          if (sourcesToScreen.length === 0) {
            logHelper({
              step_id: step.id,
              parent_step_id: step.action,
              action: 'INFO',
              status: 'info',
              summary: 'No sources found to screen. Skipping step.',
            });
            result = { kept: [], dropped_count: 0 };
            break;
          }

          const BATCH_SIZE = 10;
          const allKept: Evidence[] = [];
          let totalDropped = 0;
          let totalProcessed = 0;

          for (let i = 0; i < sourcesToScreen.length; i += BATCH_SIZE) {
            const batch = sourcesToScreen.slice(i, i + BATCH_SIZE);
            logHelper({
              step_id: step.id,
              action: 'INFO',
              status: 'running',
              summary: `Screening batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(sourcesToScreen.length / BATCH_SIZE)} (${batch.length} sources)...`,
            });

            const batchResult = await GeminiService.runScreeningAgent(
              currentJob.models.reasoning,
              batch,
              currentJob.brief!,
            );

            allKept.push(...(batchResult.kept || []));
            totalDropped +=
              batchResult.dropped_count || batch.length - (batchResult.kept?.length || 0);
            totalProcessed += batch.length;
          }

          if (totalDropped + allKept.length !== totalProcessed) {
            totalDropped = totalProcessed - allKept.length;
          }

          const screeningResult = { kept: allKept, dropped_count: totalDropped };

          const scoredEvidence = screeningResult.kept.map((evidence: Evidence) => {
            const recordForScoring: RecordLite = {
              ...evidence,
              id: evidence.id,
              published: evidence.year,
            };
            const { score } = Tools.score_credibility(recordForScoring);
            return { ...evidence, quant_score: score };
          });

          if (scoredEvidence.length === 0) {
            const message = `Screening complete, but no usable evidence was found from ${sourcesToScreen.length} source(s).`;
            logHelper({
              step_id: step.id,
              parent_step_id: step.action,
              action: step.action,
              agent: step.agent,
              status: 'failed',
              summary: message,
              recommendation: 'Try refining the research scope or search queries in the plan.',
              error: message,
              output_snapshot: screeningResult,
            });
            throw new Error(message);
          }

          result = { kept: scoredEvidence, dropped_count: screeningResult.dropped_count };
          logHelper({
            step_id: step.id,
            parent_step_id: step.action,
            action: 'INFO',
            status: 'info',
            summary: `Screening complete. Kept and scored ${result.kept.length} sources, dropped ${result.dropped_count}.`,
          });
          currentJob = { ...currentJob, evidence: result.kept, sources: [] };
          break;
        }
        case 'COMPARE':
          setJobStatus('Comparing');
          if (!currentJob.evidence || currentJob.evidence.length === 0) {
            throw new Error('Cannot run COMPARE step without evidence.');
          }
          if (!currentJob.brief) {
            throw new Error('Cannot run COMPARE step without a research brief.');
          }
          const rawInsightPack = await GeminiService.runInsightPackAgent(
            currentJob.models.reasoning,
            currentJob,
          );
          result = Tools.enforceCitationsAndUncertainties(rawInsightPack);

          currentJob = { ...currentJob, insightPackResult: result };
          break;
        case 'ANSWER':
          setJobStatus('Answering');
          if (!currentJob.evidence) {
            throw new Error('Cannot run ANSWER step without evidence.');
          }
          result = await GeminiService.runAnswererAgent(currentJob.models.reasoning, currentJob);
          result = Tools.postProcessFinalAnswer(result);

          currentJob = { ...currentJob, answererResult: result };
          break;
      }

      const duration_ms = Date.now() - startTime;
      currentJob = updateStepInJob(currentJob, step.id, {
        status: 'Completed',
        result,
        duration: duration_ms,
      });
      updateJob(currentJob);
      const promptSnapshot = GeminiService.getLastPrompt();
      const logData: any = {
        step_id: step.id,
        parent_step_id: step.action,
        action: step.action,
        agent: step.agent,
        status: 'success',
        summary: `Step completed successfully.`,
        end_ts: Date.now(),
        duration_ms,
        output_snapshot: result,
      };
      if (promptSnapshot) {
        logData.input_snapshot = { prompt: promptSnapshot };
      }
      logHelper(logData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error executing step ${step.id}:`, error);
      const duration_ms = Date.now() - startTime;
      logHelper({
        step_id: step.id,
        parent_step_id: step.action,
        action: step.action,
        agent: step.agent,
        status: 'failed',
        summary: `Step failed: ${errorMessage}`,
        end_ts: Date.now(),
        duration_ms,
        error: errorMessage,
        recommendation: 'Please check the error and retry the step.',
      });
      currentJob = updateStepInJob(currentJob, step.id, {
        status: 'Failed',
        result: errorMessage,
        duration: duration_ms,
      });
      updateJob({
        ...currentJob,
        status: 'Error',
        lastError: `Step '${step.action}' failed: ${errorMessage}`,
      });
      return;
    }
  }

  setJobStatus('Complete');
  logHelper({
    step_id: 'system',
    action: 'INFO',
    status: 'success',
    summary: 'Plan finished successfully.',
  });
}
