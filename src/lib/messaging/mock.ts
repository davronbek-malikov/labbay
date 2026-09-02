import type { MessageProvider, SendRequest, SendResult } from "./provider";

/** Stands in for Telegram until the worker exists. Sends nothing. */
export const mockProvider: MessageProvider = {
  name: "mock",
  async isConnected() {
    return false;
  },
  async send(_request: SendRequest): Promise<SendResult> {
    return { ok: false, error: "Telegram is not connected yet" };
  },
};
