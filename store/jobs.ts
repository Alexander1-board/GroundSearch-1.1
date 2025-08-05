import { ResearchBrief, Job, JobVersion, JobSnapshot, JobStatus } from '../types';
import { EMPTY_BRIEF } from '../constants';

const memory: Record<string, JobVersion[]> = {};

function jobKey(id: string) {
  return `job_${id}`;
}

function loadVersions(id: string): JobVersion[] {
  if (!memory[id]) {
    try {
      const raw = localStorage.getItem(jobKey(id));
      memory[id] = raw ? (JSON.parse(raw) as JobVersion[]) : [];
    } catch {
      memory[id] = [];
    }
  }
  return memory[id];
}

function persist(id: string) {
  try {
    localStorage.setItem(jobKey(id), JSON.stringify(memory[id]));
  } catch {
    /* noop */
  }
}

export function createJob(id: string): Job {
  const versions = loadVersions(id);
  if (versions.length === 0) {
    const initial: JobVersion = {
      version: 1,
      timestamp: Date.now(),
      snapshot: {
        prePrompt: '',
        brief: { ...EMPTY_BRIEF },
        status: 'Draft',
      },
    };
    memory[id] = [initial];
    persist(id);
  }
  return { id, versions: memory[id] };
}

export function loadJob(id: string): JobSnapshot {
  createJob(id);
  const versions = loadVersions(id);
  return versions[versions.length - 1].snapshot;
}

export function saveJobVersion(id: string, update: Partial<JobSnapshot>): void {
  const versions = loadVersions(id);
  const prev: JobSnapshot = versions.length
    ? versions[versions.length - 1].snapshot
    : { prePrompt: '', brief: { ...EMPTY_BRIEF }, status: 'Draft' as JobStatus };
  const snapshot: JobSnapshot = { ...prev, ...update };
  const version: JobVersion = {
    version: versions.length + 1,
    timestamp: Date.now(),
    snapshot,
  };
  versions.push(version);
  memory[id] = versions;
  persist(id);
}

export function loadJobVersions(id: string): JobVersion[] {
  return loadVersions(id);
}

export function deleteJob(id: string) {
  delete memory[id];
  try {
    localStorage.removeItem(jobKey(id));
  } catch {
    /* noop */
  }
}

export function cloneJob(
  originalId: string,
  newId: string,
  diffBrief?: Partial<ResearchBrief>,
): Job {
  const orig = loadJob(originalId);
  const snapshot: JobSnapshot = {
    ...orig,
    brief: diffBrief ? { ...orig.brief, ...diffBrief } : orig.brief,
    status: 'Draft',
  };
  const version: JobVersion = { version: 1, timestamp: Date.now(), snapshot };
  memory[newId] = [version];
  persist(newId);
  return { id: newId, versions: memory[newId] };
}

export function loadBrief(jobId: string): ResearchBrief {
  return loadJob(jobId).brief;
}

export function saveBrief(jobId: string, brief: ResearchBrief) {
  saveJobVersion(jobId, { brief });
}

export function loadPrePrompt(jobId: string): string {
  const snap = loadJob(jobId);
  if (snap.prePrompt) return snap.prePrompt;
  try {
    const raw = localStorage.getItem(`preprompt_${jobId}`);
    if (raw) {
      saveJobVersion(jobId, { prePrompt: raw });
      return raw;
    }
  } catch {
    /* noop */
  }
  return '';
}

export function savePrePrompt(jobId: string, text: string) {
  try {
    if (text) localStorage.setItem(`preprompt_${jobId}`, text);
    else localStorage.removeItem(`preprompt_${jobId}`);
  } catch {
    /* noop */
  }
  saveJobVersion(jobId, { prePrompt: text });
}

export function resetBrief(jobId: string) {
  saveBrief(jobId, { ...EMPTY_BRIEF });
}
