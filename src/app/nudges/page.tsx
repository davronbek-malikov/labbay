"use client";

import Link from "next/link";
import Script from "next/script";
import { Page } from "@/components/AppShell";
import { StudentsNav } from "@/components/students/StudentsNav";
import { WeekStrip, DAY_NAMES } from "@/components/WeekStrip";
import { Badge, Button, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import { audienceLabel, audienceOf, time } from "@/lib/format";

export default function NudgesPage() {
  const { db, updateNudge, removeNudge, addNudge } = useStore();
  const { nudges, students, groups } = db;

  const activeCount = nudges.filter((n) => n.status === "active").length;

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js" strategy="afterInteractive" />
      <Page
        title={
          <span className="flex items-center gap-2.5 font-['Plus_Jakarta_Sans'] text-[#2c1810]">
            <iconify-icon icon="line-md:bell-loop" style={{ fontSize: "28px", color: "#e05638" }}></iconify-icon>
            Nudges
          </span>
        }
        subtitle={
          nudges.length === 0
            ? "Scheduled messages that go out on their own."
            : `${activeCount} running · ${nudges.length - activeCount} paused`
        }
        action={
          <Link href="/nudges/new">
            <Button variant="primary" style={{ backgroundColor: "#e05638", borderRadius: "16px", color: "#ffffff", boxShadow: "0 2px 6px rgba(44, 24, 16, 0.05)" }}>
              New nudge
            </Button>
          </Link>
        }
      >
        <StudentsNav />

        {nudges.length === 0 ? (
          <div className="bg-[#ffffff] rounded-[28px] border border-dashed border-[#e6e1d5] p-8 shadow-[inset_0_2px_6px_rgba(44,24,16,0.03)] text-center">
            <EmptyState
              title="No nudges yet"
              body="A nudge is a message that goes out on a schedule — a homework check on Mondays, a well done on Fridays. Set one up and it runs without you."
              action={
                <Link href="/nudges/new">
                  <Button variant="primary" style={{ backgroundColor: "#e05638", borderRadius: "16px" }}>Create your first nudge</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="space-y-3.5 font-['Plus_Jakarta_Sans']">
            {nudges.map((n) => {
              const recipients = audienceOf(n.audience, students);
              return (
                <li
                  key={n.id}
                  className="bg-[#ffffff] rounded-[16px] border border-[#e6e1d5] p-[22px] shadow-[0_2px_6px_rgba(44,24,16,0.05)] hover:shadow-[0_12px_32px_-8px_rgba(224,86,56,0.12)] transition-all duration-200"
                  style={{ backgroundColor: "#ffffff" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-[15.5px] font-semibold text-[#2c1810] flex items-center gap-2">
                          {n.status === "active" && (
                            <iconify-icon icon="line-md:loading-loop" style={{ fontSize: "16px", color: "#10b981" }}></iconify-icon>
                          )}
                          {n.name}
                        </h2>
                        <Badge tone={n.status === "active" ? "accent" : "quiet"} style={{ borderRadius: "8px" }}>
                          {n.status === "active" ? "Active" : "Paused"}
                        </Badge>
                        {n.personalize ? (
                          <Badge tone="neutral" style={{ borderRadius: "8px" }}>Personalised</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-[13.5px] text-[#2c1810]/70 max-w-xl leading-relaxed">
                        {n.intent}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link href={`/nudges/${n.id}`}>
                        <Button variant="ghost" className="text-[#2c1810] hover:bg-[#f8f6f0] rounded-[8px]">Edit</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        className="text-[#2c1810] hover:bg-[#f8f6f0] rounded-[8px]"
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
                        className="text-[#2c1810] hover:bg-[#f8f6f0] rounded-[8px]"
                        onClick={() => {
                          const { id, createdAt, ...rest } = n;
                          void id;
                          void createdAt;
                          addNudge({ ...rest, name: `${n.name} copy`, status: "paused" });
                        }}
                      >
                        Duplicate
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="text-[#dc2626] hover:bg-[#dc2626]/10 rounded-[8px]"
                        onClick={() => removeNudge(n.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-4.5 pt-4.5 border-t border-[#e6e1d5] bg-[#f8f6f0]/50 -mx-[22px] -mb-[22px] px-[22px] py-3 rounded-b-[16px] border-dashed">
                    <div className="flex items-center gap-2.5">
                      <WeekStrip active={n.days} size="md" />
                      <span className="tabular text-[13px] font-medium text-[#2c1810]">
                        {time(n.hour, n.minute)}
                      </span>
                    </div>
                    <span className="text-[13px] text-[#2c1810]/70">
                      {audienceLabel(n.audience, students, groups)} ·{" "}
                      <span className="tabular font-semibold text-[#e05638]">{recipients.length}</span> recipients
                    </span>
                    <span className="text-[13px] text-[#2c1810]/50 italic">
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
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', () => {
              const pressSound = 'https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/press.mp3';
              const hoverSound = 'https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/hover.mp3';
              
              document.addEventListener('click', (e) => {
                if (e.target.closest('button, a')) {
                  new Audio(pressSound).play().catch(() => {});
                }
              });

              document.addEventListener('mouseenter', (e) => {
                if (e.target && e.target.closest && e.target.closest('button, a')) {
                  new Audio(hoverSound).play().catch(() => {});
                }
              }, true);
            });
          `,
        }}
      />
    </>
  );
}