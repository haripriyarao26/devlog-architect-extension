# Dev-Log Architect

A VS Code / Cursor extension that turns **recent git history** into **portfolio-ready Markdown**: timelines, conflict-and-resolution narrative, **technical trade-offs**, and interview hooks. The goal is **context extraction**—so six months later (or in a staff interview) you still remember *why* the code looks the way it does.

## One-day MVP (shipped here)

| Command | What it does |
|--------|----------------|
| **Dev-Log: Export Case Study (last 3 commits)** (`devlog.export`) | Reads the **last 3 commits** from the workspace git repo, collects each commit’s **full diff**, then either calls an **OpenAI-compatible** chat API to draft a case study or emits a **structured template** with raw diffs. |

### API keys (yours only—never ours)

**Dev-Log Architect does not provide, prompt for, collect, or store API keys.** There is no key input dialog and no Secret Storage for credentials. You must bring **your own** key from **your** provider account, via **your** machine environment.

To enable LLM-powered exports:

1. Set an environment variable before starting VS Code / Cursor (see table below).
2. **Fully quit and restart** the editor so the Extension Host picks up `process.env`.

| Variable | When to use |
|----------|-------------|
| **`DEVLOG_OPENAI_API_KEY`** | Preferred. Your OpenAI-compatible API key for this extension. |
| **`OPENAI_API_KEY`** | Optional fallback if `DEVLOG_OPENAI_API_KEY` is unset (common if you already use this for other tools). |

**Resolution order:** `DEVLOG_OPENAI_API_KEY` → `OPENAI_API_KEY`. If neither is set, LLM commands fall back to templates / placeholders and show a one-time reminder in the UI.

**Template-only mode:** set **`devlogArchitect.skipLlm`: `true`** in Settings to skip all LLM calls (no key, no network).

**How to set env vars:** Extensions see the same `process.env` as the app. Examples:

- `export DEVLOG_OPENAI_API_KEY='…'` then `code .` or `cursor .` from that shell.
- macOS GUI launches: configure env in your shell profile, wrapper script, or OS-level launch environment—never commit keys or `.env` files into a repo.

**Not environment variables (but required on your machine for some commands):**

- **`git`** on your `PATH` for **Dev-Log: Export Case Study (last 3 commits)** (`devlog.export`).

Additional settings:

- **`devlogArchitect.openaiCompatibleBaseUrl`** — default `https://api.openai.com/v1` (works with many compatible providers).
- **`devlogArchitect.model`** — default `gpt-4o-mini`.
- **`devlogArchitect.maxDiffChars`** — cap on diff size sent to the model (default `120000`).
- **`devlogArchitect.maxFileSnippetChars`** — cap on active-file source sent to the model for **Dev-Log: Generate Case Study from Active File** (default `12000`).

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

**_Git:_** `main` is the default branch. Use short-lived `feature/<topic>` branches for small changes, merge into `main` via PR, then delete the feature branch.

Prerequisites: Node.js 18+, npm, and [Yeoman `yo code`](https://code.visualstudio.com/api/get-started/your-first-extension) if you prefer the official generator (this repo is already scaffolded as a TypeScript extension).

```bash
npm install
npm run compile
```

### Testing in the Extension Development Host (“sandbox”)

VS Code and Cursor ship an **[Extension Development Host](https://code.visualstudio.com/api/get-started/your-first-extension#run-the-extension)**—a second window with your in-development extension pre-loaded, without publishing it. That avoids the “inception” mess of piling test files on top of the extension repo.

**1. Launch the sandbox**  
In this repository, press **F5** (or **Run and Debug** → run **Run Extension**). A new window opens; the title bar includes **`[Extension Development Host]`**. That instance is where you act as the end user.

**2. Open a separate mini-project**  
In the **sandbox** window, use **File → Open Folder…** and choose or create an empty folder elsewhere (e.g. `~/Desktop/test-auth-feature`). Keep extension **source** in your main window; keep **fixture code** only in this folder.

Add something like a `login.ts` with imports you care about (e.g. `@supabase/supabase-js`, `bcrypt`, `zod`) and save. For **`Dev-Log: Export Case Study (last 3 commits)`**, that folder must be a **git** repo with commits; run `git init`, commit, then use the command.

**3. Run the real commands (MVP today)**  
Use the Command Palette (**Cmd+Shift+P** / **Ctrl+Shift+P**):

| Command | What to verify |
|--------|----------------|
| **Dev-Log: Generate Case Study from Active File** | Writes **`devlog_entry.md`** at the **root of the opened folder**. Check **Tech stack (import specifiers)**, **Technical trade-offs**, and the **Mermaid** block in **Data flow**. With `DEVLOG_OPENAI_API_KEY` or `OPENAI_API_KEY` set in the environment **before** starting the editor, the model can reason about bcrypt vs alternatives; with `devlogArchitect.skipLlm` you get placeholders only. |
| **Dev-Log: Export Case Study (last 3 commits)** | Needs **git** history in that folder; produces a case-study Markdown document (save dialog). |

There is **no** “Capture Milestone” command yet—that name maps to a future “Save Milestone” flow. **Interview / “Bar Raiser” sidebar prompts** are **not implemented** in this MVP; you get notifications mainly for missing env keys or LLM errors. To stress-test judgment, try **deliberately weak code** (e.g. plaintext passwords) and see whether the **Technical trade-offs** section (when the LLM is enabled) calls out the risk.

**4. Tighten the loop**  
If behavior is wrong, edit prompts (`src/prompts.ts`) or logic in the **main** window, then use the debug toolbar **Restart** (or restart the Extension Development Host). The sandbox reloads your extension **without** reinstalling—close to how users will run it.

**Why this pattern works:** fixture code stays outside the extension tree; failures show in the **original** window’s **Debug Console**; UX friction (too many steps before value) shows up immediately.

```bash
npm run test   # unit tests for import extraction (not full E2E)
```

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
