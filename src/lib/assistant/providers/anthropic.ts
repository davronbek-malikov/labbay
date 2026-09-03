import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  blocksOf,
  type ChatBlock,
  type ChatMessage,
  type Provider,
} from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

export const anthropicProvider: Provider = {
  id: "anthropic",
  label: "Claude",
  vision: true,
  model: MODEL,

  isConfigured: () =>
    Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),

  async send({ system, messages, tools }) {
    if (!anthropicProvider.isConfigured()) {
      throw new ProviderError("No Anthropic API key configured.", 401);
    }

    const client = new Anthropic();

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool["input_schema"],
        })),
        messages: messages.map((m) => ({
          role: m.role,
          content: blocksOf(m).map((b) =>
            b.type === "tool_result"
              ? {
                  type: "tool_result" as const,
                  tool_use_id: b.tool_use_id,
                  content: b.content,
                  ...(b.is_error ? { is_error: true } : {}),
                }
              : b.type === "tool_use"
                ? {
                    type: "tool_use" as const,
                    id: b.id,
                    name: b.name,
                    input: b.input,
                  }
                : b.type === "image"
                ? {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: b.mediaType as "image/png",
                      data: b.data,
                    },
                  }
                : { type: "text" as const, text: b.text },
          ),
        })) as Anthropic.MessageParam[],
      });

      const content: ChatBlock[] = [];
      for (const block of response.content) {
        if (block.type === "text") {
          content.push({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          content.push({
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: (block.input ?? {}) as Record<string, unknown>,
          });
        }
      }
      return { content };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new ProviderError("Claude is rate limiting. Try again shortly.", 429);
      }
      if (error instanceof Anthropic.APIError) {
        throw new ProviderError(`Claude error ${error.status}: ${error.message}`);
      }
      throw new ProviderError("Claude could not be reached.");
    }
  },
};
