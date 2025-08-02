

import { ResearchJob, ThemeRelationDetails } from '../types';

interface MatrixSource {
    id: string;
    title: string;
    source_id: string;
}

interface MatrixThemeRelation {
    sourceId: string;
    relation: 'supports'|'contradicts'|'neutral';
    quant_score?: number;
    note?: string;
}

interface MatrixTheme {
    id: string;
    label: string;
    relations: MatrixThemeRelation[];
}

interface MatrixData {
    sources: MatrixSource[];
    themes: MatrixTheme[];
}

/**
 * Maps a ResearchJob object to the data structure required by the ComparisonMatrix component.
 * It normalizes data from the job's evidence and insightPackResult into a consistent
 * sources/themes format, ensuring the UI component remains decoupled from the API data structure.
 * @param job The ResearchJob object to map from.
 * @returns An object containing `sources` and `themes` arrays for the matrix.
 */
export function mapJobToMatrixData(job: ResearchJob | null): MatrixData {
    // Return empty state if job or necessary data is missing.
    if (!job || !job.evidence || !job.insightPackResult?.comparisonResult?.themes) {
        return { sources: [], themes: [] };
    }

    // The sources for the matrix are the pieces of evidence.
    const sources = job.evidence.map(e => ({ id: e.id, title: e.title, source_id: e.source_id }));
    
    // Create a map for quick lookup of evidence details by ID.
    const evidenceMap = new Map(job.evidence.map(e => [e.id, e]));

    // Transform the themes from the API result into the structure the matrix component needs.
    const themes = job.insightPackResult.comparisonResult.themes.map(apiTheme => {
        const flattenedRelations: MatrixThemeRelation[] = [];
        
        if (Array.isArray(apiTheme.relations)) {
            // The `relations` property is an array of objects, e.g., { platform: 'X', details: {...} }.
            for (const relation of apiTheme.relations) {
                const typedPlatformRelation = relation.details;
                
                if (Array.isArray(typedPlatformRelation.evidence_ids)) {
                    // Each platform relation can cite multiple pieces of evidence.
                    for (const evidenceId of typedPlatformRelation.evidence_ids) {
                        const evidence = evidenceMap.get(evidenceId);
                        flattenedRelations.push({
                            sourceId: evidenceId,
                            relation: typedPlatformRelation.relation,
                            quant_score: evidence?.quant_score,
                            note: typedPlatformRelation.note,
                        });
                    }
                }
            }
        }
        
        return {
            id: apiTheme.name,
            label: apiTheme.name,
            relations: flattenedRelations
        };
    });

    return { sources, themes };
}