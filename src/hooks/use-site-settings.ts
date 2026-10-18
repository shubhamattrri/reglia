"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
} from "@/lib/site-settings";
import { applySiteTheme } from "@/lib/apply-theme";
import { SETTINGS_EVENT } from "@/lib/settings-events";

/** Last settings fetched in this tab, so remounts after client navigation skip the default flash. */
let lastLoaded: SiteSettings | null = null;
/** Every component on a page uses this hook; share one request between them. */
let inflight: Promise<SiteSettings | null> | null = null;

function fetchSettings() {
  inflight ??= fetch("/api/site-settings", { cache: "no-store" })
    .then((res) => res.text())
    .then((text) => {
      const data = text.trim()
        ? (JSON.parse(text) as SiteSettings & { error?: string })
        : null;
      if (!data || data.error) return null;
      lastLoaded = { ...data };
      applySiteTheme(data);
      return lastLoaded;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * `ready` turns true once the saved settings have been fetched (or the fetch failed),
 * so media like the hero video can wait instead of flashing the built-in defaults.
 */
export function useSiteSettingsState() {
  const [state, setState] = useState<{ settings: SiteSettings; ready: boolean }>(() =>
    lastLoaded
      ? { settings: lastLoaded, ready: true }
      : { settings: { ...DEFAULT_SITE_SETTINGS }, ready: false },
  );

  useEffect(() => {
    let live = true;

    async function load() {
      const data = await fetchSettings();
      if (!live) return;
      if (data) setState({ settings: data, ready: true });
      else setState((s) => (s.ready ? s : { ...s, ready: true }));
    }

    void load();
    window.addEventListener(SETTINGS_EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.removeEventListener(SETTINGS_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, []);

  return state;
}

export function useSiteSettings() {
  return useSiteSettingsState().settings;
}
