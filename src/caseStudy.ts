import * as vscode from "vscode";
import { createChatCompletion } from "./llm";
import { CASE_STUDY_SYSTEM, userPromptForCaseStudy } from "./prompts";
import type { CommitBundle } from "./git";

export { getApiKey } from "./apiKey";

export async function generateCaseStudyMarkdown(
  context: vscode.ExtensionContext,
  commits: CommitBundle[]
): Promise<string> {
  const config = vscode.workspace.getConfiguration("devlogArchitect");
  const maxDiffChars = config.get<number>("maxDiffChars") ?? 120000;
  const skipLlm = config.get<boolean>("skipLlm") === true;

  const { truncated, text: bundled } = truncateCommitsDiff(commits, maxDiffChars);

  if (skipLlm) {
    return fallbackTemplate(commits, truncated);
  }

  const result = await createChatCompletion(context, [
    { role: "system", content: CASE_STUDY_SYSTEM },
    { role: "user", content: userPromptForCaseStudy({ commits: bundled }) },
  ]);

  if (!result.ok) {
    if (result.error !== "skipLlm" && result.error !== "noApiKey") {
      vscode.window.showWarningMessage(`Dev-Log: LLM failed — ${result.error}. Using template.`);
    }
    return (
      (result.error !== "skipLlm" && result.error !== "noApiKey"
        ? `<!-- LLM error: ${escapeHtml(result.error)} -->\n\n`
        : "") + fallbackTemplate(commits, truncated)
    );
  }

  const content = result.content;
  if (truncated) {
    return `<!-- Note: diffs were truncated at ${maxDiffChars} chars for the LLM request. -->\n\n${content}`;
  }
  return content;
}

function truncateCommitsDiff(
  commits: CommitBundle[],
  maxChars: number
): { truncated: boolean; text: CommitBundle[] } {
  const out: CommitBundle[] = [];
  let used = 0;
  let truncated = false;
  for (const c of commits) {
    const room = maxChars - used;
    if (room <= 0) {
      truncated = true;
      break;
    }
    if (c.diff.length <= room) {
      out.push(c);
      used += c.diff.length;
    } else {
      out.push({
        ...c,
        diff: c.diff.slice(0, room) + "\n... [diff truncated for LLM]\n",
      });
      truncated = true;
      break;
    }
  }
  return { truncated, text: out.length ? out : commits };
}

function fallbackTemplate(commits: CommitBundle[], truncated: boolean): string {
  const note = truncated
    ? "_Diffs truncated in this export; increase `devlogArchitect.maxDiffChars` or add an API key for full LLM context._\n\n"
    : "";

  const timeline = commits
    .map(
      (c, i) =>
        `- **\`${c.hash.slice(0, 7)}\`** — ${c.subject}${c.body ? `\n  ${c.body.split("\n").join("\n  ")}` : ""}`
    )
    .join("\n");

  const raw = commits
    .map(
      (c) => `### \`${c.hash.slice(0, 7)}\` ${c.subject}\n\n\`\`\`diff\n${c.diff}\n\`\`\`\n`
    )
    .join("\n");

  return `${note}# Dev-Log Case Study (template)

## Summary

_Add an OpenAI-compatible API key via the Dev-Log export command to generate an LLM case study. Until then, this template includes your recent commits and raw diffs._

## Timeline

${timeline}

## Technical trade-offs

- _Fill in: what alternatives did you consider (e.g. Redis vs Memcached, in-process vs distributed cache)?_
- _Why was the approach in these commits appropriate for your constraints?_

## Conflict resolution

_Describe a concrete problem visible in the diff (build error, perf cliff, API limitation) and how the commits resolve it._

## Interview hooks

- _What breaks at 10× scale?_
- _How would you observe this in production?_
- _What would you refactor next and why?_

---

## Raw material (git)

${raw}
`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
