"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Loader } from "lucide-react";
import { AppShell } from "@/components/regalia/app-shell";
import { readJson } from "@/lib/http";

/** Public verification: registry ID, tier and status only. */
type VerifyPayload = {
  verified: boolean;
  status: string;
  regaliaId: string | null;
  tier: { code: string | null; name: string };
};

type Phase = "idle" | "scanning" | "authenticating" | "profile" | "error";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  REVOKED: "Cancelled",
  CARD_LOST: "Card reported lost",
  CARD_REPLACED: "Card replaced",
  CARD_REVOKED: "Card revoked",
};

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [data, setData] = useState<VerifyPayload | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>(token ? "scanning" : "idle");

  useEffect(() => {
    if (!token) {
      setPhase("idle");
      setError("");
      return;
    }

    let live = true;
    setPhase("scanning");
    setError("");

    const scanWait = window.setTimeout(() => {
      if (live) setPhase("authenticating");
    }, 700);

    fetch(`/api/verify?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const json = await readJson<VerifyPayload & { error?: string }>(r);
        if (!r.ok) throw new Error(json?.error || "Unrecognised.");
        return json;
      })
      .then((json) => {
        if (!live || !json) return;
        window.setTimeout(() => {
          if (!live) return;
          setData(json);
          setPhase("profile");
        }, 900);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Verification failed.");
        setPhase("error");
      });

    return () => {
      live = false;
      window.clearTimeout(scanWait);
    };
  }, [token]);

  const tone = data?.verified
    ? "text-emerald-700"
    : data?.status === "SUSPENDED" || data?.status === "PENDING"
      ? "text-amber-700"
      : "text-red-700";

  return (
    <AppShell eyebrow="Secure verification" title="REGALIA authentication.">
      {phase === "idle" && (
        <p className="max-w-lg text-sm text-warm-white/55">
          Scan a Regalia card QR. The mark contains no personal data — only a
          one-way verification key that opens this secure page.
        </p>
      )}

      {(phase === "scanning" || phase === "authenticating") && (
        <div className="mt-8 max-w-md border border-champagne/20 bg-ink-deep/70 p-8 text-center">
          <Loader className="mx-auto h-10 w-10 animate-spin text-champagne" />
          <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-champagne">
            {phase === "scanning" ? "QR scan received" : "Membership authentication"}
          </p>
          <p className="mt-3 text-sm text-warm-white/60">
            {phase === "scanning"
              ? "Opening the secure REGALIA verification page."
              : "Confirming the token against the member register."}
          </p>
        </div>
      )}

      {phase === "error" && (
        <p className="mt-8 max-w-lg border border-red-700/30 bg-red-950/30 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {phase === "profile" && data && (
        <div className="mt-8 max-w-lg border border-champagne/25 bg-ink-deep/70 p-8">
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-champagne">
            <ShieldCheck className="h-4 w-4" />
            Registry record
          </p>
          <dl className="mt-6 space-y-3 text-sm text-warm-white/70">
            <Row label="Registry ID" value={data.regaliaId || "Not yet issued"} mono />
            <Row label="Tier" value={data.tier.name} />
            <Row label="Status" value={STATUS_LABEL[data.status] || data.status} />
          </dl>
          <p className={`mt-6 text-[11px] uppercase tracking-[0.32em] ${tone}`}>
            {data.verified ? "Verified member" : "Not in good standing"}
          </p>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-warm-white/10 pb-2">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-warm-white/40">{label}</dt>
      <dd translate="no" className={mono ? "font-mono text-right tracking-[0.08em] tabular-nums" : "text-right"}>
        {value}
      </dd>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
