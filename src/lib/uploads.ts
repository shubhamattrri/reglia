import path from "path";

export function uploadsDir() {
  return path.join(process.cwd(), "data", "uploads");
}

export function safeUploadName(name: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!base || base === "." || base === ".." || base.includes("..")) return "";
  return base;
}

export const UPLOAD_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};
