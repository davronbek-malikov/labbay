"use client";

import { useParams, useRouter } from "next/navigation";
import { NudgeBuilder } from "@/components/NudgeBuilder";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";

export default function EditNudgePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { db, ready } = useStore();

  const nudge = db.nudges.find((n) => n.id === params.id);

  if (!ready) return null;

  if (!nudge) {
    return (
      <div className="max-w-[860px] mx-auto px-5 md:px-8 py-16 text-center">
        <p className="text-[15px] font-medium">That nudge is gone</p>
        <p className="mt-1.5 text-[13px] text-muted">
          It was deleted, or the link is wrong.
        </p>
        <div className="mt-5 flex justify-center">
          <Button onClick={() => router.push("/nudges")}>Back to nudges</Button>
        </div>
      </div>
    );
  }

  const { id, createdAt, ...initial } = nudge;
  void id;
  void createdAt;

  return <NudgeBuilder initial={initial} nudgeId={nudge.id} />;
}
