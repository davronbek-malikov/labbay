/**
 * One shape for every model provider.
 *
 * The browser and the tool executor only ever see these types, so swapping
 * Gemini for Groq for Claude changes nothing outside this folder.
 */

export type ChatBlock =
  | { type: "text"; text: string }
  /** A picture the teacher attached. `data` is base64, without the prefix. */
  | { type: "image"; mediaType: string; data: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ChatBlock[];
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  input_schema: Record<string, unknown>;
}

export interface ProviderReply {
  content: ChatBlock[];
}

export type ProviderId = "gemini" | "groq" | "anthropic";

export interface Provider {
  id: ProviderId;
  label: string;
  /** Whether this provider's model can look at attached pictures. */
  readonly vision: boolean;
  /** The model actually used, for display. */
  model: string;
  isConfigured(): boolean;
  send(args: {
    system: string;
    messages: ChatMessage[];
    tools: ToolSpec[];
  }): Promise<ProviderReply>;
}

/** Thrown with a message worth showing the teacher. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export function blocksOf(message: ChatMessage): ChatBlock[] {
  return typeof message.content === "string"
    ? [{ type: "text", text: message.content }]
    : message.content;
}

let counter = 0;
export function newCallId(): string {
  counter += 1;
  return `call_${Date.now().toString(36)}_${counter}`;
}
