"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

/**
 * Everything to do with students sits behind one sidebar entry, so this is how
 * you move between the people and the messages you send them.
 */
const LINKS = [
  { href: "/students", label: "People" },
  { href: "/send", label: "Send now" },
  { href: "/messages", label: "Messages" },
];

export function StudentsNav() {
  const pathname = usePathname();

  return (
    <div className="seg max-w-[440px] mb-6">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cx("seg-btn grid place-items-center")}
          aria-current={pathname.startsWith(l.href) ? "page" : undefined}
          aria-pressed={pathname.startsWith(l.href)}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
