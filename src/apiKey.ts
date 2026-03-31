import * as vscode from "vscode";

const SECRET_KEY = "devlog.openaiCompatibleApiKey";

function keyFromEnv(): string | undefined {
  const a = process.env.DEVLOG_OPENAI_API_KEY?.trim();
  if (a) {
    return a;
  }
  const b = process.env.OPENAI_API_KEY?.trim();
  return b || undefined;
}

export async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  let key = await context.secrets.get(SECRET_KEY);
  if (!key) {
    key = keyFromEnv();
  }
  if (!key) {
    key = await vscode.window.showInputBox({
      title: "Dev-Log Architect — API key",
      prompt:
        "OpenAI-compatible API key (stored in Secret Storage). Leave empty for template-only export.",
      password: true,
      ignoreFocusOut: true,
    });
    if (key) {
      await context.secrets.store(SECRET_KEY, key);
    }
  }
  return key?.trim() || undefined;
}
