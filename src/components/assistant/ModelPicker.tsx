"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

export interface ProviderInfo {
  id: string;
  label: string;
  vision: boolean;
  defaultModel?: string;
}

export interface ModelInfo {
  id: string;
  label: string;
}

/**
 * Choose which model answers, the way a chat app does.
 *
 * The model list comes from the provider itself rather than from anything
 * written here, because model names get retired without notice — Groq removed
 * llama-3.3-70b-versatile and every hardcoded reference to it broke.
 */
export function ModelPicker({
  providers,
  provider,
  model,
  onChange,
  fetchModels,
}: {
  providers: ProviderInfo[];
  provider: string | null;
  model: string | null;
  onChange: (provider: string, model: string | null) => void;
  fetchModels: (providerId: string) => Promise<ModelInfo[]>;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Record<string, ModelInfo[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const current = providers.find((p) => p.id === provider);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // Only ask a provider for its models when the menu is actually opened.
  useEffect(() => {
    if (!open || !provider || models[provider] || loading === provider) return;
    setLoading(provider);
    fetchModels(provider)
      .then((list) => setModels((m) => ({ ...m, [provider]: list })))
      .finally(() => setLoading(null));
  }, [open, provider, models, loading, fetchModels]);

  if (providers.length === 0) return null;

  const list = provider ? (models[provider] ?? []) : [];
  const shown = model ?? current?.defaultModel ?? "default";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-field hover:bg-line text-[13px] font-semibold transition-colors max-w-[280px]"
      >
        <span className="text-forest shrink-0">{current?.label ?? "Model"}</span>
        <span className="text-muted truncate">{shown}</span>
        <span className="text-faint shrink-0">▾</span>
      </button>

      {open ? (
        <div className="absolute z-30 left-0 mt-1.5 w-[320px] card lift max-h-[380px] overflow-y-auto py-2">
          {providers.map((p) => {
            const isCurrent = p.id === provider;
            const options = models[p.id] ?? [];

            return (
              <div key={p.id} className="px-1">
                <button
                  type="button"
                  onClick={() => onChange(p.id, null)}
                  className={cx(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-[12px] text-left hover:bg-field",
                    isCurrent && "bg-field",
                  )}
                >
                  <span className="text-[13.5px] font-bold flex-1">{p.label}</span>
                  {p.vision ? (
                    <span className="text-[11px] text-muted">sees images</span>
                  ) : null}
                </button>

                {isCurrent ? (
                  <div className="pl-3 pr-1 pb-2">
                    {loading === p.id ? (
                      <p className="px-3 py-2 text-[12.5px] text-muted">
                        Asking {p.label} what it offers…
                      </p>
                    ) : options.length === 0 ? (
                      <p className="px-3 py-2 text-[12.5px] text-muted leading-relaxed">
                        Could not read the model list. The default is still used.
                      </p>
                    ) : (
                      options.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onChange(p.id, m.id);
                            setOpen(false);
                          }}
                          className={cx(
                            "w-full text-left px-3 py-2 rounded-[10px] text-[12.5px] hover:bg-field",
                            (model ?? current?.defaultModel) === m.id &&
                              "text-forest font-semibold bg-mint",
                          )}
                        >
                          {m.label}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
