"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useStaffDesk } from "@/components/staff/desk-shell";
import { formatBirthDate } from "@/lib/member-profile";

export default function StaffSettingsPage() {
  const { me, kycVerified, busy, savingStatus, toggleAvailability, logout } = useStaffDesk();
  if (!me) return <p className="text-sm text-warm-white/50">Loading your profile…</p>;
  const s = me.staff;
  const rows: [string, string][] = [
    ["Full name", s.fullName],
    ["Staff ID", s.staffCode],
    ["Email", s.email],
    ["Phone", s.phone || "—"],
    ["Region", s.region || "—"],
    ["Date of birth", formatBirthDate(s.dateOfBirth) || "—"],
    ["Address", s.address || "—"],
    ["Verification", kycVerified ? "Verified" : "Pending"],
    ["Last sign-in", s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : "—"],
  ];

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-lg border border-lux-gold/15 bg-[#fbf7ef] p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-lux-gold">Profile</p>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[10px] uppercase tracking-[0.2em] text-warm-white/50">{k}</dt>
              <dd className="mt-1 break-words text-sm text-warm-white">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-xs text-warm-white/50">Profile details and your password are managed by an administrator.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-lux-gold/15 bg-[#fbf7ef] p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-lux-gold">Availability</p>
          <p className="mt-3 text-sm text-warm-white/70">
            {busy
              ? "You are busy: you keep your current chats but cannot claim new requests."
              : "You are available to claim new chats and requests."}
          </p>
          <button
            type="button"
            onClick={() => void toggleAvailability()}
            disabled={savingStatus}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-lux-gold px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] text-lux-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {busy ? "Become available" : "Set as busy"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-lux-gold/25 px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-warm-white/70 transition-colors hover:border-lux-gold/60 hover:text-lux-gold"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
