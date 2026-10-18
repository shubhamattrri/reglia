"use client";

import { useState } from "react";
import type { useConfirm } from "@/components/admin/confirm-dialog";
import { readJson } from "@/lib/http";

export type AccountStatus = "ACTIVE" | "DEACTIVATED";

type Ask = ReturnType<typeof useConfirm>[0];

/** Active / Deactivated toggle. Deactivating blocks sign-in and ends the member's current session. */
export function AccountSwitch({
  member,
  ask,
  onChanged,
}: {
  member: { id: string; fullName: string; accountStatus?: AccountStatus };
  ask: Ask;
  onChanged: (status: AccountStatus | null, message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const active = (member.accountStatus ?? "ACTIVE") === "ACTIVE";

  async function toggle() {
    const next: AccountStatus = active ? "DEACTIVATED" : "ACTIVE";
    const ok = await ask(
      active
        ? {
            title: `Deactivate ${member.fullName}?`,
            message: "They are signed out immediately and cannot sign in until you reactivate the account.",
            confirmLabel: "Deactivate",
            cancelLabel: "Keep active",
          }
        : {
            title: `Reactivate ${member.fullName}?`,
            message: "They can sign in and use their membership again.",
            confirmLabel: "Reactivate",
            tone: "primary",
          },
    );
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountStatus: next }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) return onChanged(null, data?.error || "Could not change the account status.");
    onChanged(next, next === "ACTIVE" ? `${member.fullName} reactivated` : `${member.fullName} deactivated`);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${member.fullName}'s account is ${active ? "active" : "deactivated"}`}
      disabled={busy}
      onClick={() => void toggle()}
      className="datta-switch"
      style={{ color: active ? "#14804a" : "#c43c3c" }}
    >
      <span className="datta-switch-track" aria-hidden />
      {active ? "Active" : "Deactivated"}
    </button>
  );
}
