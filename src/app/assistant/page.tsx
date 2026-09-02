"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Textarea, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import { executeTool, snapshot } from "@/lib/assistant/execute";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { ChatBlock, ChatMessage } from "@/lib/assistant/providers/types";

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** What the assistant actually changed in the app on this turn. */
  actions?: string[];
}

const SUGGESTIONS = [
  "Who has gone quiet?",
  "Send everyone a homework reminder",
  "Set up a Friday well done at 18:00",
  "How many messages went out this week?",
];

const MAX_TOOL_ROUNDS = 6;

interface ProviderInfo {
  id: string;
  label: string;
}

export default function AssistantPage() {
  const store = useStore();
  const { db } = store;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  // Which models this deployment has keys for.
  useEffect(() => {
    (async () => {
      let headers: Record<string, string> = {};
      if (isSupabaseConfigured) {
        const { data } = await supabase().auth.getSession();
        if (data.session) {
          headers = { Authorization: `Bearer ${data.session.access_token}` };
        }
      }
      try {
        const r = await fetch("/api/assistant", { headers });
        const d = (await r.json()) as { providers?: ProviderInfo[] };
        setProviders(d.providers ?? []);
        setProvider((p) => p ?? d.providers?.[0]?.id ?? null);
      } catch {
        setProviders([]);
      }
    })();
  }, []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    setInput("");
    setError(null);
    setBusy(true);
    setTurns((t) => [...t, { role: "user", text }]);

    // Conversation as the API sees it, including tool traffic.
    const wire: ChatMessage[] = [
      ...turns.map((t) => ({ role: t.role, content: t.text })),
      { role: "user", content: text },
    ];

    const actions: string[] = [];

    let authHeader: Record<string, string> = {};
    if (isSupabaseConfigured) {
      const { data } = await supabase().auth.getSession();
      if (data.session) {
        authHeader = { Authorization: `Bearer ${data.session.access_token}` };
      }
    }

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            messages: wire,
            context: snapshot(db),
            ...(provider ? { provider } : {}),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "The assistant could not be reached.");
          break;
        }

        const content = data.content as ChatBlock[];
        wire.push({ role: "assistant", content });

        const toolUses = content.filter(
          (b): b is Extract<ChatBlock, { type: "tool_use" }> =>
            b.type === "tool_use",
        );

        if (toolUses.length === 0) {
          const said = content
            .filter((b): b is Extract<ChatBlock, { type: "text" }> => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          setTurns((t) => [
            ...t,
            { role: "assistant", text: said || "(no answer)", actions: actions.length ? actions : undefined },
          ]);
          break;
        }

        // Execute every tool the model asked for, then answer them all at once.
        const results: ChatBlock[] = toolUses.map((call) => {
          const outcome = executeTool(
            call.name,
            (call.input ?? {}) as Record<string, unknown>,
            store,
          );
          if (outcome.sideEffect) actions.push(outcome.sideEffect);
          return {
            type: "tool_result" as const,
            tool_use_id: call.id,
            content: outcome.result,
            ...(outcome.isError ? { is_error: true } : {}),
          };
        });
        wire.push({ role: "user", content: results });

        if (round === MAX_TOOL_ROUNDS - 1) {
          setError("The assistant kept working for too long and was stopped.");
        }
      }
    } catch {
      setError("Could not reach the assistant. Is the dev server still running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[860px] mx-auto px-5 md:px-8 py-7 md:py-9 flex flex-col min-h-[calc(100dvh-3.5rem)] md:min-h-dvh">
      <header className="mb-6">
        <h1 className="display text-[30px] md:text-[38px]">Assistant</h1>
        <p className="mt-2 text-[13.5px] text-muted">
          Knows your students, nudges, and messages — and can run the app for you.
        </p>

        {providers.length > 1 ? (
          <div className="seg mt-4 max-w-[340px]">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                className="seg-btn"
                aria-pressed={provider === p.id}
                onClick={() => setProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : providers.length === 1 ? (
          <p className="mt-3 text-[12px] text-faint">
            Running on {providers[0].label}
          </p>
        ) : null}
      </header>

      <div className="flex-1">
        {turns.length === 0 ? (
          <div className="card p-7">
            <p className="text-[15px] font-bold">Ask me anything about your teaching.</p>
            <p className="mt-2 text-[13.5px] text-muted leading-relaxed">
              I can read everything in Labbay and change it too — send a message to
              a group, set up a nudge, pause one, or update what you know about a
              student.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="px-4 h-10 rounded-full bg-field hover:bg-mint hover:text-forest text-[13px] font-medium transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-5">
            {turns.map((t, i) => (
              <li
                key={i}
                className={cx("flex", t.role === "user" ? "justify-end" : "justify-start")}
              >
                <div className={cx("max-w-[85%]", t.role === "user" && "text-right")}>
                  <div
                    className={cx(
                      "inline-block text-left px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap",
                      t.role === "user"
                        ? "bg-forest text-white rounded-[20px] rounded-br-[6px]"
                        : "card rounded-[20px] rounded-bl-[6px] px-5 py-4",
                    )}
                  >
                    {t.text}
                  </div>
                  {t.actions?.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {t.actions.map((a, j) => (
                        <li
                          key={j}
                          className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-mint text-forest text-[12px] font-semibold"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
            {busy ? (
              <li className="flex">
                <div className="card rounded-[20px] rounded-bl-[6px] px-5 py-4 flex items-center gap-2">
                  <Dot delay="0ms" />
                  <Dot delay="140ms" />
                  <Dot delay="280ms" />
                </div>
              </li>
            ) : null}
          </ul>
        )}

        {error ? (
          <div className="mt-5 rounded-[18px] bg-clay-soft text-clay px-4 py-3 text-[13px] leading-relaxed">
            {error}
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-0 pt-5 pb-1 bg-canvas"
      >
        <div className="card p-2.5 flex items-end gap-2">
          <Textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Ask about your students, or tell me what to send…"
            className="bg-transparent border-transparent focus:bg-transparent focus:border-transparent resize-none max-h-40"
            aria-label="Message the assistant"
          />
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0"
          >
            {busy ? "Working" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="w-2 h-2 rounded-full bg-faint animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}
