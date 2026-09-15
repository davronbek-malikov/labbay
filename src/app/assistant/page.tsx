<script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/assistant/Composer";
import {
  ModelPicker,
  type ModelInfo,
  type ProviderInfo,
} from "@/components/assistant/ModelPicker";
import { Button, cx } from "@/components/ui";
import { Markdown } from "@/lib/markdown";
import { useStore } from "@/lib/store/StoreProvider";
import { executeTool, snapshot } from "@/lib/assistant/execute";
import { toBlocks, type Attachment } from "@/lib/assistant/attachments";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { ChatBlock, ChatMessage } from "@/lib/assistant/providers/types";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { icon?: string; style?: React.CSSProperties }, HTMLElement>;
    }
  }
}

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** Thumbnails of anything the teacher attached to this turn. */
  images?: string[];
  /** What the assistant actually changed in the app on this turn. */
  actions?: string[];
}

interface Conversation {
  id: string;
  title: string;
  turns: Turn[];
  updatedAt: number;
}

const SUGGESTIONS = [
  "Who has gone quiet?",
  "Who still owes me money?",
  "Where do I change sending limits?",
  "Add a student called Aziza with @aziza_k",
];

const MAX_TOOL_ROUNDS = 6;
const HISTORY_KEY = "labbay.chats.v1";
const MODEL_KEY = "labbay.model.v1";

const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  ru: "ru-RU",
  uz: "uz-UZ",
};

function loadChats(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export default function AssistantPage() {
  const store = useStore();
  const { db } = store;
  const router = useRouter();

  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setChats(loadChats()), []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODEL_KEY);
      if (saved) {
        const { provider: p, model: m } = JSON.parse(saved) as {
          provider: string | null;
          model: string | null;
        };
        if (p) setProvider(p);
        if (m) setModel(m);
      }
    } catch {
      // A blocked store just means the default is used.
    }
  }, []);

  const chooseModel = useCallback((p: string, m: string | null) => {
    setProvider(p);
    setModel(m);
    try {
      window.localStorage.setItem(MODEL_KEY, JSON.stringify({ provider: p, model: m }));
    } catch {
      // Not worth interrupting the chat over.
    }
  }, []);

  const fetchModels = useCallback(async (providerId: string): Promise<ModelInfo[]> => {
    let headers: Record<string, string> = {};
    if (isSupabaseConfigured) {
      const { data } = await supabase().auth.getSession();
      if (data.session) {
        headers = { Authorization: `Bearer ${data.session.access_token}` };
      }
    }
    try {
      const r = await fetch(`/api/assistant?models=${encodeURIComponent(providerId)}`, {
        headers,
      });
      const d = (await r.json()) as { models?: ModelInfo[] };
      return d.models ?? [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy, working]);

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

  const current = providers.find((p) => p.id === provider);
  const canSeeImages = current?.vision ?? false;

  /** Keeps the sidebar list and localStorage in step with the open chat. */
  const persist = useCallback(
    (next: Turn[], id: string | null) => {
      if (next.length === 0) return;
      const chatId = id ?? `chat_${Date.now().toString(36)}`;
      const title =
        next.find((t) => t.role === "user")?.text.slice(0, 60) || "New chat";

      setChats((list) => {
        const without = list.filter((c) => c.id !== chatId);
        const updated: Conversation[] = [
          { id: chatId, title, turns: next, updatedAt: Date.now() },
          ...without,
        ].slice(0, 30);
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {
          // A full or blocked store must never break the chat.
        }
        return updated;
      });
      setActiveId(chatId);
    },
    [],
  );

  function newChat() {
    abortRef.current?.abort();
    setTurns([]);
    setActiveId(null);
    setError(null);
    setShowHistory(false);
  }

  function openChat(chat: Conversation) {
    abortRef.current?.abort();
    setTurns(chat.turns);
    setActiveId(chat.id);
    setError(null);
    setShowHistory(false);
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("The browser would not let me copy that.");
    }
  }

  async function ask(rawText: string, attachments: Attachment[] = []) {
    const text = rawText.trim();
    if ((!text && attachments.length === 0) || busy) return;

    setError(null);
    setBusy(true);

    const shown: Turn = {
      role: "user",
      text: text || "(attachment)",
      images: attachments.filter((a) => a.preview).map((a) => a.preview!),
    };
    const withUser = [...turns, shown];
    setTurns(withUser);

    const wire: ChatMessage[] = [
      ...turns.map((t) => ({ role: t.role, content: t.text })),
      { role: "user", content: toBlocks(text, attachments, canSeeImages) },
    ];

    const actions: string[] = [];
    const controller = new AbortController();
    abortRef.current = controller;

    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isSupabaseConfigured) {
      const { data } = await supabase().auth.getSession();
      if (data.session) {
        headers = {
          ...headers,
          Authorization: `Bearer ${data.session.access_token}`,
        };
      }
    }

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        setWorking(round === 0 ? "Thinking" : "Working on it");

        const response = await fetch("/api/assistant", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            messages: wire,
            context: snapshot(db),
            ...(provider ? { provider } : {}),
            ...(model ? { model } : {}),
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
          const next = [
            ...withUser,
            {
              role: "assistant" as const,
              text: said || "(no answer)",
              actions: actions.length ? actions : undefined,
            },
          ];
          setTurns(next);
          persist(next, activeId);
          break;
        }

        setWorking(`Using ${toolUses.map((t) => t.name.replace(/_/g, " ")).join(", ")}`);

        const results: ChatBlock[] = toolUses.map((call) => {
          const outcome = executeTool(
            call.name,
            (call.input ?? {}) as Record<string, unknown>,
            {
              ...store,
              navigate: (screen) => {
                const path = screen === "dashboard" ? "/dashboard" : `/${screen}`;
                window.setTimeout(() => router.push(path), 900);
              },
            },
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
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setError("Stopped.");
      } else {
        setError("Could not reach the assistant. Check your connection.");
      }
    } finally {
      setBusy(false);
      setWorking(null);
      abortRef.current = null;
    }
  }

  return (
    <div
      className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-dvh bg-[#f8f6f0] text-[#2c1810]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Header */}
      <header className="shrink-0 px-6 md:px-9 pt-7 pb-4 flex flex-wrap items-center gap-3 border-b border-[#e6e1d5]">
        <div className="flex-1 min-w-0">
          <h1 className="text-[27px] md:text-[34px] font-bold tracking-tight text-[#2c1810]">
            Assistant
          </h1>
          <p className="mt-1 text-[13.5px] text-[#2c1810]/70">
            Knows your students, courses, and money — and can run the app for you.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {chats.length > 0 ? (
            <Button onClick={() => setShowHistory((v) => !v)}>
              History
            </Button>
          ) : null}
          {turns.length > 0 ? (
            <Button variant="primary" onClick={newChat}>
              New chat
            </Button>
          ) : null}
        </div>

      </header>

      {/* History */}
      {showHistory ? (
        <div className="shrink-0 px-6 md:px-9 pt-3 pb-3">
          <div
            className="max-h-[230px] overflow-y-auto bg-white rounded-2xl border border-[#e6e1d5] p-2"
            style={{ boxShadow: "0 2px 6px rgba(44, 24, 16, 0.05)" }}
          >
            {chats.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3.5 py-2.5 rounded-lg hover:bg-[#f8f6f0] transition-colors border-b border-[#e6e1d5]/50 last:border-b-0 flex flex-col gap-0.5"
                onClick={() => openChat(c)}
              >
                <span className="text-[13.5px] font-medium text-[#2c1810] block truncate">
                  {c.title}
                </span>
                <span className="text-[11.5px] text-[#2c1810]/60 block">
                  {new Date(c.updatedAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 md:px-9 pt-4">
        <div className="max-w-[780px] mx-auto pb-4">
          {turns.length === 0 ? (
            <div
              className="bg-white rounded-[28px] p-7 border border-[#e6e1d5]"
              style={{
                boxShadow: "0 12px 32px -8px rgba(224, 86, 56, 0.12)",
              }}
            >
              <p className="text-[16px] font-bold text-[#2c1810]">
                Ask me anything about your teaching.
              </p>
              <p className="mt-2 text-[14px] text-[#2c1810]/75 leading-relaxed">
                I can read everything in Labbay and change it too — send a message
                to a group, set up a nudge, check who has paid. Attach a photo or a
                file and I will read that as well.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-6">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="px-4.5 py-2.5 rounded-full bg-[#f8f6f0] border border-[#e6e1d5] hover:border-[#e05638] hover:bg-white text-[#2c1810] hover:text-[#e05638] text-[13.5px] font-medium transition-all shadow-xs"
                    style={{ boxShadow: "0 2px 6px rgba(44, 24, 16, 0.05)" }}
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
                  <div className={cx("max-w-[85%] group", t.role === "user" && "text-right")}>
                    {t.images?.length ? (
                      <div className="flex flex-wrap gap-2 justify-end mb-2">
                        {t.images.map((src, j) => (
                          <img
                            key={j}
                            src={src}
                            alt=""
                            className="w-24 h-24 rounded-2xl object-cover border border-[#e6e1d5]"
                          />
                        ))}
                      </div>
                    ) : null}

                    <div
                      className={cx(
                        "inline-block text-left text-[14.5px] leading-relaxed",
                        t.role === "user"
                          ? "bg-[#e05638] text-white rounded-[24px] rounded-br-[8px] px-4.5 py-3.5 whitespace-pre-wrap shadow-sm"
                          : "bg-white text-[#2c1810] border border-[#e6e1d5] rounded-[24px] rounded-bl-[8px] px-5.5 py-4",
                      )}
                      style={
                        t.role === "assistant"
                          ? { boxShadow: "0 2px 6px rgba(44, 24, 16, 0.05)" }
                          : undefined
                      }
                    >
                      {t.role === "user" ? (
                        t.text
                      ) : (
                        <Markdown
                          source={t.text}
                          onCopyCode={(code) => copy(code, `code-${i}`)}
                        />
                      )}
                    </div>

                    {t.actions?.length ? (
                      <ul className="mt-2.5 flex flex-wrap gap-1.5">
                        {t.actions.map((a, j) => (
                          <li
                            key={j}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 text-[12px] font-semibold"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div
                      className={cx(
                        "mt-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity",
                        t.role === "user" ? "text-right" : "text-left",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => copy(t.text, `turn-${i}`)}
                        className="text-[11.5px] font-semibold text-[#2c1810]/50 hover:text-[#e05638] px-1"
                      >
                        {copied === `turn-${i}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}

              {working ? (
                <li className="flex">
                  <div
                    className="bg-white rounded-[24px] rounded-bl-[8px] px-5 py-3.5 flex items-center gap-3 border border-dashed border-[#e05638]/40"
                    style={{
                      boxShadow: "inset 0 2px 4px rgba(44, 24, 16, 0.04), 0 2px 6px rgba(44, 24, 16, 0.05)",
                    }}
                  >
                    <iconify-icon
                      icon="line-md:loading-loop"
                      style={{ fontSize: "20px", color: "#e05638" }}
                    />
                    <Dot delay="0ms" />
                    <Dot delay="140ms" />
                    <Dot delay="280ms" />
                    <span className="text-[13.5px] font-medium text-[#e05638] ml-1">
                      {working}
                    </span>
                  </div>
                </li>
              ) : null}
            </ul>
          )}

          {error ? (
            <div className="mt-5 rounded-2xl bg-[#dc2626]/10 border border-[#dc2626]/30 text-[#dc2626] px-4.5 py-3 text-[13.5px] leading-relaxed">
              {error}
            </div>
          ) : null}

          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 px-6 md:px-9 pb-5 pt-2">
        <div className="max-w-[780px] mx-auto">
          <Composer
            busy={busy}
            canSeeImages={canSeeImages}
            language={SPEECH_LANG[db.settings.language] ?? "en-US"}
            modelPicker={
              <ModelPicker
                providers={providers}
                provider={provider}
                model={model}
                onChange={chooseModel}
                fetchModels={fetchModels}
              />
            }
            onSend={(text, attachments) => void ask(text, attachments)}
            onStop={() => abortRef.current?.abort()}
          />
          <p className="text-[11.5px] text-[#2c1810]/50 text-center mt-2.5">
            Enter to send · Shift+Enter for a new line · drop or paste a file
          </p>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('click', function(e) {
              if (e.target.closest('button, a, input[type="button"], input[type="submit"]')) {
                new Audio('https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/press.mp3').play().catch(function(){});
              }
            });
          `,
        }}
      />
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-[#e05638] animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}