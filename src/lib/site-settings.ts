export const DEFAULT_SITE_SETTINGS = {
  siteInk: "#f6efe2",
  siteInkDeep: "#ece0cb",
  siteChampagne: "#8a5a2e",
  siteWarmWhite: "#3b2819",
  siteMuted: "#7b6450",
  siteFont: "#3b2819",
  siteButtonBg: "#6e4322",
  siteButtonText: "#fbf6ec",
  adminPrimary: "#8a5a2e",
  adminSidebar: "#f3ebdd",
  adminBody: "#f8f3ea",
  adminFont: "#2f2116",
  adminButtonBg: "#6e4322",
  adminButtonText: "#fbf6ec",
  homeHeroImage: "",
  homeHeroVideo: "/videos/hero.mp4",
  loginBackgroundVideo: "",
  adminUsername: "admin",
  adminPasswordHash: "",
  heroImage: "",
  heroVideo: "/videos/center.mp4",
  alpineImage: "",
  forestImage: "",
  excellenceLeft: "",
  excellenceRight: "",
  siteLogo: "/brand/logo.svg",
  adminLogo: "/brand/logo.svg",
  preloaderLogo: "",
  animCardImage: "",
  animCardLabel: "LIMASU",
  animCardSublabel: "REGALIA",
  footerImage1: "",
  footerImage2: "",
  footerImage3: "",
  footerImage4: "",
  footerVideo: "/videos/footer.mp4",
  membershipShowcase1: "",
  membershipShowcase2: "",
  membershipShowcase3: "",
  membershipShowcase4: "",
  assistanceHeroImage: "",
  assistanceHeroVideo: "/videos/center.mp4",
  storyImage1: "",
  storyImage2: "",
  storyImage3: "",
  escrowImage1: "",
  escrowImage2: "",
  escrowImage3: "",
  escrowImage4: "",
  escrowImage5: "",
  escrowImage6: "",
  whatWeDo: "",
  technology: "",
  serviceChapters: "",
} as const;

export type SiteSettings = {
  [K in keyof typeof DEFAULT_SITE_SETTINGS]: string;
};

export function mergeSettings(
  rows: { key: string; value: string }[]
): SiteSettings {
  const next = { ...DEFAULT_SITE_SETTINGS };
  for (const row of rows) {
    if (row.key in next) {
      (next as Record<string, string>)[row.key] = row.value;
    }
  }
  return next;
}
