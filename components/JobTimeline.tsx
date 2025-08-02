import React from 'react';
import { loadJobVersions } from '../store/jobs';

interface Props {
  jobId: string;
}

const JobTimeline: React.FC<Props> = ({ jobId }) => {
  const versions = loadJobVersions(jobId);
  return (
    <ol data-testid="timeline">
      {versions.map((v) => (
        <li key={v.version}>
          v{v.version} - {v.snapshot.status} ({new Date(v.timestamp).toISOString()})
        </li>
      ))}
    </ol>
  );
};

export default JobTimeline;
