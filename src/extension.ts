import * as path from "path";
import * as vscode from "vscode";
import { generateCaseStudyMarkdown } from "./caseStudy";
import { getLastNCommits } from "./git";
import { extractImportSpecifiers } from "./imports";
import { createChatCompletion } from "./llm";
import {
  FILE_SEQUENCE_SYSTEM,
  FILE_TRADEOFF_SYSTEM,
  userPromptFileSequence,
  userPromptFileTradeoff,
} from "./prompts";

/**
 * Builds `devlog_entry.md` from the active editor:
 * 1. Extract import specifiers as tech-stack signals.
 * 2. LLM: "Technical trade-offs" (why Tech A vs B for this file).
 * 3. LLM: Mermaid sequenceDiagram from User to Database.
 * 4. Writes Markdown with clean headers to the workspace root.
 */
async function generateCaseStudy(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("Dev-Log: open a source file in the active editor.");
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage("Dev-Log: open a workspace folder.");
    return;
  }

  const doc = editor.document;
  const source = doc.getText();
  const filePath = vscode.workspace.asRelativePath(doc.uri);
  const imports = extractImportSpecifiers(source);

  const config = vscode.workspace.getConfiguration("devlogArchitect");
  const maxSnip = config.get<number>("maxFileSnippetChars") ?? 12000;
  const snippet =
    source.length > maxSnip ? `${source.slice(0, maxSnip)}\n\n/* … truncated … */\n` : source;

  const skipLlm = config.get<boolean>("skipLlm") === true;

  let tradeoffBody: string;
  let sequenceDiagram: string;

  if (skipLlm) {
    tradeoffBody =
      "_LLM disabled (`devlogArchitect.skipLlm`). Add comparisons here (e.g. why Redis vs Memcached for this file)._\n\n";
    const impList =
      imports.length > 0
        ? imports.map((i) => `- \`${i}\``).join("\n")
        : "_No imports detected._";
    tradeoffBody += `### Stack signals from imports\n\n${impList}\n`;
    sequenceDiagram = [
      "sequenceDiagram",
      "    actor User",
      "    participant App as Application",
      "    participant DB as Database",
      "    User->>App: action",
      "    App->>DB: read/write",
      "    DB-->>App: result",
      "    App-->>User: response",
    ].join("\n");
  } else {
    const tradeResult = await createChatCompletion(
      [
        { role: "system", content: FILE_TRADEOFF_SYSTEM },
        { role: "user", content: userPromptFileTradeoff(filePath, imports, snippet) },
      ],
      0.35
    );

    if (!tradeResult.ok) {
      if (tradeResult.error !== "noApiKey" && tradeResult.error !== "skipLlm") {
        vscode.window.showWarningMessage(
          `Dev-Log: trade-off generation skipped (${tradeResult.error}). Using placeholders.`
        );
      }
      tradeoffBody =
        "_Could not generate trade-offs. Set `DEVLOG_OPENAI_API_KEY` or `OPENAI_API_KEY`, restart the editor, or enable `devlogArchitect.skipLlm` for placeholders only._\n\n";
      const impList =
        imports.length > 0
          ? imports.map((i) => `- \`${i}\``).join("\n")
          : "_No imports detected._";
      tradeoffBody += `### Import specifiers\n\n${impList}\n`;
    } else {
      tradeoffBody = tradeResult.content;
    }

    const seqResult = await createChatCompletion(
      [
        { role: "system", content: FILE_SEQUENCE_SYSTEM },
        { role: "user", content: userPromptFileSequence(filePath, imports, snippet) },
      ],
      0.25
    );

    if (!seqResult.ok) {
      if (seqResult.error !== "noApiKey" && seqResult.error !== "skipLlm") {
        vscode.window.showWarningMessage(
          `Dev-Log: sequence diagram skipped (${seqResult.error}). Using placeholder diagram.`
        );
      }
      sequenceDiagram = [
        "sequenceDiagram",
        "    actor User",
        "    participant App as Application",
        "    participant DB as Database",
        "    User->>App: request",
        "    App->>DB: persist",
        "    DB-->>App: ack",
        "    App-->>User: response",
      ].join("\n");
    } else {
      sequenceDiagram = stripMermaidFence(seqResult.content);
    }
  }

  const stackLines =
    imports.length > 0
      ? imports.map((s) => `- \`${s}\``).join("\n")
      : "- _(no import statements found)_";

  const md = `# Dev-Log Entry

## Source

- **File:** \`${filePath}\`

## Tech stack (import specifiers)

${stackLines}

## Technical trade-offs

${tradeoffBody}

## Data flow

\`\`\`mermaid
${sequenceDiagram}
\`\`\`
`;

  const outUri = vscode.Uri.joinPath(folder.uri, "devlog_entry.md");
  await vscode.workspace.fs.writeFile(outUri, Buffer.from(md, "utf8"));
  vscode.window.showInformationMessage(`Dev-Log: wrote ${outUri.fsPath}`);
  const openDoc = await vscode.workspace.openTextDocument(outUri);
  await vscode.window.showTextDocument(openDoc, { preview: false });
}

function stripMermaidFence(raw: string): string {
  const t = raw.trim();
  const fenced = t.match(/^```(?:mermaid)?\s*\n?([\s\S]*?)```$/i);
  if (fenced) {
    return fenced[1].trim();
  }
  return t;
}

export function activate(context: vscode.ExtensionContext): void {
  const exportCmd = vscode.commands.registerCommand("devlog.export", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      vscode.window.showErrorMessage("Dev-Log: open a folder/workspace with a git repository.");
      return;
    }

    const repoRoot = folder.uri.fsPath;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Dev-Log: collecting last 3 commits…",
        cancellable: false,
      },
      async () => {
        let commits;
        try {
          commits = await getLastNCommits(repoRoot, 3);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          vscode.window.showErrorMessage(`Dev-Log: git failed — ${msg}`);
          return;
        }

        if (commits.length === 0) {
          vscode.window.showWarningMessage("Dev-Log: no commits found in this repository.");
          return;
        }

        const md = await generateCaseStudyMarkdown(commits);
        const doc = await vscode.workspace.openTextDocument({
          content: md,
          language: "markdown",
        });
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const defaultName = `devlog-case-study-${new Date().toISOString().slice(0, 10)}.md`;
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(repoRoot, defaultName)),
          filters: { Markdown: ["md"] },
          saveLabel: "Save case study",
        });
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(editor.document.getText(), "utf8"));
          vscode.window.showInformationMessage(`Dev-Log: saved ${uri.fsPath}`);
        }
      }
    );
  });

  const fileCaseStudyCmd = vscode.commands.registerCommand(
    "devlog.generateCaseStudy",
    async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Dev-Log: generating entry from active file…",
          cancellable: false,
        },
        async () => {
          await generateCaseStudy();
        }
      );
    }
  );

  context.subscriptions.push(exportCmd, fileCaseStudyCmd);
}

export function deactivate(): void {}
