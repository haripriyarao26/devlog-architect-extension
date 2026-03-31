import * as vscode from "vscode";
import { API_KEY_ENV_HINT, getApiKey } from "./apiKey";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

let missingKeyNotified = false;

export async function createChatCompletion(
  messages: ChatMessage[],
  temperature = 0.4
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const config = vscode.workspace.getConfiguration("devlogArchitect");
  const baseUrl = (config.get<string>("openaiCompatibleBaseUrl") ?? "").replace(/\/$/, "");
  const model = config.get<string>("model") ?? "gpt-4o-mini";
  const skipLlm = config.get<boolean>("skipLlm") === true;

  if (skipLlm) {
    return { ok: false, error: "skipLlm" };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    if (!missingKeyNotified) {
      missingKeyNotified = true;
      void vscode.window.showWarningMessage(API_KEY_ENV_HINT);
    }
    return { ok: false, error: "noApiKey" };
  }

  const body = {
    model,
    messages,
    temperature,
  };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: "empty response" };
    }
    return { ok: true, content };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
