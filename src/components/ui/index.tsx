"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    "inline-flex items-center justify-center gap-2 h-11 px-5 text-[14px] font-bold rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent text-white hover:bg-accent-deep",
    secondary: "bg-field text-ink hover:bg-line",
    ghost: "text-muted hover:text-forest hover:bg-field",
    danger: "bg-clay-soft text-clay hover:bg-clay/15",
  };
  return (
    <button type={type} className={cx(base, variants[variant], className)} {...props} />
  );
}

/* ----------------------------------------------------------------- Field */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="block mt-2 text-[12.5px] text-muted">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full h-12 px-4 text-[14px] bg-field border border-transparent rounded-[18px] placeholder:text-faint focus:border-accent focus:bg-paper focus:outline-none transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(inputBase, "h-auto py-3.5 leading-relaxed resize-y", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(inputBase, "cursor-pointer", props.className)} />
  );
}

/* ---------------------------------------------------------------- Toggle */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative w-11 h-6 rounded-full transition-colors shrink-0",
        checked ? "bg-accent" : "bg-line",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-[left]",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

/* ----------------------------------------------------------------- Badge */

type BadgeTone = "neutral" | "accent" | "clay" | "quiet";

export function Badge({
  tone = "neutral",
  className,
  style,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-field text-muted",
    accent: "bg-mint text-forest",
    clay: "bg-clay-soft text-clay",
    quiet: "bg-field text-faint",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center h-[26px] px-2.5 text-[11.5px] font-semibold rounded-full",
        tones[tone],
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ Empty state */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card py-20 px-6 text-center">
      <p className="text-[17px] font-bold">{title}</p>
      <p className="mt-2 text-[13.5px] text-muted max-w-sm mx-auto">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Drawer */

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/25"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-[460px] bg-paper h-full flex flex-col lift sm:rounded-l-[28px] overflow-hidden"
      >
        <header className="flex items-center justify-between h-16 px-6 border-b border-line shrink-0">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 h-20 px-6 border-t border-line shrink-0">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("bg-field rounded-xl animate-pulse", className)} />;
}
