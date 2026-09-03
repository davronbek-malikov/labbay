import type { ChatBlock } from "./providers/types";

export interface Attachment {
  id: string;
  name: string;
  /** "image" is sent to the model as a picture; "text" is inlined. */
  kind: "image" | "text";
  mediaType: string;
  size: number;
  /** base64 for images, plain text for the rest. */
  content: string;
  /** Data URL, for showing a thumbnail. */
  preview?: string;
}

const MAX_BYTES = 4 * 1024 * 1024;
const TEXT_TYPES = /^(text\/|application\/(json|csv|xml))/;
const TEXT_EXTENSIONS = /\.(txt|md|csv|json|log|tsv)$/i;

export function isTextFile(file: File): boolean {
  return TEXT_TYPES.test(file.type) || TEXT_EXTENSIONS.test(file.name);
}

/** Reads a dropped or chosen file into something a model can be given. */
export async function readAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 4MB.`,
    );
  }

  const id = `att_${Math.random().toString(36).slice(2, 9)}`;

  if (file.type.startsWith("image/")) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    });
    return {
      id,
      name: file.name,
      kind: "image",
      mediaType: file.type,
      size: file.size,
      content: dataUrl.split(",")[1] ?? "",
      preview: dataUrl,
    };
  }

  if (isTextFile(file)) {
    const text = await file.text();
    return {
      id,
      name: file.name,
      kind: "text",
      mediaType: file.type || "text/plain",
      size: file.size,
      // Long files are trimmed so one attachment cannot eat the whole context.
      content: text.slice(0, 40_000),
    };
  }

  throw new Error(
    `${file.name} is not a kind of file I can read. Pictures, and text files like .txt, .md, .csv or .json.`,
  );
}

/** Turns the composer's text plus its attachments into message content. */
export function toBlocks(
  text: string,
  attachments: Attachment[],
  canSeeImages: boolean,
): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  const notes: string[] = [];

  for (const a of attachments) {
    if (a.kind === "image") {
      if (canSeeImages) {
        blocks.push({ type: "image", mediaType: a.mediaType, data: a.content });
      } else {
        notes.push(
          `[${a.name} was attached, but the current model cannot look at pictures. Switch to Gemini.]`,
        );
      }
    } else {
      notes.push(`--- ${a.name} ---\n${a.content}`);
    }
  }

  const body = [text.trim(), ...notes].filter(Boolean).join("\n\n");
  if (body) blocks.unshift({ type: "text", text: body });
  return blocks.length ? blocks : [{ type: "text", text: text.trim() }];
}
