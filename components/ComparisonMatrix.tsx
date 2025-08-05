import React, { useState, useMemo } from 'react';
import {
  SupportIcon,
  ContraIcon,
  NeutralIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  WolframIcon,
} from './icons';

// --- PROPS as per specification ---
interface ComparisonMatrixProps {
  sources: Array<{ id: string; title: string; source_id: string }>;
  themes: Array<{
    id: string;
    label: string;
    relations: Array<{
      sourceId: string;
      relation: 'supports' | 'contradicts' | 'neutral';
      quant_score?: number;
      note?: string;
    }>;
  }>;
  minScore?: number; // default 0
}

// Typed relation for clarity
type ThemeRelation = ComparisonMatrixProps['themes'][0]['relations'][0];

// --- SUB-COMPONENTS ---

const RelationIcon: React.FC<{ relation: 'supports' | 'contradicts' | 'neutral' }> = ({
  relation,
}) => {
  const iconMap = {
    supports: <SupportIcon className="h-5 w-5 text-success" />,
    contradicts: <ContraIcon className="h-5 w-5 text-error" />,
    neutral: <NeutralIcon className="h-5 w-5 text-info" />,
  };
  const titleMap = {
    supports: 'Supports',
    contradicts: 'Contradicts',
    neutral: 'Neutral / Insufficient',
  };
  // The span wrapper handles the tooltip as requested
  return <span title={titleMap[relation]}>{iconMap[relation]}</span>;
};

const MatrixLegend: React.FC = () => (
  <div className="flex items-center justify-center flex-wrap gap-x-6 gap-y-2 text-xs text-light-text/80 dark:text-dark-text/80 bg-light-bg dark:bg-dark-bg p-2 rounded-md border border-secondary/10 dark:border-primary/10">
    <span className="font-bold">Legend:</span>
    <div className="flex items-center gap-1.5">
      <SupportIcon className="h-4 w-4 text-success" />
      <span>Supports</span>
    </div>
    <div className="flex items-center gap-1.5">
      <ContraIcon className="h-4 w-4 text-error" />
      <span>Contradicts</span>
    </div>
    <div className="flex items-center gap-1.5">
      <NeutralIcon className="h-4 w-4 text-info" />
      <span>Neutral</span>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  sources = [],
  themes = [],
  minScore = 0,
}) => {
  const [selectedThemeId, setSelectedThemeId] = useState<string>('all');
  const [scoreThreshold, setScoreThreshold] = useState<number>(minScore);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const sourceMap = useMemo(
    () => new Map(sources.map((s, i) => [s.id, { ...s, citationLabel: `[S${i + 1}]` }])),
    [sources],
  );

  const availableThemes = useMemo(
    () => themes.map((t) => ({ id: t.id, label: t.label })),
    [themes],
  );

  // This is the core optimization. It filters and sorts the data once,
  // and creates a Map for O(1) lookup for the grid view.
  const processedThemes = useMemo(() => {
    return themes
      .filter((theme) => selectedThemeId === 'all' || theme.id === selectedThemeId)
      .map((theme) => {
        const relations = theme.relations
          .filter((r) => (r.quant_score ?? -1) >= scoreThreshold)
          .sort((a, b) => {
            const scoreA = a.quant_score ?? -1;
            const scoreB = b.quant_score ?? -1;
            return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
          });

        // Create a Map for O(1) lookup, which is much faster than `find` for the grid view.
        const relationsMap = new Map<string, ThemeRelation>(relations.map((r) => [r.sourceId, r]));

        return {
          ...theme,
          relations, // The sorted/filtered list for the card view
          relationsMap, // The map for fast lookup in the grid view
        };
      })
      .filter((theme) => theme.relations.length > 0); // Hide themes with no matching relations after filtering
  }, [themes, selectedThemeId, scoreThreshold, sortOrder]);

  return (
    <div className="flex flex-col h-full bg-light-surface dark:bg-dark-surface rounded-lg">
      {/* Controls & Legend */}
      <div className="p-4 border-b border-secondary/10 dark:border-primary/10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="theme-filter"
              className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80"
            >
              Filter by Theme
            </label>
            <select
              id="theme-filter"
              value={selectedThemeId}
              onChange={(e) => setSelectedThemeId(e.target.value)}
              className="w-full bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 rounded-md p-2 mt-1 focus:ring-primary focus:border-primary"
              aria-label="Filter by theme"
            >
              <option value="all">All Themes</option>
              {availableThemes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="score-filter"
              className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80"
            >
              Min Score: {scoreThreshold}
            </label>
            <input
              id="score-filter"
              type="range"
              min="0"
              max="100"
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(Number(e.target.value))}
              className="w-full h-2 bg-light-bg dark:bg-dark-bg rounded-lg appearance-none cursor-pointer mt-2 accent-primary"
              aria-label="Filter by minimum score"
            />
          </div>
          <div className="min-w-[160px]">
            <button
              onClick={() => setSortOrder((p) => (p === 'desc' ? 'asc' : 'desc'))}
              className="w-full flex items-center justify-center gap-2 bg-light-bg dark:bg-dark-bg border border-secondary/20 dark:border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/10 font-bold py-2 px-4 rounded-md"
              aria-label={`Sort by score ${sortOrder === 'desc' ? 'descending' : 'ascending'}`}
            >
              Sort by Score{' '}
              {sortOrder === 'desc' ? (
                <ChevronDownIcon className="w-5 h-5" />
              ) : (
                <ChevronUpIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <MatrixLegend />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-auto p-4">
        {processedThemes.length === 0 ? (
          <div className="text-center text-light-text/60 dark:text-dark-text/60 mt-10">
            <p>No results match the current filters.</p>
          </div>
        ) : (
          <>
            {/* Wide screen: Matrix View */}
            <div
              className="hidden lg:grid"
              style={{
                gridTemplateColumns: `minmax(200px, 1.5fr) repeat(${sources.length}, minmax(100px, 1fr))`,
                gap: '4px',
              }}
            >
              <div className="font-bold p-2 sticky top-0 bg-light-surface dark:bg-dark-surface z-10 border-b-2 border-primary">
                Themes
              </div>
              {sources.map((source, i) => (
                <div
                  key={source.id}
                  title={source.title}
                  className="font-bold p-2 sticky top-0 bg-light-surface dark:bg-dark-surface z-10 border-b-2 border-primary truncate text-center cursor-help flex items-center justify-center gap-1"
                >
                  {source.source_id === 'wolfram' && (
                    <WolframIcon className="w-4 h-4 text-primary" />
                  )}
                  {`[S${i + 1}]`}
                </div>
              ))}

              {processedThemes.map((theme) => (
                <React.Fragment key={theme.id}>
                  <div className="font-bold p-3 flex items-center bg-light-bg dark:bg-dark-bg rounded-l-md">
                    {theme.label}
                  </div>
                  {sources.map((source, i) => {
                    // O(1) lookup instead of O(n) find()
                    const relation = theme.relationsMap.get(source.id);
                    const isContradiction = relation?.relation === 'contradicts';
                    const isLastColumn = i === sources.length - 1;
                    return (
                      <div
                        key={source.id}
                        className={`p-2 flex items-center justify-center bg-light-bg dark:bg-dark-bg ${isContradiction ? 'ring-2 ring-error/70' : ''} ${isLastColumn ? 'rounded-r-md' : ''}`}
                      >
                        {relation && (
                          <div
                            className="flex items-center gap-2 cursor-help"
                            title={relation.note || `Score: ${relation.quant_score}`}
                          >
                            <RelationIcon relation={relation.relation} />
                            <span className="font-semibold">{relation.quant_score}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Narrow screen: Card View */}
            <div className="space-y-8 lg:hidden">
              {processedThemes.map((theme) => (
                <div key={theme.id}>
                  <div className="flex justify-between items-baseline mb-4 pb-2 border-b border-secondary/10 dark:border-primary/10">
                    <h3 className="text-xl font-bold text-primary">{theme.label}</h3>
                    <span className="text-sm font-normal text-light-text/60 dark:text-dark-text/60">
                      {theme.relations.length} sources
                    </span>
                  </div>
                  <div className="space-y-4">
                    {theme.relations.map((relation) => {
                      const source = sourceMap.get(relation.sourceId);
                      if (!source) return null;

                      const isContradiction = relation.relation === 'contradicts';

                      const relationTextMap = {
                        supports: 'Supports',
                        contradicts: 'Contradicts',
                        neutral: 'Neutral',
                      };

                      const relationColorMap = {
                        supports: 'text-success',
                        contradicts: 'text-error',
                        neutral: 'text-info',
                      };

                      return (
                        <div
                          key={relation.sourceId}
                          className={`bg-light-bg dark:bg-dark-bg rounded-lg p-4 shadow-sm border-l-4 ${isContradiction ? 'border-error' : 'border-primary'}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-bold flex-1">{source.title}</p>
                            <div className="flex-shrink-0 flex items-center gap-2">
                              {source.source_id === 'wolfram' && (
                                <WolframIcon className="w-4 h-4 text-primary" />
                              )}
                              <span className="text-xs font-mono bg-secondary/10 dark:bg-primary/10 text-secondary dark:text-primary font-semibold px-2 py-1 rounded-full">
                                {source.citationLabel}
                              </span>
                            </div>
                          </div>

                          {relation.note && (
                            <p className="text-sm text-light-text/70 dark:text-dark-text/70 mt-2 pt-2 border-t border-secondary/5 dark:border-primary/5 italic">
                              "{relation.note}"
                            </p>
                          )}

                          <div className="flex justify-between items-end mt-3">
                            <div className={`flex items-center gap-1.5 text-sm font-semibold`}>
                              <RelationIcon relation={relation.relation} />
                              <span className={relationColorMap[relation.relation]}>
                                {relationTextMap[relation.relation]}
                              </span>
                            </div>
                            {relation.quant_score !== undefined && (
                              <div className="text-right">
                                <span className="text-xs text-light-text/70 dark:text-dark-text/70">
                                  Score
                                </span>
                                <p className="font-bold text-lg leading-none">
                                  {relation.quant_score}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComparisonMatrix;
