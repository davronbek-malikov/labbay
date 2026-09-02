"use client";

import { useState } from "react";
import { Button, Drawer, Field, Input, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import {
  CURRENCIES,
  groupOf,
  initials,
  longDate,
  money,
  paymentsOf,
  totalPaid,
} from "@/lib/format";
import type { Student } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * What this student has paid, when, and how much — plus a way to record the
 * next payment without leaving the panel.
 */
export function PaymentsPanel({
  student,
  onClose,
}: {
  student: Student | null;
  onClose: () => void;
}) {
  const { db, addPayment, removePayment } = useStore();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  if (!student) return null;

  const course = groupOf(student, db.groups);
  const history = paymentsOf(student.id, db.payments);
  const paid = totalPaid(student.id, db.payments);
  const fee = course?.fee ?? 0;
  const currency = course?.currency ?? "UZS";
  const owed = Math.max(0, fee - paid);
  const pct = fee === 0 ? 0 : Math.min(100, Math.round((paid / fee) * 100));

  const record = () => {
    const value = Number(amount.replace(/\D/g, ""));
    if (!value) return;
    addPayment({ studentId: student.id, amount: value, paidAt, note: note.trim() });
    setAmount("");
    setNote("");
    setPaidAt(today());
    setAdding(false);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Payments"
      footer={
        !adding ? (
          <Button variant="primary" onClick={() => setAdding(true)}>
            Record a payment
          </Button>
        ) : (
          <>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={record}
              disabled={!Number(amount.replace(/\D/g, ""))}
            >
              Save payment
            </Button>
          </>
        )
      }
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="w-11 h-11 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[13px] font-bold">
          {initials(student.name)}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold truncate">{student.name}</p>
          <p className="text-[12.5px] text-muted truncate">
            {course?.name ?? "No course"}
          </p>
        </div>
      </div>

      {/* Where they stand */}
      <div className="card-mint p-5">
        <p className="figure text-[30px] text-forest">{money(paid, currency)}</p>
        <p className="text-[13px] text-forest/70 mt-1">
          {fee > 0 ? `paid of ${money(fee, currency)}` : "paid so far"}
        </p>

        {fee > 0 ? (
          <>
            <div className="h-2 rounded-full bg-white/60 overflow-hidden mt-4">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p
              className={cx(
                "text-[13px] font-semibold mt-3",
                owed === 0 ? "text-forest" : "text-clay",
              )}
            >
              {owed === 0 ? "Paid in full" : `${money(owed, currency)} still to pay`}
            </p>
          </>
        ) : null}
      </div>

      {adding ? (
        <div className="set-card p-5 mt-4 space-y-4">
          <Field
            label="How much"
            hint={`In ${CURRENCIES.find((c) => c.value === currency)?.label ?? currency}.`}
          >
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder={currency === "USD" ? "150" : "600000"}
              className="tabular"
              autoFocus
            />
          </Field>
          <Field label="When">
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </Field>
          <Field label="Note" hint="Optional — cash, card, first instalment.">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cash, second instalment"
            />
          </Field>
          {owed > 0 ? (
            <button
              type="button"
              onClick={() => setAmount(String(owed))}
              className="text-[12.5px] font-semibold text-accent hover:text-forest"
            >
              Fill the remaining {money(owed, currency)}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* History */}
      <p className="label mt-7 mb-2 px-1">
        {history.length === 0
          ? "No payments yet"
          : `${history.length} payment${history.length === 1 ? "" : "s"}`}
      </p>

      {history.length === 0 ? (
        <p className="text-[13px] text-muted px-1">
          Nothing recorded. Use the button below the first time they pay.
        </p>
      ) : (
        <div className="set-card">
          {history.map((p) => (
            <div key={p.id} className="set-row" style={{ cursor: "default" }}>
              <span className="set-text">
                <span className="set-title block tabular">
                  {money(p.amount, currency)}
                </span>
                <span className="set-sub block">
                  {longDate(p.paidAt)}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete the ${money(p.amount, currency)} payment?`))
                    removePayment(p.id);
                }}
                className="text-[12.5px] font-semibold text-faint hover:text-clay shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
