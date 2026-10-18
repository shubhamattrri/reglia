"use client";

import { VerificationDesk } from "@/components/desk/verification-desk";

export default function AdminVerificationDeskPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--da-primary)]">Approvals</p>
        <h1 className="mt-1 text-xl font-semibold text-[#1d2630]">Approvals desk</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#5b6b79]">
          Service applications and tier upgrades pass staff review first; your approval is the final step. Upgrades take
          effect as soon as you approve them.
        </p>
      </div>
      <VerificationDesk as="admin" />
    </div>
  );
}
