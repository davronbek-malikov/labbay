"use client";

import Link from "next/link";
import { Page } from "@/components/AppShell";
import { WeekStrip, DAY_NAMES } from "@/components/WeekStrip";
import { Badge, Button, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import { audienceLabel, audienceOf, time } from "@/lib/format";

export default function NudgesPage() {
  const { db, updateNudge, removeNudge, addNudge } = useStore();
  const { nudges, students, groups } = db;

  const activeCount = nudges.filter((n) => n.status === "active").length;

  return (
    <Page
      title="Nudges"
      subtitle={
        nudges.length === 0
          ? "Scheduled messages that go out on their own."
          : `${activeCount} running · ${nudges.length - activeCount} paused`
      }
      action={
        <Link href="/nudges/new">
          <Button variant="primary">New nudge</Button>
        </Link>
      }
    >
      {nudges.length === 0 ? (
        <EmptyState
          title="No nudges yet"
          body="A nudge is a message that goes out on a schedule — a homework check on Mondays, a well done on Fridays. Set one up and it runs without you."
          action={
            <Link href="/nudges/new">
              <Button variant="primary">Create your first nudge</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {nudges.map((n) => {
            const recipients = audienceOf(n.audience, students);
            return (
              <li
                key={n.id}
                className="card p-5 hover:border-faint transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-[15px] font-semibold">{n.name}</h2>
                      <Badge tone={n.status === "active" ? "accent" : "quiet"}>
                        {n.status === "active" ? "Active" : "Paused"}
                      </Badge>
                      {n.personalize ? (
                        <Badge tone="neutral">Personalised</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[13px] text-muted max-w-xl leading-relaxed">
                      {n.intent}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link href={`/nudges/${n.id}`}>
                      <Button variant="ghost">Edit</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        updateNudge(n.id, {
                          status: n.status === "active" ? "paused" : "active",
                        })
                      }
                    >
                      {n.status === "active" ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const { id, createdAt, ...rest } = n;
                        void id;
                        void createdAt;
                        addNudge({ ...rest, name: `${n.name} copy`, status: "paused" });
                      }}
                    >
                      Duplicate
                    </Button>
                    <Button variant="ghost" onClick={() => removeNudge(n.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-4 pt-4 border-t border-line">
                  <div className="flex items-center gap-2.5">
                    <WeekStrip active={n.days} size="md" />
                    <span className="tabular text-[13px]">
                      {time(n.hour, n.minute)}
                    </span>
                  </div>
                  <span className="text-[12.5px] text-muted">
                    {audienceLabel(n.audience, students, groups)} ·{" "}
                    <span className="tabular">{recipients.length}</span> recipients
                  </span>
                  <span className="text-[12.5px] text-faint">
                    {n.days.length === 0
                      ? "No days set"
                      : n.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(", ")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
