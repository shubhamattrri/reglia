"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Download, Eye, FileText, RotateCcw, X } from "lucide-react";

export type ReviewDoc = {
  id: string;
  documentType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  reviewNote: string | null;
  uploadedAt: string;
  url: string;
  uploadedBy?: string;
};

export function StatusPill({ status }: { status: ReviewDoc["status"] | string }) {
  const cls =
    status === "VERIFIED"
      ? "datta-pill-verified"
      : status === "REJECTED"
        ? "datta-pill-rejected"
        : status === "PENDING"
          ? "datta-pill-pending"
          : "datta-pill-muted";
  return <span className={`datta-pill ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Document table with inline preview and verify / reject / reset actions. */
export function DocumentReviewList({
  documents,
  onReview,
}: {
  documents: ReviewDoc[];
  onReview: (doc: ReviewDoc, status: ReviewDoc["status"], note?: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<ReviewDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(doc: ReviewDoc, status: ReviewDoc["status"]) {
    let note: string | undefined;
    if (status === "REJECTED") {
      const reason = window.prompt(
        `Reason for rejecting ${doc.documentType}? (shown to the account holder)`,
        doc.reviewNote || "Image is unclear — please upload a sharper scan.",
      );
      if (!reason?.trim()) return;
      note = reason.trim();
    }
    setBusy(doc.id);
    await onReview(doc, status, note);
    setBusy(null);
  }

  if (!documents.length) {
    return <p className="px-4 py-6 text-sm text-[#8996a4]">No documents uploaded.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-[#eef1f4]">
        {documents.map((doc) => (
          <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setPreview(doc)}
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc]"
              aria-label={`Preview ${doc.documentType}`}
            >
              {doc.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-5 w-5 text-[#c43c3c]" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1d2630]">
                {doc.documentType} <StatusPill status={doc.status} />
              </p>
              <p className="truncate text-xs text-[#8996a4]">
                {doc.originalName} · {formatBytes(doc.sizeBytes)} ·{" "}
                {new Date(doc.uploadedAt).toLocaleString()}
                {doc.uploadedBy ? ` · uploaded by ${doc.uploadedBy}` : ""}
              </p>
              {doc.reviewNote ? (
                <p className="mt-0.5 text-xs text-[#c43c3c]">Note: {doc.reviewNote}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className="datta-btn datta-btn-ghost h-8 px-2.5 text-xs" onClick={() => setPreview(doc)}>
                <Eye className="h-3.5 w-3.5" /> View
              </button>
              {doc.status !== "VERIFIED" ? (
                <button
                  type="button"
                  disabled={busy === doc.id}
                  className="datta-btn h-8 bg-[#14804a] px-2.5 text-xs"
                  onClick={() => void act(doc, "VERIFIED")}
                >
                  <CircleCheck className="h-3.5 w-3.5" /> Verify
                </button>
              ) : null}
              {doc.status !== "REJECTED" ? (
                <button
                  type="button"
                  disabled={busy === doc.id}
                  className="datta-btn datta-btn-danger h-8 px-2.5 text-xs"
                  onClick={() => void act(doc, "REJECTED")}
                >
                  <CircleX className="h-3.5 w-3.5" /> Reject
                </button>
              ) : null}
              {doc.status !== "PENDING" ? (
                <button
                  type="button"
                  disabled={busy === doc.id}
                  className="rounded-md p-2 text-[#5b6b79] hover:bg-[#eef1f5]"
                  title="Reset to pending"
                  onClick={() => void act(doc, "PENDING")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1d2630]">{preview.documentType}</p>
                <p className="truncate text-xs text-[#8996a4]">{preview.originalName}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`${preview.url}?download=1`} className="datta-btn datta-btn-ghost h-8 px-2.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button
                  type="button"
                  className="rounded-md p-2 text-[#5b6b79] hover:bg-[#eef1f5]"
                  onClick={() => setPreview(null)}
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[#1d2630]">
              {preview.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.documentType} className="mx-auto max-h-[80svh] object-contain" />
              ) : (
                <iframe title={preview.documentType} src={preview.url} className="h-[80svh] w-full bg-white" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
