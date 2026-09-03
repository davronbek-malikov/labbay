"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Just enough Markdown for chat: paragraphs, headings, lists, fenced code,
 * inline code, bold, italic, and links.
 *
 * It builds React elements rather than HTML, so nothing a model writes can
 * inject markup into the page.
 */

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lang: string; code: string }
  | { kind: "quote"; text: string };

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code, kept verbatim.
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ kind: "code", lang, code: body.join("\n") });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: body.join(" ") });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Everything else runs together until a blank line.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: para.join(" ") });
  }

  return blocks;
}

/** Bold, italic, inline code, and links inside one line of text. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith("`")) {
      out.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-[6px] bg-field text-[0.9em] tabular"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push(
        <strong key={key++} className="font-bold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) {
        const href = link[2];
        const safe = /^https?:\/\//i.test(href);
        out.push(
          safe ? (
            <a
              key={key++}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {link[1]}
            </a>
          ) : (
            <Fragment key={key++}>{link[1]}</Fragment>
          ),
        );
      } else {
        out.push(token);
      }
    } else {
      out.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({
  source,
  onCopyCode,
}: {
  source: string;
  onCopyCode?: (code: string) => void;
}) {
  const blocks = parseBlocks(source);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h": {
            const size =
              block.level === 1
                ? "text-[18px]"
                : block.level === 2
                  ? "text-[16px]"
                  : "text-[15px]";
            return (
              <p key={i} className={`${size} font-bold`}>
                {inline(block.text)}
              </p>
            );
          }
          case "ul":
            return (
              <ul key={i} className="list-disc pl-5 space-y-1">
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal pl-5 space-y-1">
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <p key={i} className="border-l-2 border-line pl-3 text-muted">
                {inline(block.text)}
              </p>
            );
          case "code":
            return (
              <div key={i} className="relative group">
                <pre className="bg-field rounded-[14px] p-4 overflow-x-auto text-[12.5px] leading-relaxed">
                  <code className="tabular">{block.code}</code>
                </pre>
                {onCopyCode ? (
                  <button
                    type="button"
                    onClick={() => onCopyCode(block.code)}
                    className="absolute top-2 right-2 h-7 px-2.5 rounded-full bg-paper text-[11px] font-semibold text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Copy
                  </button>
                ) : null}
              </div>
            );
          default:
            return <p key={i}>{inline(block.text)}</p>;
        }
      })}
    </div>
  );
}
