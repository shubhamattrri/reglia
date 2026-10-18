import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_SITE_SETTINGS,
  mergeSettings,
  type SiteSettings,
} from "@/lib/site-settings";

const FILE = path.join(process.cwd(), "data", "site-settings.json");

export async function readFileSettings(): Promise<Partial<SiteSettings>> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Partial<SiteSettings> = {};
    for (const key of Object.keys(DEFAULT_SITE_SETTINGS)) {
      const value = parsed[key];
      if (typeof value === "string") {
        (next as Record<string, string>)[key] = value;
      }
    }
    return next;
  } catch {
    return {};
  }
}

export async function writeFileSettings(patch: Partial<SiteSettings>) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const current = await readFileSettings();
  const next = { ...current, ...patch };
  await writeFile(FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function mergeSettingSources(
  rows: { key: string; value: string }[],
  file: Partial<SiteSettings>
): SiteSettings {
  const overlay = Object.entries(file).map(([key, value]) => ({ key, value }));
  return mergeSettings([...rows, ...overlay]);
}
