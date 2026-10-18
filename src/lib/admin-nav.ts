import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Brush,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileCheck,
  FileText,
  Film,
  ImageIcon,
  LayoutDashboard,
  MessageCircle,
  Palette,
  PanelsTopLeft,
  QrCode,
  ScrollText,
  Settings2,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

/** Dispatch on window after an admin action so the sidebar badges refresh at once. */
export const NAV_COUNTS_EVENT = "datta:nav-counts";

export function refreshNavCounts() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NAV_COUNTS_EVENT));
}

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/** Primary sidebar — grouped like a clear ops console */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Members, revenue and priority tickets",
      },
    ],
  },
  {
    id: "members",
    label: "Members & access",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        description: "Member accounts and profiles",
      },
      {
        href: "/admin/memberships",
        label: "Memberships",
        icon: BadgeCheck,
        description: "Tiers, status and approvals",
      },
      {
        href: "/admin/plans",
        label: "Plans & renewals",
        icon: CalendarClock,
        description: "Durations, prices and expiring members",
      },
      {
        href: "/admin/cards",
        label: "Cards & identity",
        icon: CreditCard,
        description: "Physical cards and Regalia IDs",
      },
      {
        href: "/admin/kyc",
        label: "Member KYC",
        icon: FileCheck,
        description: "Review identity documents",
      },
      {
        href: "/admin/verification-logs",
        label: "Verification",
        icon: QrCode,
        description: "Scan and verify history",
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      {
        href: "/admin/staff",
        label: "Staff",
        icon: UserCog,
        description: "Staff accounts, assignments and KYC",
      },
      {
        href: "/admin/escalations",
        label: "Escalations",
        icon: ShieldAlert,
        description: "Chats handed to the admin desk",
      },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      {
        href: "/admin/payments",
        label: "Payments",
        icon: Wallet,
        description: "Invoices and settlement",
      },
      {
        href: "/admin/requests",
        label: "Requests",
        icon: ScrollText,
        description: "Concierge tickets in flight",
      },
      {
        href: "/admin/verification-desk",
        label: "Approvals desk",
        icon: ClipboardCheck,
        description: "Service applications and tier upgrades",
      },
      {
        href: "/admin/chat",
        label: "Chats",
        icon: MessageCircle,
        description: "Live member conversations",
      },
      {
        href: "/admin/services",
        label: "Services",
        icon: Sparkles,
        description: "Catalog and categories",
      },
    ],
  },
  {
    id: "website",
    label: "Website",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings2,
        description: "Branding, media, pages and security",
      },
    ],
  },
];

export type SettingsNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

/** Secondary Settings rail — organised by job */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: "app",
    label: "App",
    items: [
      {
        href: "/admin/settings/branding",
        label: "Branding",
        description: "Website & admin logos",
        icon: ImageIcon,
      },
      {
        href: "/admin/settings/appearance",
        label: "Appearance",
        description: "Site and admin colours",
        icon: Palette,
      },
      {
        href: "/admin/settings/security",
        label: "Security",
        description: "Admin login credentials",
        icon: Shield,
      },
    ],
  },
  {
    id: "media",
    label: "Media",
    items: [
      {
        href: "/admin/settings/homepage",
        label: "Homepage",
        description: "Hero, card and login media",
        icon: Film,
      },
      {
        href: "/admin/settings/applications",
        label: "Applications",
        description: "Travel, access and orchestration",
        icon: PanelsTopLeft,
      },
      {
        href: "/admin/settings/pages-media",
        label: "Membership & Assistance",
        description: "Card showcase and assistance hero",
        icon: ImageIcon,
      },
      {
        href: "/admin/settings/footer",
        label: "Footer",
        description: "Footer video and slideshow",
        icon: Brush,
      },
    ],
  },
  {
    id: "pages",
    label: "Pages",
    items: [
      {
        href: "/admin/settings/what-we-do",
        label: "What we do",
        description: "Pillars and section copy",
        icon: FileText,
      },
      {
        href: "/admin/settings/services-copy",
        label: "Service chapters",
        description: "Service page chapters",
        icon: Sparkles,
      },
      {
        href: "/admin/settings/technology",
        label: "Technology",
        description: "Concierge command block",
        icon: Settings2,
      },
    ],
  },
];

export function adminPageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/settings")) {
    for (const group of SETTINGS_NAV_GROUPS) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          return item.label;
        }
      }
    }
    return "Settings";
  }

  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === "/admin") {
        if (pathname === "/admin") return item.label;
        continue;
      }
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }

  return "Dashboard";
}

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/settings") return pathname.startsWith("/admin/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
