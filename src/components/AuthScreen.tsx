"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const { signIn, signUp } = useStore();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit =
    email.trim().length > 3 &&
    password.length >= 6 &&
    (mode === "signin" || name.trim().length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const message =
      mode === "signup"
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);

    if (message) setError(message);
    else if (mode === "signup") {
      // Whether a session starts immediately depends on the project's email
      // confirmation setting, so say something true either way.
      setNotice(
        "Account created. If your project asks for email confirmation, open the link we sent before signing in.",
      );
      setMode("signin");
      setPassword("");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <p className="text-[26px] font-bold tracking-[-0.03em] text-forest">
            Labbay
          </p>
          <p className="mt-2 text-[14px] text-muted leading-relaxed">
            {mode === "signin"
              ? "Sign in and your students, nudges, and messages follow you to any device."
              : "Create your account. Everything you add syncs across your phone and laptop."}
          </p>
        </div>

        <form onSubmit={submit} className="card p-7 space-y-5">
          {mode === "signup" ? (
            <Field label="Your name" hint="This is how the app greets you.">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Davronbek"
                autoComplete="name"
                autoFocus
              />
            </Field>
          ) : null}

          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus={mode === "signin"}
            />
          </Field>

          <Field
            label="Password"
            hint={mode === "signup" ? "At least 6 characters." : undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </Field>

          {error ? (
            <p className="text-[13px] text-clay bg-clay-soft rounded-[16px] px-4 py-3">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="text-[13px] text-forest bg-mint rounded-[16px] px-4 py-3">
              {notice}
            </p>
          ) : null}

          <Button
            variant="primary"
            type="submit"
            disabled={!canSubmit || busy}
            className="w-full"
          >
            {busy
              ? "Working…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[13.5px] text-muted">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="text-accent font-semibold hover:text-forest"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

/** Shown while the session and first load are still resolving. */
export function Splash() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <p className="text-[20px] font-bold tracking-[-0.03em] text-forest animate-pulse">
        Labbay
      </p>
    </div>
  );
}
