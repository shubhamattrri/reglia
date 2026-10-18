export type PublicTier = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  summary: string;
  accent: string;
  metalFrom: string;
  metalTo: string;
  frontImage?: string | null;
  backImage?: string | null;
  tagline?: string | null;
  motto?: string | null;
  price?: number;
  currency?: string;
  code?: string | null;
  /** Stored card-back panel positions; read with `readCardLayout`. */
  cardLayout?: unknown;
  cardPanelStyle?: "GLASS" | "TRANSPARENT" | null;
  cardFrontLayout?: unknown;
  sortOrder: number;
  features: { id: string; label: string; icon: string; sortOrder: number }[];
};

export type PublicCardFace = {
  holderName: string;
  regaliaId: string;
  membershipNo: string;
  membershipCode: string;
  tierName: string;
  tierSubtitle: string;
  accent: string;
  metalFrom: string;
  metalTo: string;
  status: string;
  issuedAt: string;
  validThru: string;
  accessLevel: string;
  serialNumber: string;
  conciergeLine: string;
  verifyUrl: string;
  features: { label: string; icon: string }[];
};
