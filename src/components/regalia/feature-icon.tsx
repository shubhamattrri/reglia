import {
  Anchor,
  BadgeCheck,
  Briefcase,
  Building2,
  Crown,
  Gem,
  Gift,
  Globe,
  Headset,
  Hotel,
  House,
  KeyRound,
  PartyPopper,
  Plane,
  Shield,
  Ship,
  Siren,
  Sparkles,
  Ticket,
  Timer,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Anchor,
  BadgeCheck,
  Briefcase,
  Building2,
  Crown,
  Gem,
  Gift,
  Globe,
  Headset,
  Hotel,
  House,
  KeyRound,
  PartyPopper,
  Plane,
  Shield,
  Ship,
  Siren,
  Sparkles,
  Ticket,
  Timer,
  UtensilsCrossed,
  Zap,
};

export const FEATURE_ICON_NAMES = Object.keys(ICONS);

export function FeatureIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} />;
}
