"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  FileText,
  IdCard,
  LoaderCircle,
  Lock,
  Trash2,
  Upload,
} from "lucide-react";
import { readJson } from "@/lib/http";
import { secureJson, secureUpload } from "@/lib/secure-fetch";
import {
  DOCUMENT_TYPES,
  KYC_ACCEPT,
  KYC_MAX_BYTES,
  KYC_OVERALL_LABEL,
  PRIMARY_PHOTO_IDS,
  summarizeKyc,
  type DocumentType,
  type KycSummary,
} from "@/lib/kyc";
import { cn } from "@/lib/utils";

export type KycDocument = {
  id: string;
  documentType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  reviewNote: string | null;
  uploadedAt: string;
  url: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function KycStatusPill({ status }: { status: KycDocument["status"] }) {
  const map = {
    PENDING: {
      icon: Clock,
      label: "Pending review",
      cls: "border-lux-gold-soft/40 bg-lux-gold/10 text-lux-gold-soft",
    },
    VERIFIED: {
      icon: CircleCheck,
      label: "Verified",
      cls: "border-emerald-700/40 bg-emerald-600/10 text-emerald-700",
    },
    REJECTED: {
      icon: CircleX,
      label: "Rejected",
      cls: "border-red-700/40 bg-red-600/10 text-red-700",
    },
  }[status];
  const Icon = map.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]",
        map.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {map.label}
    </span>
  );
}

export function KycUploader({
  onSummary,
  intro,
  endpoint = "/api/member/documents",
  canDelete = true,
}: {
  onSummary?: (summary: KycSummary) => void;
  intro?: string;
  /** Collection endpoint supporting GET (list) and POST (multipart upload). */
  endpoint?: string;
  canDelete?: boolean;
}) {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [summary, setSummary] = useState<KycSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentType, setDocumentType] = useState<DocumentType>("Aadhaar Card");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const summaryCb = useRef(onSummary);
  summaryCb.current = onSummary;

  const applySummary = useCallback((next: KycSummary) => {
    setSummary(next);
    summaryCb.current?.(next);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(endpoint, { cache: "no-store" });
    const data = await readJson<{ documents?: KycDocument[]; summary?: KycSummary }>(res);
    setLoading(false);
    if (!data?.documents) return;
    setDocuments(data.documents);
    applySummary(data.summary ?? summarizeKyc(data.documents));
  }, [applySummary, endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!summary) return;
    if (!summary.hasPrimary) setDocumentType("Aadhaar Card");
    else if (!summary.hasSecondary) setDocumentType("PAN Card");
  }, [summary]);

  function pick(next: File | undefined | null) {
    setError("");
    if (!next) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(next.name)) {
      setError("Only PDF, JPG or PNG files are accepted.");
      return;
    }
    if (next.size > KYC_MAX_BYTES) {
      setError("File is too large. Maximum size is 5 MB.");
      return;
    }
    setFile(next);
  }

  async function submit() {
    if (!file) return;
    const form = new FormData();
    form.set("documentType", documentType);
    form.set("file", file);
    setProgress(0);
    setError("");
    const res = await secureUpload<{ document: KycDocument; summary?: KycSummary }>(
      endpoint,
      form,
      setProgress,
    );
    setProgress(null);
    if (!res.ok || !res.data?.document) {
      setError(res.data?.error || "Upload failed. Try again.");
      return;
    }
    setFile(null);
    const next = [res.data.document, ...documents];
    setDocuments(next);
    applySummary(res.data.summary ?? summarizeKyc(next));
  }

  async function remove(doc: KycDocument) {
    if (!window.confirm(`Remove ${doc.documentType} (${doc.originalName})?`)) return;
    const res = await secureJson<{ summary: KycSummary }>(`/api/member/documents/${doc.id}`, "DELETE");
    if (!res.ok) {
      setError(res.data?.error || "Could not remove the document.");
      return;
    }
    setDocuments((cur) => cur.filter((d) => d.id !== doc.id));
    if (res.data?.summary) applySummary(res.data.summary);
  }

  const requirements = [
    {
      done: Boolean(summary?.hasPrimary),
      title: "Government photo ID",
      hint: PRIMARY_PHOTO_IDS.join(", "),
    },
    {
      done: Boolean(summary?.hasSecondary),
      title: "One further government document",
      hint: "A different type — e.g. PAN Card",
    },
  ];

  return (
    <div className="space-y-6">
      {intro ? <p className="text-sm leading-relaxed text-warm-white/60">{intro}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {requirements.map((r) => (
          <div
            key={r.title}
            className={cn(
              "flex items-start gap-3 rounded-sm border p-4 transition-colors",
              r.done
                ? "border-lux-gold/45 bg-lux-green/50"
                : "border-warm-white/10 bg-lux-panel",
            )}
          >
            {r.done ? (
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-lux-gold" />
            ) : (
              <IdCard className="mt-0.5 h-4 w-4 shrink-0 text-warm-white/35" />
            )}
            <div>
              <p className={cn("text-sm", r.done ? "text-warm-white" : "text-warm-white/70")}>
                {r.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-warm-white/40">{r.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-lux-gold/20 bg-lux-panel p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
          <label className="grid gap-1.5 text-[10px] uppercase tracking-[0.22em] text-lux-gold/75">
            Document type
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="border border-lux-gold/25 bg-lux-black px-3 py-2.5 text-sm normal-case tracking-normal text-warm-white outline-none focus:border-lux-gold"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex min-h-[86px] items-center justify-center gap-3 border border-dashed px-4 py-4 text-left transition-colors",
              dragOver
                ? "border-lux-gold bg-lux-gold/10"
                : "border-lux-gold/30 hover:border-lux-gold/60 hover:bg-lux-gold/[0.04]",
            )}
          >
            {file ? (
              <>
                <FileText className="h-5 w-5 shrink-0 text-lux-gold" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-warm-white">{file.name}</span>
                  <span className="text-[11px] text-warm-white/45">
                    {formatBytes(file.size)} · click to change
                  </span>
                </span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 shrink-0 text-lux-gold/80" />
                <span>
                  <span className="block text-sm text-warm-white/80">
                    Drop a file or click to browse
                  </span>
                  <span className="text-[11px] text-warm-white/40">PDF, JPG or PNG · max 5 MB</span>
                </span>
              </>
            )}
          </button>
          <input
            ref={input}
            type="file"
            accept={KYC_ACCEPT}
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {progress !== null ? (
          <div className="mt-4 h-1 overflow-hidden bg-warm-white/10">
            <div
              className="h-full bg-gradient-to-r from-lux-gold-soft to-lux-gold transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11px] text-warm-white/40">
            <Lock className="h-3.5 w-3.5 text-lux-gold/60" />
            Stored in a private vault — never publicly accessible. Reviewed only by the
            verification desk.
          </p>
          <button
            type="button"
            disabled={!file || progress !== null}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 bg-lux-gold px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-lux-black transition-colors hover:bg-[#e2c35a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {progress !== null ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : "Upload securely"}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-lux-gold/70">Your documents</p>
          {summary ? (
            <span className="text-[11px] text-warm-white/50">
              Status · <span className="text-lux-gold-soft">{KYC_OVERALL_LABEL[summary.overall]}</span>
            </span>
          ) : null}
        </div>
        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-warm-white/45">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : documents.length ? (
          <ul className="mt-3 divide-y divide-warm-white/[0.06] border border-warm-white/10">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <FileText className="h-4 w-4 shrink-0 text-lux-gold/70" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-warm-white">{doc.documentType}</p>
                  <p className="truncate text-[11px] text-warm-white/40">
                    {doc.originalName} · {formatBytes(doc.sizeBytes)} ·{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                  {doc.status === "REJECTED" && doc.reviewNote ? (
                    <p className="mt-1 text-[12px] text-red-700/90">Reason: {doc.reviewNote}</p>
                  ) : null}
                </div>
                <KycStatusPill status={doc.status} />
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-warm-white/50 hover:text-lux-gold"
                  aria-label={`View ${doc.documentType}`}
                >
                  <Eye className="h-4 w-4" />
                </a>
                {canDelete && doc.status !== "VERIFIED" ? (
                  <button
                    type="button"
                    onClick={() => void remove(doc)}
                    className="p-1.5 text-warm-white/40 hover:text-red-700"
                    aria-label={`Remove ${doc.documentType}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 border border-dashed border-warm-white/10 px-4 py-6 text-center text-sm text-warm-white/40">
            No documents uploaded yet.
          </p>
        )}
      </div>
    </div>
  );
}
