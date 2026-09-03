import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ASSISTANT_SYSTEM, ASSISTANT_TOOLS } from "@/lib/assistant/tools";
import { available, pick } from "@/lib/assistant/providers";
import { ProviderError, type ChatMessage } from "@/lib/assistant/providers/types";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Only signed-in teachers may spend the API budget. Skipped when the app runs
 * without a Supabase project, because then there are no accounts to check.
 */
async function isAuthorised(request: Request): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return true;

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return false;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await client.auth.getUser(token);
  return Boolean(data.user) && !error;
}

/**
 * Which providers this deployment can use.
 *
 * Behind the same sign-in check as POST, and it never returns anything derived
 * from an environment variable that could hold a secret.
 */
export async function GET(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ providers: [] }, { status: 401 });
  }
  return NextResponse.json({
    providers: available().map((p) => ({
      id: p.id,
      label: p.label,
      vision: p.vision,
    })),
  });
}

interface Body {
  messages: ChatMessage[];
  /** A short snapshot of the app, so simple questions need no tool call. */
  context?: string;
  /** Overrides the default provider for this request. */
  provider?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "No messages to answer." }, { status: 400 });
  }

  if (!(await isAuthorised(request))) {
    return NextResponse.json(
      { error: "Sign in to use the assistant." },
      { status: 401 },
    );
  }

  const provider = pick(body.provider);
  if (!provider) {
    return NextResponse.json(
      {
        error: process.env.VERCEL
          ? "The assistant needs an API key. Add GEMINI_API_KEY or GROQ_API_KEY in your Vercel project settings under Environment Variables, then redeploy."
          : "The assistant needs an API key. Put GEMINI_API_KEY or GROQ_API_KEY in .env.local and restart the dev server.",
        code: "no_credentials",
      },
      { status: 401 },
    );
  }

  const system = body.context
    ? `${ASSISTANT_SYSTEM}\n\nCurrent app state:\n${body.context}`
    : ASSISTANT_SYSTEM;

  try {
    const reply = await provider.send({
      system,
      messages: body.messages,
      tools: ASSISTANT_TOOLS,
    });

    return NextResponse.json({
      content: reply.content,
      provider: { id: provider.id, label: provider.label, model: provider.model },
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "The assistant could not be reached." },
      { status: 500 },
    );
  }
}
