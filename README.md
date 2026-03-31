# Dev-Log Architect

A VS Code / Cursor extension that turns **recent git history** into **portfolio-ready Markdown**: timelines, conflict-and-resolution narrative, **technical trade-offs**, and interview hooks. The goal is **context extraction**—so six months later (or in a staff interview) you still remember *why* the code looks the way it does.

## One-day MVP (shipped here)

| Command | What it does |
|--------|----------------|
| **Dev-Log: Export Case Study (last 3 commits)** (`devlog.export`) | Reads the **last 3 commits** from the workspace git repo, collects each commit’s **full diff**, then either calls an **OpenAI-compatible** chat API to draft a case study or emits a **structured template** with raw diffs. |

### LLM setup

1. Run **Dev-Log: Export Case Study** from the Command Palette.
2. On first use, enter an API key when prompted (stored in [Secret Storage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)).
3. Or set **`devlogArchitect.skipLlm`: `true`** in Settings to always export the template (no key, no network).

Additional settings:

- **`devlogArchitect.openaiCompatibleBaseUrl`** — default `https://api.openai.com/v1` (works with many compatible providers).
- **`devlogArchitect.model`** — default `gpt-4o-mini`.
- **`devlogArchitect.maxDiffChars`** — cap on diff size sent to the model (default `120000`).

Exported files are **blog-ready Markdown** you can drop into a repo or personal site.

---

## Product architecture (roadmap)

### Layer 1 — Context Grabber (“Save Milestone”)

Capture not just code but **session context**:

- Git diff (before / after)
- Compiler or diagnostic errors (“the conflict”)
- `.cursorrules` or project constraints

**Output:** an LLM-generated **conflict-resolution** paragraph (e.g. *“Tried `Map` for caching; memory blew up at ~10k entries; moved to LRU with a 512MB cap.”*)

*MVP today:* last-3-commits + diffs + LLM case study / template. Milestone capture can extend the same pipeline.

### Layer 2 — Automated visuals (“Show, don’t tell”)

Recruiters skim. **Mermaid** diagrams from the **current file** (imports + call patterns) make a dev-log export feel like a real design review.

**Prompt source of truth:** `src/prompts.ts` exports `MERMAID_FROM_CODE_SYSTEM` and `userPromptForMermaid()`. Point your future command at the active editor’s text and send those strings to the same chat API you use for case studies.

### Layer 3 — Interview Prep (“Bar Raiser”)

After a feature, the sidebar surfaces **staff-level questions** tied to what you actually wrote (e.g. *“You used a nested loop here—how does this behave for 1M concurrent users?”*). Same LLM stack; different system prompt and UI surface.

---

## Architecture → Mermaid: the “magic” prompt

The extension is designed to reuse one **OpenAI-compatible** endpoint. For diagrams, use the constants in `prompts.ts`:

- **`MERMAID_FROM_CODE_SYSTEM`** — instructs the model to emit **raw Mermaid only** (`flowchart TD` / `LR`, subgraphs for UI / services / data / external APIs, no prose).
- **`userPromptForMermaid(filePath, source)`** — wraps the current file for the user message.

That pairing is usually enough for **install-worthy** diagrams; tune the system string if you want C4-style or sequence diagrams for specific languages.

---

## Development

Prerequisites: Node.js 18+, npm, and [Yeoman `yo code`](https://code.visualstudio.com/api/get-started/your-first-extension) if you prefer the official generator (this repo is already scaffolded as a TypeScript extension).

```bash
npm install
npm run compile
```

Press **F5** in VS Code / Cursor ( **Run Extension** ) to launch an Extension Development Host. Open a folder with git history, run **Dev-Log: Export Case Study**.

Package locally:

```bash
npx @vscode/vsce package
```

---

## Why this helps job seekers

- **Force multiplier:** tooling that helps others ship evidence of judgment, not just code.
- **System thinking:** trade-offs and diagrams signal **architect** mindset, not “code monkey.”
- **Fresh context:** questions and narratives are generated while the feature is still in working memory.

---

## License

MIT
