"use client";

import { Settings } from "@/components/Settings";
import { useStore } from "@/lib/store/StoreProvider";
import { autopilotBlockedReason } from "@/lib/engine/send";

/**
 * Owns the data and the writes. The Settings component owns only which page
 * is open, which keeps it easy to read and to extend.
 */
export default function SettingsPage() {
  const {
    db,
    mode,
    email,
    updateSettings,
    resetAll,
    runAutopilot,
    loadSampleData,
    deleteAccount,
    signOut,
  } = useStore();
  const s = db.settings;

  return (
    <Settings
      state={{
        teacherName: s.teacherName,
        email,
        mode,
        telegramConnected: s.telegramConnected,
        delayMinSeconds: s.delayMinSeconds,
        delayMaxSeconds: s.delayMaxSeconds,
        dailyCap: s.dailyCap,
        quietHoursStart: s.quietHoursStart,
        quietHoursEnd: s.quietHoursEnd,
        defaultTone: s.defaultTone,
        language: s.language,
        autopilot: s.autopilot,
        deliveryMode: s.deliveryMode,
        workerSeenAt: s.workerSeenAt,
        lastAutoRunAt: s.lastAutoRunAt,
        autopilotBlockedBy: autopilotBlockedReason(db, new Date()),
        counts: {
          students: db.students.length,
          nudges: db.nudges.length,
          messages: db.messages.length,
        },
      }}
      actions={{
        onSetName: (teacherName) => updateSettings({ teacherName }),
        onSetSendingEnabled: (telegramConnected) =>
          updateSettings({ telegramConnected }),
        onSetDelay: (delayMinSeconds, delayMaxSeconds) =>
          updateSettings({ delayMinSeconds, delayMaxSeconds }),
        onSetDailyCap: (dailyCap) => updateSettings({ dailyCap }),
        onSetQuietHours: (quietHoursStart, quietHoursEnd) =>
          updateSettings({ quietHoursStart, quietHoursEnd }),
        onSetTone: (defaultTone) => updateSettings({ defaultTone }),
        onSetLanguage: (language) => updateSettings({ language }),
        onSetAutopilot: (autopilot) => updateSettings({ autopilot }),
        onSetDeliveryMode: (deliveryMode) => updateSettings({ deliveryMode }),
        onRunAutopilot: runAutopilot,
        onLoadSample: loadSampleData,
        onClearData: resetAll,
        onSignOut: () => void signOut(),
        onDeleteAccount: deleteAccount,
      }}
    />
  );
}
