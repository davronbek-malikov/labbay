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
      <Script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js" strategy="afterInteractive" />
      <Page
        title={
          <span className="flex items-center gap-3 font-['Space_Grotesk'] text-[#111114] font-bold text-2xl tracking-tight">
            <iconify-icon icon="line-md:bell-loop" style={{ fontSize: "32px", color: "#FF4B2B" }}></iconify-icon>
            Nudges
          </span>
        }
        subtitle={
          <span className="font-['Inter'] text-[#111114] text-sm">
            {nudges.length === 0
              ? "Scheduled messages that go out on their own."
              : `${activeCount} running · ${nudges.length - activeCount} paused`}
          </span>
        }
        action={
          <Link href="/nudges/new">
            <Button
              variant="primary"
              className="font-['Space_Grotesk'] font-bold border-2 border-[#111114] text-[#FFFFFF] shadow-[0_4px_0_rgba(17,17,20,1)] hover:translate-y-[-2px] transition-transform"
              style={{ backgroundColor: "#FF4B2B", borderRadius: "6px" }}
            >
              New nudge
            </Button>
          </Link>
        }
      >
        <StudentsNav />

        {nudges.length === 0 ? (
          <div className="bg-[#F4F4F6] rounded-[10px] border-2 border-[#111114] p-10 shadow-[0_4px_0_rgba(17,17,20,1)] text-center font-['Inter']">
            <EmptyState
              title="No nudges yet"
              body="A nudge is a message that goes out on a schedule — a homework check on Mondays, a well done on Fridays. Set one up and it runs without you."
              action={
                <Link href="/nudges/new">
                  <Button
                    variant="primary"
                    className="font-['Space_Grotesk'] font-bold border-2 border-[#111114] text-[#FFFFFF] shadow-[0_2px_0_rgba(17,17,20,1)]"
                    style={{ backgroundColor: "#FF4B2B", borderRadius: "6px" }}
                  >
                    Create your first nudge
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="space-y-5 font-['Inter']">
            {nudges.map((n) => {
              const recipients = audienceOf(n.audience, students);
              return (
                <li
                  key={n.id}
                  className="bg-[#F4F4F6] rounded-[10px] border-2 border-[#111114] p-7 shadow-[0_4px_0_rgba(17,17,20,1)] transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-lg font-bold font-['Space_Grotesk'] text-[#111114] flex items-center gap-2">
                          {n.status === "active" && (
                            <iconify-icon icon="line-md:loading-loop" style={{ fontSize: "18px", color: "#0B8F5C" }}></iconify-icon>
                          )}
                          {n.name}
                        </h2>
                        <Badge
                          tone={n.status === "active" ? "accent" : "quiet"}
                          className="font-['Space_Grotesk'] border border-[#111114] font-medium"
                          style={{ borderRadius: "4px" }}
                        >
                          {n.status === "active" ? "Active" : "Paused"}
                        </Badge>
                        {n.personalize ? (
                          <Badge
                            tone="neutral"
                            className="font-['Space_Grotesk'] border border-[#111114] font-medium"
                            style={{ borderRadius: "4px" }}
                          >
                            Personalised
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-[#111114]/80 max-w-xl leading-relaxed">
                        {n.intent}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/nudges/${n.id}`}>
                        <Button
                          variant="ghost"
                          className="text-[#111114] hover:bg-[#FFFFFF] border-2 border-[#111114] shadow-[0_2px_0_rgba(17,17,20,1)] font-['Space_Grotesk'] font-bold text-xs"
                          style={{ borderRadius: "6px" }}
                        >
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        className="text-[#111114] hover:bg-[#FFFFFF] border-2 border-[#111114] shadow-[0_2px_0_rgba(17,17,20,1)] font-['Space_Grotesk'] font-bold text-xs"
                        style={{ borderRadius: "6px" }}
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
                        className="text-[#111114] hover:bg-[#FFFFFF] border-2 border-[#111114] shadow-[0_2px_0_rgba(17,17,20,1)] font-['Space_Grotesk'] font-bold text-xs"
                        style={{ borderRadius: "6px" }}
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
                        className="text-[#E3341F] hover:bg-[#E3341F]/10 border-2 border-[#111114] shadow-[0_2px_0_rgba(17,17,20,1)] font-['Space_Grotesk'] font-bold text-xs"
                        style={{ borderRadius: "6px" }}
                        onClick={() => removeNudge(n.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-6 pt-5 border-t-2 border-[#111114] bg-[#FFFFFF] -mx-7 -mb-7 px-7 py-4 rounded-b-[8px]">
                    <div className="flex items-center gap-3">
                      <WeekStrip active={n.days} size="md" />
                      <span className="tabular text-sm font-bold text-[#111114] font-['Space_Grotesk']">
                        {time(n.hour, n.minute)}
                      </span>
                    </div>
                    <span className="text-sm text-[#111114]">
                      {audienceLabel(n.audience, students, groups)} ·{" "}
                      <span className="tabular font-bold text-[#FF4B2B]">{recipients.length}</span> recipients
                    </span>
                    <span className="text-sm text-[#111114]/60 italic">
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