export type FileKind = "pdf" | "jpeg" | "png" | "webp" | "mp4" | "webm";

export const FILE_KIND_META: Record<FileKind, { mime: string; ext: string; exts: string[] }> = {
  pdf: { mime: "application/pdf", ext: "pdf", exts: ["pdf"] },
  jpeg: { mime: "image/jpeg", ext: "jpg", exts: ["jpg", "jpeg"] },
  png: { mime: "image/png", ext: "png", exts: ["png"] },
  webp: { mime: "image/webp", ext: "webp", exts: ["webp"] },
  mp4: { mime: "video/mp4", ext: "mp4", exts: ["mp4", "m4v"] },
  webm: { mime: "video/webm", ext: "webm", exts: ["webm"] },
};

function ascii(buf: Buffer, start: number, end: number) {
  return buf.subarray(start, end).toString("latin1");
}

/** Identifies a file by its leading bytes; extensions and browser MIME types are not trusted. */
export function detectFileKind(buf: Buffer): FileKind | null {
  if (buf.length < 12) return null;
  if (ascii(buf, 0, 5) === "%PDF-") return "pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf[0] === 0x89 &&
    ascii(buf, 1, 4) === "PNG" &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "webp";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  if (ascii(buf, 4, 8) === "ftyp") {
    const brand = ascii(buf, 8, 12);
    if (brand !== "qt  ") return "mp4";
  }
  return null;
}

export type ValidatedUpload = {
  kind: FileKind;
  ext: string;
  mime: string;
  buffer: Buffer;
  size: number;
  originalName: string;
};

/**
 * Validates an uploaded File against an allow-list: size limit, extension,
 * declared MIME type and actual file signature must all agree.
 */
export async function validateUpload(
  file: FormDataEntryValue | null,
  allowed: FileKind[],
  maxBytes: number,
): Promise<{ ok: true; file: ValidatedUpload } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size < 1) {
    return { ok: false, error: "Choose a file to upload." };
  }
  const allowedLabel = allowed
    .map((k) => FILE_KIND_META[k].ext.toUpperCase())
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    };
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const byExt = allowed.find((k) => FILE_KIND_META[k].exts.includes(ext));
  if (!byExt) return { ok: false, error: `Only ${allowedLabel} files are accepted.` };

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectFileKind(buffer);
  if (!kind || !allowed.includes(kind)) {
    return { ok: false, error: `File contents do not match an accepted type (${allowedLabel}).` };
  }
  if (FILE_KIND_META[kind].ext !== FILE_KIND_META[byExt].ext) {
    return { ok: false, error: "File extension does not match its contents." };
  }
  const declared = (file.type || "").toLowerCase();
  if (declared && declared !== "application/octet-stream") {
    const okMime =
      declared === FILE_KIND_META[kind].mime || (kind === "jpeg" && declared === "image/jpg");
    if (!okMime) return { ok: false, error: "File type does not match its contents." };
  }

  return {
    ok: true,
    file: {
      kind,
      ext: FILE_KIND_META[kind].ext,
      mime: FILE_KIND_META[kind].mime,
      buffer,
      size: file.size,
      originalName: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || `upload.${ext}`,
    },
  };
}
