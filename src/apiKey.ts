/**
 * Shown once per extension host session when an LLM call is attempted without a key.
 * Dev-Log Architect never collects, stores, or ships API keys—only reads from your environment.
 */
export const API_KEY_ENV_HINT =
  "Dev-Log Architect: Set DEVLOG_OPENAI_API_KEY or OPENAI_API_KEY in your own environment, then fully quit and restart the editor. This extension never provides, prompts for, or stores API keys.";

/**
 * OpenAI-compatible API key from the user's environment only.
 */
export function getApiKey(): string | undefined {
  const primary = process.env.DEVLOG_OPENAI_API_KEY?.trim();
  if (primary) {
    return primary;
  }
  const fallback = process.env.OPENAI_API_KEY?.trim();
  return fallback || undefined;
}
