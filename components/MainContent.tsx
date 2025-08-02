
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ResearchJob, ResearchBrief, ExecutionStep, RecordLite, Evidence, TraceEvent, NextStep, HighValueSourceReason, ThemeConfidence, ChatMessage, DeepResearchResult, FacetResult } from '../types';
import { ArrowPathIcon, CheckCircleIcon, ChevronDownIcon, ExclamationTriangleIcon, MoonIcon, SunIcon, XCircleIcon, ClipboardIcon, InformationCircleIcon, WolframIcon } from './icons';
import ReactMarkdown from 'react-markdown';
import * as GeminiService from '../services/geminiService';
import ComparisonMatrix from './ComparisonMatrix';
import { mapJobToMatrixData } from './mappers';
import JobTimeline from './JobTimeline';

// --- Tooltip Component ---
const Tooltip: React.FC<{ children: React.ReactNode, content: React.ReactNode | string }> = ({ children, content }) => {
    return (
        <div className="relative group flex items-center">
            {children}
            <div className="absolute bottom-full mb-2 w-max max-w-xs bg-secondary text-dark-text text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 shadow-lg border border-primary/20">
                {content}
            </div>
        </div>
    );
};


// --- Tab Components ---

const ScopeTab: React.FC<{ job: ResearchJob, updateJob: (job: ResearchJob) => void }> = ({ job, updateJob }) => {
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [job.chatHistory]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;

        const newUserMessage = { role: 'user' as const, parts: [{ text: input }] };
        const updatedHistory = [...job.chatHistory, newUserMessage];
        
        updateJob({ ...job, chatHistory: updatedHistory });
        setInput('');
        setIsThinking(true);

        try {
            const result = await GeminiService.runConversationAgent(job.models.reasoning, updatedHistory, job.brief!);
            
            if (!result || typeof result.reply !== 'string' || !result.outline) {
                throw new Error('Invalid response from AI agent.');
            }

            const newModelMessage = { role: 'model' as const, parts: [{ text: result.reply }] };

            const currentBrief = job.brief!;
            const outline = result.outline;
            const newBrief = {
              ...currentBrief,
              ...outline,
              scope: {
                ...currentBrief.scope,
                ...(outline.scope || {}),
                timeframe: {
                  ...currentBrief.scope.timeframe,
                  ...(outline.scope?.timeframe || {}),
                },
              },
            };
            
            updateJob({ ...job, brief: newBrief, chatHistory: [...updatedHistory, newModelMessage] });
        } catch (error) {
            console.error(error);
            const errorMessageText = `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
            const errorMessage = { role: 'model' as const, parts: [{ text: errorMessageText }] };
            updateJob({ ...job, chatHistory: [...updatedHistory, errorMessage] });
        } finally {
            setIsThinking(false);
        }
    };
    
    const handleBriefChange = (field: keyof ResearchBrief, value: any) => {
        if (job.brief) {
            updateJob({ ...job, brief: { ...job.brief, [field]: value }});
        }
    };
    
    const handleScopeChange = (field: string, value: any) => {
        if (job.brief) {
            const newScope = { ...job.brief.scope, [field]: value };
            handleBriefChange('scope', newScope);
        }
    };
    
    if(!job.brief) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Chat Panel */}
            <div className="flex flex-col bg-light-surface dark:bg-dark-surface rounded-lg p-4 h-full">
                <div className="flex-grow overflow-y-auto pr-2 space-y-4 mb-4">
                    {job.chatHistory.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-lg p-3 rounded-lg break-words whitespace-pre-wrap ${msg.role === 'user' ? 'bg-secondary text-dark-text' : 'bg-light-bg dark:bg-dark-bg border border-secondary/10 dark:border-primary/10'} break-words whitespace-pre-wrap `}>
                                <p className="text-sm">{msg.parts[0].text}</p>
                            </div>
                        </div>
                    ))}
                    {isThinking && <div className="flex justify-start"><div className="max-w-lg p-3 rounded-lg bg-light-bg dark:bg-dark-bg"><span className="animate-pulse">Thinking...</span></div></div>}
                    <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2 border-t border-secondary/10 dark:border-primary/10 pt-4">
                     <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type your message... (Shift+Enter for new line)"
                        className="flex-grow bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 focus:ring-primary focus:border-primary resize-none overflow-y-auto"
                        disabled={isThinking}
                    />
                    <button onClick={handleSend} disabled={isThinking} className="bg-primary hover:bg-primary/90 text-secondary font-bold py-2 px-4 rounded-md disabled:bg-light-text/20 dark:disabled:bg-dark-text/20 self-end">
                        Send
                    </button>
                </div>
            </div>

            {/* Research Brief Form */}
            <div className="flex flex-col bg-light-surface dark:bg-dark-surface rounded-lg p-4 h-full overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">Research Brief</h3>
                <div className="space-y-4 text-sm">
                   <BriefInput label="Objective" value={job.brief.objective} onChange={v => handleBriefChange('objective', v)} />
                   <BriefTextarea label="Key Questions" value={job.brief.key_questions.join('\n')} onChange={v => handleBriefChange('key_questions', v.split('\n'))} />
                   <BriefInput label="Deliverable" value={job.brief.deliverable} onChange={v => handleBriefChange('deliverable', v)} />
                   <BriefTextarea label="Success Criteria" value={job.brief.success_criteria.join('\n')} onChange={v => handleBriefChange('success_criteria', v.split('\n'))} />
                   <h4 className="font-bold mt-4">Scope</h4>
                   <BriefInput label="From Year" type="number" value={job.brief.scope.timeframe.from} onChange={v => handleScopeChange('timeframe', {...job.brief!.scope.timeframe, from: Number(v)})} />
                   <BriefInput label="To Year" type="number" value={job.brief.scope.timeframe.to} onChange={v => handleScopeChange('timeframe', {...job.brief!.scope.timeframe, to: Number(v)})} />
                   <BriefTextarea label="Domains/URLs" value={job.brief.scope.domains.join('\n')} onChange={v => handleScopeChange('domains', v.split('\n'))} placeholder="Enter domains or specific URLs"/>
                </div>
            </div>
        </div>
    );
};

const BriefInput: React.FC<{ label: string, value: any, onChange: (value: any) => void, type?: string, placeholder?: string }> = ({ label, value, onChange, type='text', placeholder }) => (
    <div>
        <label className="block font-medium text-light-text/70 dark:text-dark-text/70">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 mt-1 focus:ring-primary focus:border-primary" />
    </div>
);

const BriefTextarea: React.FC<{ label: string, value: string, onChange: (value: string) => void, placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
    <div>
        <label className="block font-medium text-light-text/70 dark:text-dark-text/70">{label}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 mt-1 focus:ring-primary focus:border-primary" />
    </div>
);


const DeepResearchReport: React.FC<{ result: DeepResearchResult }> = ({ result }) => {
    const [openFacets, setOpenFacets] = useState<Record<string, boolean>>({});

    if (!result || !result.facet_results) {
        return (
            <div className="p-3 bg-error/10 text-error rounded-md text-xs">
                <p className="font-bold">Data Incomplete</p>
                <p>The deep research agent did not return a valid facet analysis.</p>
            </div>
        );
    }

    const toggleFacet = (facetName: string) => {
        setOpenFacets(prev => ({...prev, [facetName]: !prev[facetName]}));
    };

    const coverageColors: Record<FacetResult['coverage'], string> = {
        direct: "bg-success/20 text-success border-success",
        indirect: "bg-warning/20 text-warning border-warning",
        none: "bg-error/20 text-error border-error"
    };

    return (
        <div className="text-xs">
            <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-md border border-secondary/10 dark:border-primary/10">
                <h5 className="font-bold mb-1">Overall Assessment</h5>
                <p className="italic">{result.overall_assessment}</p>
            </div>
            <div className="space-y-2 mt-3">
                {(Object.entries(result.facet_results) as [string, FacetResult][]).map(([name, facet]) => (
                    <div key={name} className="bg-light-bg dark:bg-dark-bg rounded-md border border-secondary/10 dark:border-primary/10">
                        <button onClick={() => toggleFacet(name)} className="w-full flex justify-between items-center p-2 text-left">
                            <h6 className="font-bold capitalize">{name.replace(/_/g, ' ')}</h6>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${coverageColors[facet.coverage]}`}>{facet.coverage}</span>
                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${openFacets[name] ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        {openFacets[name] && (
                            <div className="p-3 border-t border-secondary/10 dark:border-primary/10 space-y-3">
                                {facet.note_if_missing && (
                                    <div className="p-2 rounded-md bg-warning/10 text-warning border-l-4 border-warning">
                                        <p className="font-bold">Note on Missing Info:</p>
                                        <p>{facet.note_if_missing}</p>
                                    </div>
                                )}
                                {facet.claims.map((claim, i) => (
                                     <div key={i} className="p-2 rounded-md bg-light-surface dark:bg-dark-surface">
                                         <p><span className="font-semibold">Claim:</span> {claim.summary}</p>
                                         <p><span className="font-semibold">Confidence:</span> <span className="capitalize">{claim.confidence}</span></p>
                                         <p><span className="font-semibold">Sources:</span> {claim.source_ids.join(', ')}</p>
                                     </div>
                                ))}
                                <div>
                                    <p className="font-semibold">Search Process:</p>
                                    <ul className="list-disc list-inside pl-2 font-mono text-light-text/70 dark:text-dark-text/70 text-[10px]">
                                        {facet.tried.queries.map((q, i) => <li key={i}>{q}</li>)}
                                        {facet.tried.auxiliary.map((a, i) => <li key={i}>Checked: {a}</li>)}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};


const ResultsTab: React.FC<{ 
    job: ResearchJob; 
    updateJob: (job: ResearchJob) => void;
    handleFollowUpChat: (jobId: string, question: string) => Promise<void>;
}> = ({ job, updateJob, handleFollowUpChat }) => {
    const view = job.resultsView || 'report';
    const [followUpInput, setFollowUpInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [job.answererResult?.markdown_body, job.followUpHistory]);

    useEffect(() => {
        if (chatInputRef.current) {
            chatInputRef.current.style.height = 'auto';
            chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
        }
    }, [followUpInput]);

    const handleSendFollowUp = async () => {
        if (!followUpInput.trim() || isChatting) return;

        const question = followUpInput.trim();
        setIsChatting(true);
        setFollowUpInput('');

        await handleFollowUpChat(job.id, question);

        setIsChatting(false);
    };

    const handleViewChange = (newView: 'report' | 'matrix') => {
        if (job.status === 'Complete') {
            updateJob({ ...job, resultsView: newView });
        }
    };

    if (job.status !== 'Complete' || !job.answererResult) {
        return <div className="text-center p-8"><p>Research is not yet complete.</p></div>;
    }

    const { answer, markdown_body, theme_confidences, high_value_sources, next_steps } = job.answererResult;

    const { sources, themes } = useMemo(() => mapJobToMatrixData(job), [job]);

    const fullMarkdownReport = `${answer}\n\n${markdown_body}`;

    const downloadMarkdown = () => {
        const blob = new Blob([fullMarkdownReport], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.title.replace(/ /g, '_')}_answer.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const copyMarkdown = () => {
        navigator.clipboard.writeText(fullMarkdownReport);
    };

    const [isHvSourcesVisible, setIsHvSourcesVisible] = useState(false);
    const [isDeepResearchVisible, setIsDeepResearchVisible] = useState(false);


    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div role="tablist" className="tabs tabs-boxed bg-light-surface dark:bg-dark-surface p-1">
                    <a role="tab" className={`tab text-sm ${view === 'report' ? 'tab-active !bg-secondary !text-dark-text' : ''}`} onClick={() => handleViewChange('report')}>Answer</a>
                    <a role="tab" className={`tab text-sm ${view === 'matrix' ? 'tab-active !bg-secondary !text-dark-text' : ''}`} onClick={() => handleViewChange('matrix')}>Comparison Matrix</a>
                </div>
                {view === 'report' && (
                    <div className="flex gap-2">
                        <button onClick={copyMarkdown} className="bg-light-surface dark:bg-dark-surface border border-secondary/20 dark:border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/10 font-bold py-2 px-4 rounded-md text-sm">Copy Answer</button>
                        <button onClick={downloadMarkdown} className="bg-secondary hover:bg-secondary/90 text-dark-text font-bold py-2 px-4 rounded-md text-sm">Download .md</button>
                    </div>
                )}
            </div>
            
            <div className="flex-grow overflow-hidden">
                {view === 'report' ? (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        <div className="lg:col-span-2 bg-light-surface dark:bg-dark-surface rounded-lg p-6 h-full overflow-y-auto break-words flex flex-col">
                            <div>
                                <h3 className="text-2xl font-bold mb-2">Answer:</h3>
                                <p className="text-lg font-bold mb-4 border-b border-secondary/10 dark:border-primary/10 pb-4">{answer}</p>
                                <div className="prose dark:prose-invert max-w-none prose-pre:bg-light-bg dark:prose-pre:bg-dark-bg">
                                    <ReactMarkdown>{markdown_body}</ReactMarkdown>
                                </div>
                            </div>
                            
                            {/* Follow-up Chat Section */}
                            <div className="flex-grow flex flex-col mt-6 pt-6 border-t border-secondary/10 dark:border-primary/10 min-h-[200px]">
                                <div className="flex-grow overflow-y-auto pr-2 space-y-4 mb-4">
                                    {job.followUpHistory.map((msg, index) => (
                                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-lg p-3 rounded-lg break-words whitespace-pre-wrap ${msg.role === 'user' ? 'bg-secondary text-dark-text' : 'bg-light-bg dark:bg-dark-bg border border-secondary/10 dark:border-primary/10'}`}>
                                                <p className="text-sm">{msg.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {isChatting && (
                                        <div className="flex justify-start">
                                            <div className="max-w-lg p-3 rounded-lg bg-light-bg dark:bg-dark-bg">
                                                <span className="animate-pulse">Thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                                <div className="flex gap-2">
                                    <textarea
                                        ref={chatInputRef}
                                        rows={1}
                                        value={followUpInput}
                                        onChange={(e) => setFollowUpInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendFollowUp();
                                            }
                                        }}
                                        placeholder="Ask a follow-up question..."
                                        disabled={isChatting}
                                        className="flex-grow bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 focus:ring-primary focus:border-primary resize-none overflow-y-auto disabled:opacity-50"
                                    />
                                     <button onClick={handleSendFollowUp} disabled={isChatting || !followUpInput.trim()} className="bg-primary hover:bg-primary/90 text-secondary font-bold py-2 px-4 rounded-md disabled:bg-light-text/20 dark:disabled:bg-dark-text/20 self-end">
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-1 bg-light-surface dark:bg-dark-surface rounded-lg p-4 h-full overflow-y-auto flex flex-col gap-4">
                             <div>
                                <h4 className="font-bold mb-2">Theme Confidence</h4>
                                <div className="space-y-2 text-xs">
                                    {theme_confidences?.map((tc, i) => (
                                        <div key={i} className="bg-light-bg dark:bg-dark-bg border-l-4 p-2 rounded-r-md" style={{borderColor: tc.confidence === 'high' ? 'var(--tw-color-success)' : tc.confidence === 'medium' ? 'var(--tw-color-warning)' : 'var(--tw-color-error)'}}>
                                            <p className="font-bold">{tc.theme}</p>
                                            <p className="text-light-text/80 dark:text-dark-text/80">{tc.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             {job.deepResearchResult && (
                                <div>
                                    <button onClick={() => setIsDeepResearchVisible(!isDeepResearchVisible)} className="w-full flex justify-between items-center font-bold">
                                        <span>Deep Research Log</span>
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isDeepResearchVisible ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isDeepResearchVisible && (
                                        <div className="mt-2">
                                            <DeepResearchReport result={job.deepResearchResult} />
                                        </div>
                                    )}
                                </div>
                            )}
                            <div>
                                <button onClick={() => setIsHvSourcesVisible(!isHvSourcesVisible)} className="w-full flex justify-between items-center font-bold">
                                    <span>High-Value Source Analysis</span>
                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isHvSourcesVisible ? 'rotate-180' : ''}`} />
                                </button>
                                {isHvSourcesVisible && (
                                    <div className="space-y-2 text-xs mt-2">
                                        {high_value_sources?.map((hvs, i) => (
                                            <div key={i} className="bg-light-bg dark:bg-dark-bg p-2 rounded-md border border-secondary/10 dark:border-primary/10">
                                                <p className="font-bold">{hvs.id}: {job.evidence?.find(e => e.id === hvs.id)?.title || 'Unknown Source'}</p>
                                                <p className="text-light-text/80 dark:text-dark-text/80 italic">Why: {hvs.why}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h4 className="font-bold mb-2">Sources</h4>
                                <div className="space-y-3 text-xs">
                                    {job.evidence?.map((e, i) => (
                                        <div key={e.id} className="bg-light-bg dark:bg-dark-bg border border-secondary/10 dark:border-primary/10 p-2 rounded-md">
                                            <p className="font-bold flex items-center gap-2">
                                                {e.source_id === 'wolfram' && <WolframIcon className="w-4 h-4 text-primary" title="Source: Wolfram|Alpha"/>}
                                                <span>[S{i+1}] {e.title}</span>
                                            </p>
                                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">{e.url}</a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <ComparisonMatrix sources={sources} themes={themes} />
                )}
            </div>
        </div>
    );
};

// --- Orchestration Components ---

const MiniLog: React.FC<{ events: TraceEvent[] }> = ({ events }) => (
    <div className="mt-2 pt-2 border-t border-secondary/10 dark:border-primary/10 max-h-32 overflow-y-auto">
        <ul className="space-y-1 text-xs text-light-text/70 dark:text-dark-text/70">
            {events.map((event, index) => (
                <li key={index} className="flex gap-2">
                    <span className="font-mono">{new Date(event.start_ts).toLocaleTimeString()}</span>
                    <span>-</span>
                    <span className="flex-1">{event.summary}</span>
                </li>
            ))}
        </ul>
    </div>
);

const OrchestrationStepCard: React.FC<{ 
    step: ExecutionStep, 
    stepEvents: TraceEvent[],
    isSelected: boolean,
    onSelect: () => void 
}> = ({ step, stepEvents, isSelected, onSelect }) => {
    
    const [isLogVisible, setIsLogVisible] = useState(false);
    const latestEvent = stepEvents[stepEvents.length - 1] || {};

    const statusIcons: Record<string, React.ReactNode> = {
        Pending: <div className="w-3 h-3 rounded-full bg-light-text/40 dark:bg-dark-text/40 animate-pulse"></div>,
        Running: <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />,
        Completed: <CheckCircleIcon className="w-5 h-5 text-green-500 animate-pop-in" />,
        Failed: <ExclamationTriangleIcon className="w-5 h-5 text-error" />,
        CORS_BLOCKED: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />,
    };
    
    const tooltipContent = (
        <div className="p-1 text-left">
            <p><strong>Agent:</strong> {latestEvent.agent || 'N/A'}</p>
            <p><strong>Model:</strong> {latestEvent.model || 'N/A'}</p>
            <p><strong>Status:</strong> {step.status}</p>
            <p className="mt-1 pt-1 border-t border-dark-text/20"><em>{latestEvent.summary}</em></p>
        </div>
    );

    return (
        <div onClick={onSelect} className={`bg-light-bg dark:bg-dark-bg p-3 rounded-md border-l-4 ${isSelected ? 'border-secondary' : 'border-primary/50'} cursor-pointer hover:border-secondary transition-all`}>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 min-w-0">
                    <Tooltip content={tooltipContent}>
                       {statusIcons[step.status]}
                    </Tooltip>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{step.action.replace('_', ' ')}</p>
                      <p className="text-sm text-light-text/70 dark:text-dark-text/70 truncate">{latestEvent.summary || step.specialist_instructions || '...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {latestEvent.fallback_used && <span className="text-xs bg-yellow-400/20 text-yellow-600 dark:text-yellow-300 px-2 py-0.5 rounded-full">Fallback</span>}
                    {step.duration && <span className="text-xs text-light-text/60 dark:text-dark-text/60">{step.duration/1000}s</span>}
                    {stepEvents.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setIsLogVisible(!isLogVisible); }} className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isLogVisible ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            </div>
            {isLogVisible && <MiniLog events={stepEvents} />}
        </div>
    );
};

const SnapshotViewer: React.FC<{ title: string, data: any }> = ({ title, data }) => {
    const [copied, setCopied] = useState(false);
    if (!data) return null;

    const copyToClipboard = () => {
        const textToCopy = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    let content: React.ReactNode;
    if (typeof data === 'object') {
        content = (
            <div className="relative">
                <pre className="text-[11px] bg-black/5 dark:bg-black/20 p-2 rounded mt-1 max-h-60 overflow-y-auto">{JSON.stringify(data, null, 2)}</pre>
                <button onClick={copyToClipboard} className="absolute top-2 right-2 p-1 bg-light-surface dark:bg-dark-surface rounded-md hover:bg-primary/20">
                    {copied ? <CheckCircleIcon className="w-4 h-4 text-success" /> : <ClipboardIcon className="w-4 h-4" />}
                </button>
            </div>
        );
    } else {
        content = <p className="text-sm whitespace-pre-wrap break-all">{String(data)}</p>;
    }

    return (
        <div>
            <h5 className="font-bold text-sm mt-3">{title}</h5>
            {content}
        </div>
    );
}


const DetailPanel: React.FC<{ 
    step: ExecutionStep | undefined;
    event: TraceEvent | undefined;
    onRetry: () => void;
    onManualIngest: (content: string) => Promise<void>;
}> = ({ step, event, onRetry, onManualIngest }) => {
    const [pastedContent, setPastedContent] = useState('');
    const [isIngesting, setIsIngesting] = useState(false);

    const handleIngestSubmit = async () => {
        if (!pastedContent.trim()) return;
        setIsIngesting(true);
        try {
            await onManualIngest(pastedContent);
        } finally {
            setIsIngesting(false);
            setPastedContent('');
        }
    };
    
    if (!step) {
        return <div className="text-center p-4 text-sm text-light-text/60 dark:text-dark-text/60">Select a step to see details.</div>;
    }

    const isFailed = step.status === 'Failed';
    const isCorsBlocked = step.status === 'CORS_BLOCKED';

    return (
         <div className="p-4 h-full flex flex-col">
            <h4 className="font-bold text-lg mb-2 truncate">Details: {step.id}</h4>
            <div className="flex-grow overflow-y-auto">
                <div className="text-sm space-y-1">
                    <p><strong>Status:</strong> <span className={isFailed ? 'text-error' : isCorsBlocked ? 'text-warning' : event?.status === 'success' ? 'text-success' : ''}>{step.status.toUpperCase()}</span></p>
                    <p><strong>Agent:</strong> {event?.agent || step.agent}</p>
                    <p><strong>Model:</strong> {event?.model || 'N/A'}</p>
                    <p><strong>Duration:</strong> {step.duration ? `${step.duration/1000}s` : 'N/A'}</p>
                </div>
                {event?.error && !isCorsBlocked && (
                    <div className="mt-4">
                        <h5 className="font-bold text-sm text-error">Error</h5>
                        <p className="text-sm text-error/80 whitespace-pre-wrap break-words font-mono bg-error/10 p-2 rounded mt-1">{event.error}</p>
                    </div>
                )}
                {event?.recommendation && (
                     <div className="mt-4">
                        <h5 className="font-bold text-sm text-warning">Recommendation</h5>
                        <p className="text-sm text-warning/80">{event.recommendation}</p>
                    </div>
                )}
                <SnapshotViewer title="Input" data={event?.input_snapshot} />
                <SnapshotViewer title="Output" data={event?.output_snapshot} />
            </div>
            {(isFailed || isCorsBlocked) && (
                <div className="mt-4 pt-4 border-t border-secondary/10 dark:border-primary/10">
                    {isCorsBlocked ? (
                        <div className="flex flex-col">
                            <div className="text-sm bg-yellow-400/10 text-yellow-500 p-3 rounded-md mb-4">
                                <p><strong>URL blocked (CORS):</strong> <span className="font-mono break-all">{event?.input_snapshot?.url}</span></p>
                                <p className="mt-2">To proceed, please manually copy the content from the page and paste it below.</p>
                            </div>
                            <label htmlFor="pasted-content" className="font-medium text-sm mb-1">Pasted Content</label>
                            <textarea
                                id="pasted-content"
                                value={pastedContent}
                                onChange={(e) => setPastedContent(e.target.value)}
                                placeholder="Paste the full text content of the webpage here..."
                                className="h-32 w-full bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 mt-1 focus:ring-primary focus:border-primary"
                                disabled={isIngesting}
                            />
                            <button onClick={handleIngestSubmit} disabled={isIngesting || !pastedContent.trim()} className="w-full bg-primary hover:bg-primary/90 text-secondary font-bold py-2 px-4 rounded-md mt-4 disabled:opacity-50">
                                {isIngesting ? 'Processing...' : 'Submit Content & Continue'}
                            </button>
                        </div>
                    ) : (
                         <button onClick={onRetry} className="w-full bg-primary hover:bg-primary/90 text-secondary font-bold py-2 px-4 rounded-md">
                            Retry Step
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

const OrchestrationTab: React.FC<{
    job: ResearchJob;
    updateJob: (job: ResearchJob) => void;
    traceLog: TraceEvent[];
    executePlan: (resume?: boolean, stepId?: string) => void;
    onManualIngest: (step: ExecutionStep, content: string) => Promise<void>;
}> = ({ job, updateJob, traceLog, executePlan, onManualIngest }) => {
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});

    const phases = useMemo(() => {
        if (!job.plan) return [];
        const phaseMap: Record<string, ExecutionStep[]> = {};
        job.plan.steps.forEach(step => {
            const phaseName = step.action;
            if (!phaseMap[phaseName]) phaseMap[phaseName] = [];
            phaseMap[phaseName].push(step);
        });
        return Object.entries(phaseMap).map(([name, steps]) => ({ name: name as ExecutionStep['action'], steps }));
    }, [job.plan]);

    if (!job.plan) {
        return <div className="text-center p-8"><p>No execution plan generated yet.</p></div>;
    }

    const isExecuting = ['Running', 'Comparing', 'Answering', 'Synthesizing', 'Planning'].includes(job.status);
    const totalSteps = job.plan.steps.length;
    const completedSteps = job.plan.steps.filter(s => s.status === 'Completed').length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    
    const runningStep = job.plan.steps.find(s => s.status === 'Running');
    const runningStepEvent = runningStep ? traceLog.slice().reverse().find(e => e.step_id === runningStep.id) : undefined;
    const nextStep = job.plan.steps.find(s => s.status === 'Pending');
    
    const selectedStep = job.plan.steps.find(s => s.id === selectedStepId);
    const selectedEvent = traceLog.slice().reverse().find(e => e.step_id === selectedStepId);

    const handleRetryStep = (stepId?: string) => {
        if (!stepId) return;
        
        const newSteps = job.plan!.steps.map(s =>
            s.id === stepId ? { ...s, status: 'Pending' as const, result: undefined, duration: undefined } : s
        );
        updateJob({ ...job, plan: { ...job.plan!, steps: newSteps }, status: 'Running', lastError: undefined });
        executePlan(true, stepId); // Resume execution from a specific step
    };

    const handleManualIngest = async (content: string) => {
        if (!selectedStep) return;
        await onManualIngest(selectedStep, content);
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto pr-2">
                {/* Header & Progress */}
                <div className="p-4 bg-light-surface dark:bg-dark-surface rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-bold">Execution Plan</h3>
                        <button onClick={() => executePlan()} disabled={isExecuting || job.status === 'Complete'} className="bg-primary hover:bg-primary/90 text-secondary font-bold py-2 px-4 rounded-md disabled:bg-light-text/20 dark:disabled:bg-dark-text/20">
                            {isExecuting ? `Running...` : 'Execute Plan'}
                        </button>
                    </div>
                     <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-2.5">
                        <div className="bg-success h-2.5 rounded-full" style={{width: `${progress}%`}}></div>
                    </div>
                    <div className="text-sm mt-2 text-light-text/80 dark:text-dark-text/80 h-5 flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                            {runningStep ? (
                                <>
                                    <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />
                                    <span className="font-semibold">Running:</span>
                                    <span className="truncate">{runningStep.action} – {runningStepEvent?.summary || '...'}</span>
                                </>
                            ) : isExecuting ? (
                                <>
                                    <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />
                                    <span className="font-semibold">Preparing...</span>
                                </>
                            ) : job.status === 'Complete' ? (
                                <>
                                    <CheckCircleIcon className="w-4 h-4 text-success" />
                                    <span className="font-semibold">Execution Complete</span>
                                </>
                            ) : job.status === 'Error' ? (
                                <>
                                    <ExclamationTriangleIcon className="w-4 h-4 text-error" />
                                    <span className="font-semibold">Execution Failed</span>
                                </>
                            ) : (
                                <span className="text-light-text/60 dark:text-dark-text/60">Ready to execute plan.</span>
                            )}
                        </div>
                        {nextStep && job.status !== 'Complete' && job.status !== 'Error' && (
                            <span className="text-light-text/60 dark:text-dark-text/60">Up next: <span className="font-semibold">{nextStep.action}</span></span>
                        )}
                    </div>
                    <div className="text-xs text-light-text/60 dark:text-dark-text/60 mt-1">
                        {completedSteps} of {totalSteps} steps complete
                    </div>
                </div>

                {/* Phases and Steps */}
                <div className="space-y-4">
                {phases.map(phase => (
                    <div key={phase.name} className="bg-light-surface dark:bg-dark-surface rounded-lg">
                        <button onClick={() => setCollapsedPhases(p => ({...p, [phase.name]: !p[phase.name]}))} className="w-full flex justify-between items-center p-3 text-left">
                            <h4 className="text-lg font-bold capitalize">{phase.name.replace(/_/g, ' ')} ({phase.steps.length})</h4>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${collapsedPhases[phase.name] ? 'rotate-180' : ''}`} />
                        </button>
                        {!collapsedPhases[phase.name] && (
                            <div className="p-3 space-y-3 border-t border-secondary/10 dark:border-primary/10">
                                {phase.steps.map(step => (
                                    <OrchestrationStepCard
                                        key={step.id}
                                        step={step}
                                        stepEvents={traceLog.filter(e => e.step_id === step.id)}
                                        isSelected={selectedStepId === step.id}
                                        onSelect={() => setSelectedStepId(step.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                </div>
            </div>
             <div className="lg:col-span-1 bg-light-surface dark:bg-dark-surface rounded-lg h-full overflow-y-auto">
                <DetailPanel step={selectedStep} event={selectedEvent} onRetry={() => handleRetryStep(selectedStepId || undefined)} onManualIngest={handleManualIngest} />
            </div>
        </div>
    );
};



// --- Main Content Area ---
interface MainContentProps {
  job: ResearchJob | null;
  updateJob: (job: ResearchJob) => void;
  setJobStatus: (id: string, status: ResearchJob['status']) => void;
  generatePlan: (jobId: string) => void;
  traceLog: TraceEvent[];
  logTrace: (event: Omit<TraceEvent, 'start_ts'> & {start_ts?: number}) => void;
  executePlan: (job: ResearchJob, resume?: boolean, stepId?: string) => void;
  manualIngest: (job: ResearchJob, step: ExecutionStep, content: string) => Promise<void>;
  handleFollowUpChat: (jobId: string, question: string) => Promise<void>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const MainContent: React.FC<MainContentProps> = ({ job, updateJob, setJobStatus, generatePlan, traceLog, logTrace, executePlan, manualIngest, handleFollowUpChat, theme, toggleTheme }) => {
    type View = 'scope' | 'orchestration' | 'results';
    const [activeView, setActiveView] = useState<View>('scope');

    useEffect(() => {
        if (job?.status === 'Complete' || job?.status === 'Answering') {
            setActiveView('results');
        } else if (job?.plan) {
            setActiveView('orchestration');
        } else {
            setActiveView('scope');
        }
    }, [job]);

    if (!job) {
        return <div className="flex-grow flex items-center justify-center text-light-text/60 dark:text-dark-text/60">Select a job or create a new one to start.</div>;
    }
    
    const handleSetJobStatus = (status: ResearchJob['status']) => setJobStatus(job.id, status);

    const handleManualIngest = async (step: ExecutionStep, content: string) => {
        if (!job) return;
        await manualIngest(job, step, content);
    }

    const isPlanReady = job.brief && job.brief.objective && job.brief.key_questions.length > 0;

    const handleSelectView = (view: View) => {
        // Prevent navigating away from scope if plan doesn't exist, etc.
        if (view === 'orchestration' && !job.plan) return;
        if (view === 'results' && job.status !== 'Complete') return;
        setActiveView(view);
    }

  return (
    <div className="flex-grow flex flex-col p-6 bg-light-bg dark:bg-dark-bg h-screen overflow-hidden">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold">{job.title}</h2>
            <div className="flex items-center gap-4">
                {activeView === 'scope' && (
                     <div className="relative group">
                        <button 
                            onClick={() => generatePlan(job.id)} 
                            disabled={!isPlanReady || job.status === 'Planning'}
                            className="bg-secondary hover:bg-secondary/90 text-dark-text font-bold py-2 px-4 rounded-md disabled:bg-light-text/20 dark:disabled:bg-dark-text/20 disabled:cursor-not-allowed">
                             {job.status === 'Planning' ? 'Generating...' : 'Generate Plan'}
                        </button>
                        {!isPlanReady && (
                            <div className="absolute bottom-full right-0 mb-2 w-max max-w-[250px] bg-secondary text-dark-text text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 shadow-lg border border-primary/20">
                              Please provide an objective and at least one key question to enable plan generation.
                            </div>
                        )}
                     </div>
                )}
                <button
                    onClick={toggleTheme}
                    className="p-2 bg-light-surface dark:bg-dark-surface hover:bg-light-surface/80 dark:hover:bg-dark-surface/80 rounded-md transition-colors duration-200 border border-secondary/10 dark:border-primary/10"
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
      
      <div className="mb-4">
          <JobTimeline job={job} activeView={activeView} onSelectView={handleSelectView} />
      </div>

      <div className="flex-grow overflow-y-auto">
        {activeView === 'scope' && <ScopeTab job={job} updateJob={updateJob} />}
        {activeView === 'orchestration' && <OrchestrationTab job={job} updateJob={updateJob} traceLog={traceLog} executePlan={(resume, stepId) => executePlan(job, resume, stepId)} onManualIngest={handleManualIngest} />}
        {activeView === 'results' && <ResultsTab job={job} updateJob={updateJob} handleFollowUpChat={handleFollowUpChat} />}
      </div>
    </div>
  );
};

export default MainContent;
