import {
  ProviderError,
  blocksOf,
  newCallId,
  type ChatBlock,
  type ChatMessage,
  type Provider,
  type ToolSpec,
} from "./types";

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
// `||` not `??`: an env var set to an empty string must still fall back.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini rejects several JSON Schema keywords, so strip what it will not take. */
function cleanSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(cleanSchema);
  if (!schema || typeof schema !== "object") return schema;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "additionalProperties" || key === "$schema") continue;
    out[key] = cleanSchema(value);
  }
  return out;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

/**
 * Gemini has no id for a tool call — a result is matched back by function
 * name. We keep our own ids on our side and translate at the boundary.
 */
function toContents(messages: ChatMessage[]) {
  const nameById = new Map<string, string>();
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];

  for (const message of messages) {
    const blocks = blocksOf(message);

    const toolResults = blocks.filter((b) => b.type === "tool_result");
    if (toolResults.length > 0) {
      contents.push({
        role: "user",
        parts: toolResults.map((b) => {
          const result = b as Extract<ChatBlock, { type: "tool_result" }>;
          return {
            functionResponse: {
              name: nameById.get(result.tool_use_id) ?? "unknown",
              // Gemini wants an object here, so wrap whatever the tool returned.
              response: { result: result.content },
            },
          };
        }),
      });
      continue;
    }

    const parts: GeminiPart[] = [];
    for (const block of blocks) {
      if (block.type === "text") {
        if (block.text.trim()) parts.push({ text: block.text });
      } else if (block.type === "image") {
        parts.push({
          inlineData: { mimeType: block.mediaType, data: block.data },
        });
      } else if (block.type === "tool_use") {
        nameById.set(block.id, block.name);
        parts.push({ functionCall: { name: block.name, args: block.input } });
      }
    }
    if (parts.length === 0) continue;
    contents.push({ role: message.role === "user" ? "user" : "model", parts });
  }

  return contents;
}

export const geminiProvider: Provider = {
  id: "gemini",
  label: "Gemini",
  vision: true,
  model: MODEL,

  isConfigured: () => Boolean(KEY),

  async listModels() {
    if (!KEY) return [];
    const response = await fetch(`${ENDPOINT}?pageSize=200`, {
      headers: { "x-goog-api-key": KEY },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        id: m.name.replace(/^models\//, ""),
        label: m.displayName ?? m.name.replace(/^models\//, ""),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  async send({ system, messages, tools, model }) {
    if (!KEY) throw new ProviderError("No Gemini API key configured.", 401);

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: toContents(messages),
      tools: [
        {
          functionDeclarations: tools.map((t: ToolSpec) => {
            const properties = (t.input_schema.properties ?? {}) as Record<
              string,
              unknown
            >;
            // Gemini rejects a declaration carrying an empty parameters
            // object, so a no-argument tool must omit the field entirely.
            return Object.keys(properties).length === 0
              ? { name: t.name, description: t.description }
              : {
                  name: t.name,
                  description: t.description,
                  parameters: cleanSchema(t.input_schema),
                };
          }),
        },
      ],
    };

    const response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model || MODEL)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        throw new ProviderError(
          "Gemini's free tier rate limit was hit. Wait a minute and try again.",
          429,
        );
      }
      throw new ProviderError(
        `Gemini refused the request (${response.status}). ${detail.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      throw new ProviderError(
        `Gemini blocked the request (${data.promptFeedback.blockReason}).`,
      );
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const content: ChatBlock[] = [];

    for (const part of parts) {
      if (part.functionCall) {
        content.push({
          type: "tool_use",
          id: newCallId(),
          name: part.functionCall.name,
          input: part.functionCall.args ?? {},
        });
      } else if (part.text) {
        content.push({ type: "text", text: part.text });
      }
    }

    return { content };
  },
};
