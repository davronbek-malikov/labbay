import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import type { Provider, ProviderId } from "./types";

/**
 * Order matters: the first configured provider is the default, so a project
 * with only a Gemini key just works with no extra setting.
 */
const ALL: Provider[] = [geminiProvider, groqProvider, anthropicProvider];

export function available(): Provider[] {
  return ALL.filter((p) => p.isConfigured());
}

export function pick(requested?: string): Provider | null {
  const ready = available();
  if (ready.length === 0) return null;

  const wanted = (requested || process.env.ASSISTANT_PROVIDER) as
    | ProviderId
    | undefined;

  if (wanted) {
    const match = ready.find((p) => p.id === wanted);
    if (match) return match;
  }
  return ready[0];
}

export type { Provider, ProviderId };
