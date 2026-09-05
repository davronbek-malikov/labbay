import {
  ProviderError,
  blocksOf,
  type ChatBlock,
  type ChatMessage,
  type Provider,
  type ToolSpec,
} from "./types";

const KEY = process.env.GROQ_API_KEY;
// `||` not `??`: an env var set to an empty string must still fall back.
// llama-3.3-70b-versatile was retired in June 2026; this is Groq's own
// recommended replacement and supports tool calling.
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

/** Groq speaks the OpenAI chat format, so this is a direct translation. */
function toMessages(system: string, messages: ChatMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [{ role: "system", content: system }];

  for (const message of messages) {
    const blocks = blocksOf(message);

    const results = blocks.filter((b) => b.type === "tool_result");
    if (results.length > 0) {
      // Each tool result is its own message in this format.
      for (const block of results) {
        const r = block as Extract<ChatBlock, { type: "tool_result" }>;
        out.push({
          role: "tool",
          tool_call_id: r.tool_use_id,
          content: r.content,
        });
      }
      continue;
    }

    const text = blocks
      .filter((b): b is Extract<ChatBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

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
    } else if (text) {
      out.push({ role: "user", content: text });
    }
  }

  return out;
}

export const groqProvider: Provider = {
  id: "groq",
  label: "Groq",
  // The default text model cannot see pictures; the app says so rather than
  // silently dropping them.
  vision: false,
  model: MODEL,

  isConfigured: () => Boolean(KEY),

  async listModels() {
    if (!KEY) return [];
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      data?: Array<{ id: string; active?: boolean }>;
    };
    return (data.data ?? [])
      .filter((m) => m.active !== false)
      // Whisper and guard models cannot hold a conversation.
      .filter((m) => !/whisper|tts|guard|prompt-guard/i.test(m.id))
      .map((m) => ({ id: m.id, label: m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  async send({ system, messages, tools, model }) {
    if (!KEY) throw new ProviderError("No Groq API key configured.", 401);

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: model || MODEL,
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
          "Groq's free tier rate limit was hit. Wait a moment and try again.",
          429,
        );
      }
      throw new ProviderError(
        `Groq refused the request (${response.status}). ${detail.slice(0, 300)}`,
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
