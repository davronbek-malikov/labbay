"use client";

import { useEffect, useRef, useState } from "react";
import { Button, cx } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { readAttachment, type Attachment } from "@/lib/assistant/attachments";
import type { ReactNode } from "react";

/** Browsers name this differently, and it is missing entirely in some. */
function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export function Composer({
  busy,
  canSeeImages,
  language,
  modelPicker,
  onSend,
  onStop,
}: {
  busy: boolean;
  canSeeImages: boolean;
  /** Which language to listen for when dictating. */
  language: string;
  /** Sits on the bottom row, where the model belongs next to the message. */
  modelPicker?: ReactNode;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Grow with the text, up to a point, then scroll.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  async function absorb(files: FileList | File[]) {
    setError(null);
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      try {
        next.push(await readAttachment(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : "That file could not be read.");
      }
    }
    if (next.length) setAttachments((a) => [...a, ...next]);
  }

  function send() {
    if (busy) return;
    if (!text.trim() && attachments.length === 0) return;
    onSend(text, attachments);
    setText("");
    setAttachments([]);
    setError(null);
  }

  function dictate() {
    const Recognition = speechRecognition();
    if (!Recognition) {
      setError("This browser cannot do voice input. Chrome and Edge can.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let said = "";
      for (let i = 0; i < event.results.length; i++) {
        said += event.results[i][0].transcript;
      }
      setText(said);
    };
    recognition.onerror = () => {
      setError("Could not hear anything. Check the microphone permission.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    setError(null);
    recognition.start();
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void absorb(e.dataTransfer.files);
      }}
      className={cx(
        "card p-3 transition-colors",
        dragging && "ring-2 ring-accent bg-mint/40",
      )}
    >
      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2 mb-3">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-[12px] bg-field"
            >
              {a.preview ? (
                <img
                  src={a.preview}
                  alt=""
                  className="w-8 h-8 rounded-[8px] object-cover"
                />
              ) : (
                <span className="w-8 h-8 rounded-[8px] bg-paper grid place-items-center text-[10px] font-bold text-muted">
                  TXT
                </span>
              )}
              <span className="text-[12.5px] max-w-[140px] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() =>
                  setAttachments((list) => list.filter((x) => x.id !== a.id))
                }
                aria-label={`Remove ${a.name}`}
                className="text-faint hover:text-clay text-[15px] leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="text-[12.5px] text-clay mb-2 px-1">{error}</p>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach a file"
          className="w-10 h-10 shrink-0 rounded-full grid place-items-center text-muted hover:text-forest hover:bg-field transition-colors"
        >
          <IconPlus className="w-[19px] h-[19px]" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,text/*,.md,.csv,.json,.log,.tsv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void absorb(e.target.files);
            e.target.value = "";
          }}
        />

        <textarea
          ref={areaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void absorb(files);
            }
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            listening ? "Listening…" : "Ask anything, or drop a file here"
          }
          className="flex-1 min-w-0 resize-none bg-transparent border-none outline-none text-[14.5px] leading-relaxed py-2.5 max-h-[200px] placeholder:text-faint"
        />

        <button
          type="button"
          onClick={dictate}
          aria-label={listening ? "Stop listening" : "Dictate"}
          className={cx(
            "w-10 h-10 shrink-0 rounded-full grid place-items-center transition-colors",
            listening
              ? "bg-clay text-white"
              : "text-muted hover:text-forest hover:bg-field",
          )}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>

        {busy ? (
          <Button variant="secondary" onClick={onStop} className="shrink-0">
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={send}
            disabled={!text.trim() && attachments.length === 0}
            className="shrink-0 w-11 px-0"
            aria-label="Send"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </Button>
        )}
      </div>

      {modelPicker ? (
        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-line">
          {modelPicker}
        </div>
      ) : null}

      {!canSeeImages && attachments.some((a) => a.kind === "image") ? (
        <p className="text-[12px] text-clay mt-2 px-1">
          The current model cannot look at pictures. Switch to Gemini above.
        </p>
      ) : null}
    </div>
  );
}
