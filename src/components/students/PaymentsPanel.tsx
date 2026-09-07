"use client";

import { useEffect, useState } from "react";
import { Button, Drawer, Field, Input, Select, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import {
  CURRENCIES,
  groupOf,
  initials,
  payStanding,
  longDate,
  money,
  paymentsOf,
  totalPaid,
} from "@/lib/format";
import type { Currency, Student } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * What this student has paid, when, and how much — plus a way to record the
 * next payment without leaving the panel.
 */
export function PaymentsPanel({
  student,
  onClose,
  startAdding = false,
}: {
  student: Student | null;
  onClose: () => void;
  /** Open with the form already showing, when the teacher asked to add one. */
  startAdding?: boolean;
}) {
  const { db, addPayment, removePayment } = useStore();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(startAdding);
  // Defaults to the course currency, but a student can pay in another.
  const [payCurrency, setPayCurrency] = useState<Currency | null>(null);

  // The panel stays mounted between openings, so the initial state alone would
  // only ever be honoured the first time.
  useEffect(() => {
    if (student) {
      setAdding(startAdding);
      setAmount("");
      setNote("");
      setPayCurrency(null);
    }
  }, [student, startAdding]);

  if (!student) return null;

  const course = groupOf(student, db.groups);
  const history = paymentsOf(student.id, db.payments);
  const standing = payStanding(student, db);
  const { paid, fee, owed, currency } = standing;
  const pct = fee === 0 ? 0 : Math.min(100, Math.round((paid / fee) * 100));

  // Every currency this student has actually paid in, biggest first. A single
  // figure would have to pick one, and would be wrong for the others.
  const totals = (() => {
    const sums = new Map<Currency, number>();
    for (const p of history) {
      const c = p.currency ?? currency;
      sums.set(c, (sums.get(c) ?? 0) + p.amount);
    }
    return [...sums]
      .map(([c, amount]) => ({ currency: c, amount }))
      .sort((a, b) => b.amount - a.amount);
  })();

  const record = () => {
    const value = Number(amount.replace(/\D/g, ""));
    if (!value) return;
    addPayment({
      studentId: student.id,
      amount: value,
      currency: payCurrency ?? currency,
      paidAt,
      note: note.trim(),
    });
    setAmount("");
    setNote("");
    setPaidAt(today());
    setPayCurrency(null);
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

      {/* Where they stand, in whatever currencies they have actually paid in. */}
      <div className="card-mint p-5">
        {totals.length === 0 ? (
          <p className="figure text-[30px] text-forest">
            {money(0, currency)}
          </p>
        ) : (
          <div className="space-y-1">
            {totals.map((t) => (
              <p key={t.currency} className="figure text-[30px] text-forest">
                {money(t.amount, t.currency)}
              </p>
            ))}
          </div>
        )}

        <p className="text-[13px] text-forest/70 mt-1">
          {totals.length > 1 ? "paid so far, in each currency" : "paid so far"}
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
              {owed === 0
                ? "Paid in full"
                : `${money(owed, currency)} still to pay`}
            </p>
            {standing.alsoPaid.length > 0 ? (
              <p className="text-[12.5px] text-forest/70 mt-1.5 leading-relaxed">
                The course is priced in{" "}
                {CURRENCIES.find((c) => c.value === currency)?.short ?? currency}
                , so payments in another currency are not counted against it.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {adding ? (
        <div className="set-card p-5 mt-4 space-y-4">
          <Field
            label="How much"
            hint={
              (payCurrency ?? currency) === currency
                ? "The course is priced in this currency."
                : "A different currency to the course, so it will be listed separately."
            }
          >
            {/* Both controls are w-full, so the wrappers own the widths. */}
            <div className="flex gap-2 items-stretch">
              <div className="flex-1 min-w-0">
                <Input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder={
                    (payCurrency ?? currency) === "USD" ? "150" : "600000"
                  }
                  className="tabular"
                  autoFocus
                />
              </div>
              <div className="w-[124px] shrink-0">
                <Select
                  value={payCurrency ?? currency}
                  onChange={(e) => setPayCurrency(e.target.value as Currency)}
                  aria-label="Currency"
                  className="px-3"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.short === "so'm" ? "So'm" : c.short === "$" ? "USD" : "Won"}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
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
                  {money(p.amount, p.currency ?? currency)}
                </span>
                <span className="set-sub block">
                  {longDate(p.paidAt)}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete the ${money(p.amount, p.currency ?? currency)} payment?`))
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
