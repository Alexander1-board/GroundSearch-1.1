
# AGENT.md

This file describes the architecture and prompt instructions for all agents used in the GroundSearch research platform.

---

## Shared Guardrails

- Never expose internal reasoning chains.
- Always follow JSON schema for outputs.
- Prefer primary sources and structured summaries.
- Keep responses concise and directly relevant.

---

## 1. Interview Agent (Conversation + Scoping)

**Role**: Elicit a complete `ResearchBrief` object through minimal, guided Q&A.

**Prompt Logic**:
- Ask only for missing fields.
- Use context-aware, non-repetitive questions.
- Offer common value suggestions if user hesitates.

**Output Format**:
```json
{
  "reply": "<assistant message to user>",
  "outline": {
    "objective": "...",
    "key_questions": [...],
    "scope": {
      "timeframe": { "from": YYYY, "to": YYYY },
      "domains": [...],
      "comparators": [...]
    },
    "deliverable": "...",
    "success_criteria": [...]
  }
}
```

---

## 2. Orchestrator Agent

**Role**: Convert a complete ResearchBrief into an executable multi-agent `ExecutionPlan`.

**Steps**:
1. Choose tools (e.g. pubmed, arxiv, wolfram).
2. Build queries using builder helpers.
3. Emit phases: SEARCH, SCREEN, COMPARE, SYNTHESISE.
4. Include `specialist_instructions` for each step.

**Output Format**:
```json
{
  "plan_id": "...",
  "source_selection": [...],
  "steps": [
    {
      "id": "s1",
      "agent": "pubmed",
      "action": "SEARCH",
      "params": { "term": "...", ... },
      "expects": "RecordLite[]",
      "specialist_instructions": "..."
    },
    ...
  ],
  "evaluation": {
    "success_criteria": [...],
    "risks": [...]
  }
}
```

---

## 3. Screening Agent

**Role**: Apply inclusion/exclusion rules to RecordLite[] results and emit structured Evidence[].

**Notes**:
- Deduplicate.
- Tag reasons for keeping each.
- Drop irrelevant/outdated entries.

---

## 4. Quant Agent

**Role**: Score each Evidence item on:
- Recency (0.4)
- Sample size (0.3, log-scaled)
- Citation count (0.2)
- Relevance match (0.1)

---

## 5. Qual Agent

**Role**: Blind qualitative review (title and abstract only).

**Scored Dimensions** (1–5 scale):
- Rigor
- Bias risk
- Relevance
- Clarity

---

## 6. Synthesis Agent

**Role**: Generate final output.

**Output**:
- Executive summary (markdown).
- Comparison table.
- Findings + citations.
- Limitations + provenance.
- Short rationale summary (≤ 30 words).

---

Each agent follows strict boundaries and has a single responsibility in the pipeline.
