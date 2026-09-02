"use client";

import { NudgeBuilder, emptyDraft } from "@/components/NudgeBuilder";
import { useStore } from "@/lib/store/StoreProvider";

export default function NewNudgePage() {
  const { db } = useStore();
  return <NudgeBuilder initial={emptyDraft(db.settings.defaultTone)} />;
}
