"use client";

import { useState } from "react";
import { CircleUserRound, Film } from "lucide-react";
import { Button } from "@/components/ui/button-1";
import { useFileUpload } from "@/components/ui/file-upload";
import { readJson } from "@/lib/http";
import { isUsableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

export function ImageSlot({
  section,
  name,
  hint,
  slot,
  value,
  onChange,
  kind = "image",
}: {
  section: string;
  name: string;
  hint?: string;
  slot: string;
  value: string;
  onChange: (url: string) => void;
  kind?: "image" | "video";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [{ files, isDragging, errors }, actions] = useFileUpload({
    accept: kind === "video" ? "video/mp4,video/webm,video/quicktime,video/*" : "image/*",
    multiple: false,
    onFilesAdded: (added) => {
      const file = added[0]?.file;
      if (file instanceof File) void upload(file);
    },
  });

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("slot", slot);
      const res = await fetch("/api/admin/upload", { method: "POST", body: data });
      const json = await readJson<{ url?: string; error?: string }>(res);
      if (!res.ok || !json?.url) {
        setError(json?.error || "Upload failed. Try a smaller file.");
        return;
      }
      onChange(json.url);
    } catch {
      setError("Upload could not reach the server. Try a smaller file.");
    } finally {
      setBusy(false);
    }
  }

  const saved = isUsableImageSrc(value) ? value : "";
  const previewUrl = files[0]?.preview || saved || null;
  const fileName = files[0]?.file.name || (saved ? saved.split("/").pop() || saved : null);
  const label = kind === "video" ? "video" : "image";

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-white p-4",
        isDragging ? "border-[var(--da-primary)] bg-[var(--da-primary-soft)]" : "border-[#dbe0e5]",
      )}
      onDragEnter={actions.handleDragEnter}
      onDragLeave={actions.handleDragLeave}
      onDragOver={actions.handleDragOver}
      onDrop={actions.handleDrop}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--da-primary)]">
        {section}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#1d2630]">{name}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-[#5b6b79]">{hint}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#dbe0e5] bg-[#f8f9fa]"
          aria-label={previewUrl ? `Preview of ${name}` : `No ${label} yet`}
        >
          {previewUrl && kind === "video" ? (
            <video src={previewUrl} className="size-full object-cover" muted playsInline />
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : kind === "video" ? (
            <Film className="size-4 text-[var(--da-primary)]" aria-hidden />
          ) : (
            <CircleUserRound className="size-4 text-[var(--da-primary)]" aria-hidden />
          )}
        </div>
        <Button type="button" onClick={actions.openFileDialog} disabled={busy}>
          {busy ? "Uploading…" : fileName ? `Change ${label}` : `Upload ${label}`}
        </Button>
        <input
          {...actions.getInputProps()}
          className="sr-only"
          aria-label={`Upload ${name}`}
          tabIndex={-1}
        />
      </div>

      {fileName ? (
        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs">
          <p className="truncate text-[#5b6b79]" aria-live="polite">
            {fileName}
          </p>
          <button
            type="button"
            onClick={() => {
              if (files[0]?.id) actions.removeFile(files[0].id);
              onChange("");
            }}
            className="shrink-0 font-medium text-[#ea4d4d] hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-[#5b6b79]">No {label} attached. You can also drop a file here.</p>
      )}

      <input
        className="datta-input mt-3"
        placeholder={kind === "video" ? "/videos/hero.mp4 or uploaded path" : "https://… or uploaded path"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {error || errors[0] ? (
        <p className="mt-2 text-xs text-[#ea4d4d]">{error || errors[0]}</p>
      ) : null}
    </div>
  );
}
