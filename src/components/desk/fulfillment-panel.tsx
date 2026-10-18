"use client";

import { useEffect, useState } from "react";
import { CheckCheck, Eye, Mail, PencilLine, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { SlipReveal } from "@/components/services/slip-envelope";
import type { FulfillmentSlip } from "@/lib/tier-access/rules";

type Row = {
  id: number;
  service: string;
  status: string;
  slip: FulfillmentSlip | null;
  fulfilledBy: string | null;
  fulfilledAt: string | null;
  completedBy: string | null;
  completedAt: string | null;
  member?: { fullName: string };
};

export type FulfillBody = { slip?: FulfillmentSlip; complete?: boolean };

const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
const input =
  "mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-[#8a5a2e]";

function when(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
}

const EMPTY: FulfillmentSlip = { hotelName: "", roomNumber: "", confirmationCode: "", checkIn: "", checkOut: "", notes: "" };

function SlipForm({
  row,
  busy,
  onClose,
  onSubmit,
}: {
  row: Row;
  busy: boolean;
  onClose: () => void;
  onSubmit: (slip: FulfillmentSlip) => Promise<boolean>;
}) {
  const [slip, setSlip] = useState<FulfillmentSlip>({ ...EMPTY, ...(row.slip ?? {}) });
  const set = (key: keyof FulfillmentSlip) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSlip((s) => ({ ...s, [key]: e.target.value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-[220] grid place-items-center p-4">
      <button type="button" aria-label="Close" onClick={() => !busy && onClose()} className="absolute inset-0 bg-slate-900/50" />
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Issue booking slip"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSubmit(slip)) onClose();
        }}
        className="relative grid max-h-[92dvh] w-full max-w-lg gap-3 overflow-y-auto rounded-xl bg-white p-5 text-slate-800 shadow-2xl"
      >
        <button type="button" onClick={onClose} disabled={busy} className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[#8a5a2e]">Request #{row.id} · {row.service}</p>
          <h3 className="text-lg font-semibold text-slate-900">{row.slip ? "Update booking slip" : "Issue booking slip"}</h3>
          <p className="text-xs text-slate-500">The member is notified and can open the slip from their requests.</p>
        </div>
        <label className="text-xs font-medium text-slate-600">
          Hotel / venue name *
          <input required maxLength={120} value={slip.hotelName} onChange={set("hotelName")} className={input} placeholder="The Ritz London" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">
            Room number
            <input maxLength={40} value={slip.roomNumber ?? ""} onChange={set("roomNumber")} className={input} placeholder="502" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Confirmation code
            <input maxLength={60} value={slip.confirmationCode ?? ""} onChange={set("confirmationCode")} className={`${input} font-mono`} placeholder="RITZ-88213" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Check-in
            <input type="date" value={slip.checkIn ?? ""} onChange={set("checkIn")} className={input} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Check-out
            <input type="date" min={slip.checkIn || undefined} value={slip.checkOut ?? ""} onChange={set("checkOut")} className={input} />
          </label>
        </div>
        <label className="text-xs font-medium text-slate-600">
          Special instructions
          <textarea maxLength={1000} rows={3} value={slip.notes ?? ""} onChange={set("notes")} className={input} placeholder="VIP treatment, late check-out arranged." />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className={`${btn} border-slate-300 text-slate-600`}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !slip.hotelName.trim()} className={`${btn} border-[#3b2819] bg-[#3b2819] text-white hover:bg-[#2b1d13]`}>
            <Mail className="h-3.5 w-3.5" /> {busy ? "Sending…" : row.slip ? "Update & notify" : "Issue slip"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Shown on approved requests: issue/edit the slip, preview it as the member sees it, then close the request. */
export function FulfillmentPanel({ row, busy, onFulfill }: { row: Row; busy: boolean; onFulfill: (body: FulfillBody) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const completed = row.status === "COMPLETED";

  return (
    <div className="grid gap-2 rounded-lg border border-[#c9a45c]/50 bg-[#fbf6ec] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a5a2e]">Step 3 · Fulfilment</p>
        {row.slip ? (
          <span className="text-[11px] text-slate-500">
            Slip by {row.fulfilledBy} · {when(row.fulfilledAt)}
          </span>
        ) : (
          <span className="text-[11px] text-amber-700">No slip issued yet</span>
        )}
      </div>

      {row.slip ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-white p-2.5 text-xs text-slate-700 sm:grid-cols-4">
          <span className="col-span-2 font-semibold text-slate-900 sm:col-span-4">{row.slip.hotelName}</span>
          <span>Room {row.slip.roomNumber || "—"}</span>
          <span className="font-mono">{row.slip.confirmationCode || "—"}</span>
          <span>In {row.slip.checkIn || "—"}</span>
          <span>Out {row.slip.checkOut || "—"}</span>
          {row.slip.notes ? <span className="col-span-2 italic text-slate-500 sm:col-span-4">{row.slip.notes}</span> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!completed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            className={`${btn} border-[#3b2819] bg-[#3b2819] text-white hover:bg-[#2b1d13]`}
          >
            {row.slip ? <PencilLine className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {row.slip ? "Edit slip" : "Issue Booking Slip"}
          </button>
        ) : null}
        {row.slip ? (
          <button type="button" onClick={() => setPreview(true)} className={`${btn} border-slate-300 text-slate-700 hover:bg-white`}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
        ) : null}
        {!completed ? (
          <button
            type="button"
            disabled={busy || !row.slip}
            title={row.slip ? undefined : "Issue the slip first."}
            onClick={() => void onFulfill({ complete: true })}
            className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark completed
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800">
            <CheckCheck className="h-3.5 w-3.5" /> Completed by {row.completedBy} · {when(row.completedAt)}
          </span>
        )}
      </div>

      {editing ? (
        <SlipForm row={row} busy={busy} onClose={() => setEditing(false)} onSubmit={(slip) => onFulfill({ slip })} />
      ) : null}
      <AnimatePresence>
        {preview && row.slip ? (
          <SlipReveal
            view={{ requestId: row.id, service: row.service, guest: row.member?.fullName, status: row.status, slip: row.slip, issuedAt: row.fulfilledAt, completedAt: row.completedAt }}
            onClose={() => setPreview(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
