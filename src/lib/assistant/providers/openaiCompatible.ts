import {
  ProviderError,
  blocksOf,
  type ChatBlock,
  type ChatMessage,
  type ModelInfo,
  type Provider,
  type ProviderId,
  type ToolSpec,
} from "./types";

/**
 * One adapter for every provider that speaks the OpenAI chat format.
 *
 * Groq, OpenRouter, Cerebras and Mistral all expose the same two endpoints, so
 * adding another free provider is a few lines at the bottom of this file
 * rather than another copy of this logic.
 */

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<Record<string, unknown>> | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function toMessages(system: string, messages: ChatMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [{ role: "system", content: system }];

  for (const message of messages) {
    const blocks = blocksOf(message);

    const results = blocks.filter((b) => b.type === "tool_result");
    if (results.length > 0) {
      // Each tool result is its own message in this format.
      for (const block of results) {
        const r = block as Extract<ChatBlock, { type: "tool_result" }>;
        out.push({ role: "tool", tool_call_id: r.tool_use_id, content: r.content });
      }
      continue;
    }

    const text = blocks
      .filter((b): b is Extract<ChatBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const images = blocks.filter(
      (b): b is Extract<ChatBlock, { type: "image" }> => b.type === "image",
    );

    const calls = blocks.filter(
      (b): b is Extract<ChatBlock, { type: "tool_use" }> => b.type === "tool_use",
    );

    if (message.role === "assistant") {
      out.push({
        role: "assistant",
        content: text || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      });
    } else if (images.length > 0) {
      // Pictures ride along as data URLs beside the text.
      out.push({
        role: "user",
        content: [
          ...(text ? [{ type: "text", text }] : []),
          ...images.map((i) => ({
            type: "image_url",
            image_url: { url: `data:${i.mediaType};base64,${i.data}` },
          })),
        ],
      });
    } else if (text) {
      out.push({ role: "user", content: text });
    }
  }

  return out;
}

/** Models that cannot hold a conversation, whatever the provider calls them. */
const NOT_CHAT = /whisper|tts|guard|embed|moderation|rerank|ocr/i;

export function openAICompatible(config: {
  id: ProviderId;
  label: string;
  baseUrl: string;
  /** Environment variable holding the key. */
  keyName: string;
  defaultModel: string;
  /** Whether any of this provider's models can read pictures. */
  vision: boolean;
  /** Extra headers some providers ask for. */
  headers?: Record<string, string>;
}): Provider {
  const key = () => process.env[config.keyName];
  const model = () => process.env[`${config.keyName.replace(/_API_KEY$/, "")}_MODEL`] || config.defaultModel;

  const auth = () => ({
    Authorization: `Bearer ${key()}`,
    ...(config.headers ?? {}),
  });

  return {
    id: config.id,
    label: config.label,
    vision: config.vision,
    get model() {
      return model();
    },

    isConfigured: () => Boolean(key()),

    async listModels(): Promise<ModelInfo[]> {
      if (!key()) return [];
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: auth(),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as {
        data?: Array<{ id: string; name?: string; active?: boolean }>;
      };
      return (data.data ?? [])
        .filter((m) => m.active !== false && !NOT_CHAT.test(m.id))
        .map((m) => ({ id: m.id, label: m.name ?? m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },

    async send({ system, messages, tools, model: override }) {
      if (!key()) {
        throw new ProviderError(`No ${config.label} API key configured.`, 401);
      }

      const chosen = override || model();

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify({
          model: chosen,
          messages: toMessages(system, messages),
          tools: tools.map((t: ToolSpec) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.input_schema,
            },
          })),
          tool_choice: "auto",
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 429) {
          throw new ProviderError(
            `${config.label}'s free limit was hit. Wait a moment, or pick another model.`,
            429,
          );
        }
        if (response.status === 404) {
          throw new ProviderError(
            `${config.label} does not serve "${chosen}" any more. Pick a different model from the menu.`,
            404,
          );
        }
        throw new ProviderError(
          `${config.label} refused the request (${response.status}). ${detail.slice(0, 300)}`,
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
        }>;
      };

      const message = data.choices?.[0]?.message;
      const content: ChatBlock[] = [];

      if (message?.content?.trim()) {
        content.push({ type: "text", text: message.content });
      }

      for (const call of message?.tool_calls ?? []) {
        let input: Record<string, unknown> = {};
        try {
          // Arguments arrive as a JSON string; a model can still get it wrong.
          input = call.function.arguments
            ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          input = {};
        }
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.function.name,
          input,
        });
      }

      return { content };
    },
  };
}

/* ------------------------------------------------------- the free providers */

export const groqProvider = openAICompatible({
  id: "groq",
  label: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  keyName: "GROQ_API_KEY",
  // llama-3.3-70b-versatile was retired in June 2026; this is the replacement
  // Groq itself recommends, and it supports tool calling.
  defaultModel: "openai/gpt-oss-120b",
  vision: true,
});

export const openRouterProvider = openAICompatible({
  id: "openrouter",
  label: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  keyName: "OPENROUTER_API_KEY",
  // `auto` lets OpenRouter choose, which survives any single model retiring.
  defaultModel: "openrouter/auto",
  vision: true,
  headers: { "X-Title": "Labbay" },
});

export const cerebrasProvider = openAICompatible({
  id: "cerebras",
  label: "Cerebras",
  baseUrl: "https://api.cerebras.ai/v1",
  keyName: "CEREBRAS_API_KEY",
  defaultModel: "llama-3.3-70b",
  vision: false,
});

export const mistralProvider = openAICompatible({
  id: "mistral",
  label: "Mistral",
  baseUrl: "https://api.mistral.ai/v1",
  keyName: "MISTRAL_API_KEY",
  defaultModel: "mistral-small-latest",
  vision: true,
});
