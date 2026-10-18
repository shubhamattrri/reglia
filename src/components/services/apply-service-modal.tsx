"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { secureUpload } from "@/lib/secure-fetch";
import { KYC_ACCEPT } from "@/lib/kyc";
import { LuxModal, luxButton, luxFile, luxInput } from "@/components/services/lux-modal";
import { RequestStatusTrack } from "@/components/services/request-status";

export function ApplyServiceModal({
  service,
  onClose,
  onSubmitted,
}: {
  service: { id: string; title: string; tagline: string };
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("serviceId", service.id);
    setBusy(true);
    setError("");
    const res = await secureUpload<{ id: number }>("/api/member/service-requests", form, setProgress);
    setBusy(false);
    if (!res.ok || !res.data?.id) {
      setError(res.data?.error || "Could not submit the request.");
      return;
    }
    setDone(res.data.id);
    onSubmitted();
  }

  return (
    <LuxModal title={service.title} eyebrow="Apply for service" onClose={onClose} busy={busy}>
      {done ? (
        <div className="grid gap-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-champagne" />
          <p className="text-sm text-warm-white/75">
            Request #{done} is with the desk. A staff reviewer checks your documents and payment first, then an admin gives
            the final approval.
          </p>
          <div className="rounded-xl border border-champagne/20 bg-ink-deep p-3 text-left">
            <RequestStatusTrack status="PENDING_STAFF" paymentStatus="PENDING" />
          </div>
          <button type="button" className={luxButton} onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          {service.tagline ? <p className="text-sm text-warm-white/65">{service.tagline}</p> : null}
          <label className="text-xs uppercase tracking-[0.14em] text-warm-white/60">
            What do you need?
            <textarea
              name="details"
              rows={3}
              maxLength={2000}
              className={`${luxInput} normal-case tracking-normal`}
              placeholder="Dates, destinations, guests, preferences…"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.14em] text-warm-white/60">
            Supporting document <span className="text-red-800">*</span>
            <input name="document" type="file" required accept={KYC_ACCEPT} className={luxFile} />
            <span className="mt-1 block normal-case tracking-normal text-[11px] text-warm-white/45">
              Passport, itinerary or brief — PDF, JPG or PNG up to 5 MB.
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.14em] text-warm-white/60">
              Payment reference
              <input name="paymentReference" maxLength={120} className={`${luxInput} normal-case tracking-normal`} placeholder="Transaction / UTR no." />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-warm-white/60">
              Payment receipt
              <input name="receipt" type="file" accept={KYC_ACCEPT} className={luxFile} />
            </label>
          </div>
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-warm-white/50">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-champagne" />
            Files are stored privately and only visible to you and the review desk.
          </p>
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          <button type="submit" disabled={busy} className={luxButton}>
            {busy ? `Uploading ${Math.round(progress * 100)}%` : "Submit request"}
          </button>
        </form>
      )}
    </LuxModal>
  );
}
