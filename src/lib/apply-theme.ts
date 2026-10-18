import type { SiteSettings } from "@/lib/site-settings";

export function applySiteTheme(settings: SiteSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--ink", settings.siteInk);
  root.style.setProperty("--ink-deep", settings.siteInkDeep);
  root.style.setProperty("--navy", settings.siteInkDeep);
  root.style.setProperty("--champagne", settings.siteChampagne);
  root.style.setProperty("--champagne-bright", `color-mix(in srgb, ${settings.siteChampagne} 80%, black)`);
  root.style.setProperty("--warm-white", settings.siteWarmWhite);
  root.style.setProperty("--muted", settings.siteMuted);
  root.style.setProperty("--background", settings.siteInk);
  root.style.setProperty("--foreground", settings.siteFont);
  root.style.setProperty("--card", settings.siteInkDeep);
  root.style.setProperty("--primary", settings.siteChampagne);
  root.style.setProperty("--primary-foreground", settings.siteButtonText);
  root.style.setProperty("--muted-foreground", settings.siteMuted);
  root.style.setProperty("--button-bg", settings.siteButtonBg);
  root.style.setProperty("--button-text", settings.siteButtonText);
  root.style.setProperty("--color-ink", settings.siteInk);
  root.style.setProperty("--color-ink-deep", settings.siteInkDeep);
  root.style.setProperty("--color-navy", settings.siteInkDeep);
  root.style.setProperty("--color-champagne", settings.siteChampagne);
  root.style.setProperty("--color-warm-white", settings.siteWarmWhite);
  root.style.setProperty("--color-muted", settings.siteMuted);
  root.style.setProperty("--color-background", settings.siteInk);
  root.style.setProperty("--color-foreground", settings.siteFont);
  root.style.setProperty("--color-card", settings.siteInkDeep);
  root.style.setProperty("--color-primary", settings.siteChampagne);
  root.style.setProperty("--color-secondary", settings.siteInkDeep);
  root.style.setProperty("--color-accent", settings.siteChampagne);
  root.style.setProperty("--color-chart-1", settings.siteChampagne);
  root.style.setProperty("--color-chart-3", settings.siteChampagne);
  root.style.setProperty("--color-chart-4", settings.siteInkDeep);
  root.style.setProperty("--color-chart-5", settings.siteMuted);
  const admin = document.querySelector<HTMLElement>(".datta-admin");
  if (!admin) {
    root.style.backgroundColor = settings.siteInk;
    document.body.style.backgroundColor = settings.siteInk;
    document.body.style.color = settings.siteFont;
  }

  if (admin) {
    admin.style.setProperty("--da-primary", settings.adminPrimary);
    admin.style.setProperty("--da-primary-soft", `${settings.adminPrimary}1f`);
    admin.style.setProperty("--da-sidebar", settings.adminSidebar);
    admin.style.setProperty("--da-body", settings.adminBody);
    admin.style.setProperty("--da-text", settings.adminFont);
    admin.style.setProperty("--da-brand", settings.adminSidebar);
    admin.style.setProperty("--da-header", settings.adminSidebar);
    admin.style.setProperty("--da-button-bg", settings.adminButtonBg);
    admin.style.setProperty("--da-button-text", settings.adminButtonText);
  }
}
