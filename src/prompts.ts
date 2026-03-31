/**
 * System prompt for Layer 2 (Architecture → Mermaid). Wire this to an LLM
 * when you scan imports and call graph for the active editor.
 */
export const MERMAID_FROM_CODE_SYSTEM = `You are a senior software architect. Given TypeScript/JavaScript (or similar) source code, infer the main runtime flow: modules imported, significant function calls, and data direction.

Output ONLY a valid Mermaid flowchart (use \`flowchart TD\` or \`flowchart LR\`). Rules:
- Use short node labels (max ~40 chars); use \`["quoted label"]\` when spaces are needed.
- Prefer subgraphs for layers: UI, services, data, external APIs.
- Do not explain the diagram; no markdown fences inside the response—raw Mermaid only.
- If uncertain, show "Unknown" nodes rather than inventing libraries not implied by imports.`;

export function userPromptForMermaid(filePath: string, source: string): string {
  return `File: ${filePath}

--- SOURCE ---
${source}
--- END ---

Produce one Mermaid flowchart for this file's architecture.`;
}

/**
 * Case-study generation: conflict-resolution narrative + trade-offs.
 */
export const CASE_STUDY_SYSTEM = `You write portfolio-grade engineering case studies from git diffs and commit messages.

Audience: hiring managers and staff engineers skimming in under 90 seconds.

Requirements:
1. Title: a compelling one-line project/feature name (not the raw commit subject).
2. Summary: 2–3 sentences on problem, approach, outcome.
3. Timeline: bullet list mapping each commit (use short hash) to what changed.
4. Technical trade-offs: explicit section with 2–4 bullets. Each bullet must name alternatives considered or rejected and WHY this diff suggests the chosen direction (e.g., Redis vs Memcached, Map vs LRU, sync vs async). If the diff does not support a claim, say what is unknown.
5. Conflict & resolution: one short paragraph in the style: constraint hit → what broke → what you changed (infer from diff; mark inference clearly if not explicit in messages).
6. Interview hooks: 3 bullet questions a staff engineer might ask about THIS code.

Use Markdown headings: ## Title (as H1 with # once only at top), then ## Summary, ## Timeline, ## Technical trade-offs, ## Conflict resolution, ## Interview hooks.
Be concrete; quote file or symbol names from the diff when helpful. No fluff.`;

export function userPromptForCaseStudy(payload: {
  commits: { hash: string; subject: string; body: string; diff: string }[];
}): string {
  const parts = payload.commits.map((c, i) => {
    return `### Commit ${i + 1}
hash: ${c.hash}
subject: ${c.subject}
body:
${c.body || "(empty)"}

diff:
\`\`\`diff
${c.diff}
\`\`\`
`;
  });
  return `The following are the last ${payload.commits.length} commits (newest first in the list below as given). Write the case study.\n\n${parts.join("\n")}`;
}

/** LLM: trade-offs for the current file from imports + source. */
export const FILE_TRADEOFF_SYSTEM = `You are a staff engineer reviewing one source file for a portfolio dev log.

From the import specifiers and code, infer the likely stack (e.g. Redis, Supabase, Prisma, Next.js server, etc.).

Write Markdown body only for a "## Technical trade-offs" section:
- Use ### subsections, each answering: why the developer likely chose [Tech A visible in this file] over [Tech B] for this specific file.
- Include 2–4 comparisons when plausible; skip vacuous pairs.
- If the file does not imply a technology, say what is unknown rather than inventing vendors.
- No preamble; do not repeat the section title "## Technical trade-offs" (the exporter adds it).`;

export function userPromptFileTradeoff(filePath: string, imports: string[], sourceSnippet: string): string {
  const imp =
    imports.length > 0
      ? imports.map((s) => `- \`${s}\``).join("\n")
      : "- _(no import statements detected)_";
  return `File: \`${filePath}\`

## Import specifiers (tech stack signals)

${imp}

## Source (may be truncated)

\`\`\`typescript
${sourceSnippet}
\`\`\`

Write the Markdown body for the Technical trade-offs section as instructed.`;
}

/** LLM: Mermaid sequenceDiagram User → … → persistence. */
export const FILE_SEQUENCE_SYSTEM = `You output exactly one Mermaid sequenceDiagram showing runtime data flow from the User to persistent storage.

Rules:
- Start with actor User (or participant User).
- Include participants implied by the imports (e.g. API route, Supabase client, Redis, ORM, Database). Use generic names when needed.
- Arrows: ->> for requests, -->> for responses where helpful.
- End at a Database or clear persistence boundary.
- Output raw Mermaid only: no markdown fences, no explanation.`;

export function userPromptFileSequence(filePath: string, imports: string[], sourceSnippet: string): string {
  const imp =
    imports.length > 0
      ? imports.map((s) => `- \`${s}\``).join("\n")
      : "- _(none)_";
  return `File: \`${filePath}\`

Imports:
${imp}

Source (truncated):
\`\`\`
${sourceSnippet}
\`\`\`

Emit one sequenceDiagram.`;
}
