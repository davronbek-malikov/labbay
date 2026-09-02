import type { Channel } from "@/lib/types";

export interface SendRequest {
  /** Telegram handle or phone number. */
  to: string;
  text: string;
  channel: Channel;
}

export interface SendResult {
  ok: boolean;
  /** Set when ok is false. */
  error?: string;
}

/**
 * How Labbay talks to Telegram.
 *
 * Today only the mock implementation exists. The real one sends from the
 * teacher's own account over MTProto and has to run on an always-on worker,
 * because that connection cannot live in a serverless function. Swapping it in
 * means writing one more file that satisfies this interface.
 */
export interface MessageProvider {
  readonly name: string;
  isConnected(): Promise<boolean>;
  send(request: SendRequest): Promise<SendResult>;
}
