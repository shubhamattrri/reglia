"use client";

import { useEffect, useState } from "react";
import { Eye, FileText, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { KycStatusPill, type KycDocument } from "@/components/kyc/kyc-uploader";
import { staffGet } from "@/lib/staff-client";
import { KYC_OVERALL_LABEL, type KycSummary } from "@/lib/kyc";

/** Read-only identity documents for a member the staff user is assigned to. */
export function MemberKycSheet({
  member,
  onClose,
}: {
  member: { id: string; fullName: string; regaliaId: string | null };
  onClose: () => void;
}) {
  const [data, setData] = useState<{ documents: KycDocument[]; summary: KycSummary } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void staffGet<{ documents: KycDocument[]; summary: KycSummary }>(
      `/api/staff/members/${member.id}/documents`,
    ).then((d) => (d ? setData(d) : setFailed(true)));
  }, [member.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-lux-gold/20 bg-lux-black p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-lux-gold/75">Member identity</p>
            <p className="mt-1 font-display text-2xl text-warm-white">{member.fullName}</p>
            <p className="font-mono text-xs text-warm-white/45">{member.regaliaId ?? "Applicant · ID issued on approval"}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-warm-white/50 hover:text-warm-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!data && !failed ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-warm-white/45">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : failed ? (
          <p className="mt-8 text-sm text-red-700">You can view documents only for members assigned to you.</p>
        ) : data ? (
          <>
            <div className="mt-6 flex items-center gap-3 border border-lux-gold/25 bg-lux-green/40 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-lux-gold" />
              <div>
                <p className="text-sm text-warm-white">{KYC_OVERALL_LABEL[data.summary.overall]}</p>
                <p className="text-[11px] text-warm-white/45">
                  {data.summary.counts.verified} verified · {data.summary.counts.pending} pending ·{" "}
                  {data.summary.counts.rejected} rejected
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-2">
              {data.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 border border-warm-white/10 bg-lux-panel px-3 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-lux-gold/70" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-warm-white">{d.documentType}</p>
                    <p className="truncate text-[11px] text-warm-white/40">{d.originalName}</p>
                  </div>
                  <KycStatusPill status={d.status} />
                  <a href={d.url} target="_blank" rel="noreferrer" className="p-1 text-warm-white/50 hover:text-lux-gold" aria-label="View document">
                    <Eye className="h-4 w-4" />
                  </a>
                </li>
              ))}
              {!data.documents.length ? (
                <li className="border border-dashed border-warm-white/10 px-4 py-6 text-center text-sm text-warm-white/40">
                  No documents on file.
                </li>
              ) : null}
            </ul>
            <p className="mt-6 text-[11px] leading-relaxed text-warm-white/35">
              Access is limited to staff holding one of this member&apos;s tickets.
              Verification decisions are made by administrators.
            </p>
          </>
        ) : null}
      </aside>
    </div>
  );
}
