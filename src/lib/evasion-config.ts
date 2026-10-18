const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const evasionNav = [
  { href: "#evasion-products", label: "Domains" },
  { href: "#evasion-technology", label: "Orchestration" },
  { href: "#evasion-gallery", label: "Gallery" },
] as const;

export const evasionHero = {
  word: "REGALIA",
  tagline: ["Discreet custody.", "Verified partners. Closed loops."],
  cta: "Explore membership",
  image: {
    src: u("photo-1436491865332-7a61a109cc05", 2400),
    alt: "Private aviation on the tarmac at dusk",
  },
  sides: [
    {
      src: u("photo-1540962351504-03099e0a754b"),
      alt: "Private jet cabin prepared for departure",
    },
    {
      src: u("photo-1513635269975-59663e0ac1ad"),
      alt: "City skyline where access is held quietly",
    },
    {
      src: u("photo-1503376780353-7e6692767b70"),
      alt: "Ground transfer waiting on schedule",
    },
    {
      src: u("photo-1631049307264-da0ec9d70304"),
      alt: "Private residence suite ready on arrival",
    },
  ],
} as const;

export const evasionAlpine = {
  name: "Travel",
  price: "",
  label: "Private Travel",
  alt: "Private travel custody across air and ground",
  images: [
    u("photo-1436491865332-7a61a109cc05", 1800),
    u("photo-1540962351504-03099e0a754b", 1800),
    u("photo-1474302776647-1d9434538a99", 1800),
    u("photo-1503376780353-7e6692767b70", 1800),
  ],
} as const;

export const evasionForest = {
  name: "Access",
  price: "",
  label: "City & Lifestyle",
  alt: "Tables, residences and evenings held in advance",
  images: [
    u("photo-1513635269975-59663e0ac1ad", 1800),
    u("photo-1631049307264-da0ec9d70304", 1800),
    u("photo-1414235077428-338989a2e8c0", 1800),
    u("photo-1566073771259-6a8506099945", 1800),
  ],
} as const;

export const evasionPhilosophy = {
  eyebrow: "Concierge custody",
  body: "You describe the outcome. Regalia owns the planning, partners, logistics and confirmation — so complexity never reaches your desk.",
} as const;

export const evasionExcellence = {
  id: "evasion-excellence",
  eyebrow: "Orchestration",
  title: "Engineered for discretion.",
  left: {
    src: u("photo-1521737604893-d14cc237f11d", 2000),
    alt: "Concierge desk coordinating vetted partners",
  },
  right: {
    src: u("photo-1551882547-ff40c63fe5fa", 2000),
    alt: "Quiet luxury arrival without spectacle",
  },
} as const;

export const evasionAdventure = {
  id: "evasion-adventure",
  eyebrow: "Field",
  title: "Designed for movement.",
  left: {
    src: u("photo-1507679799987-c73779587ccf", 2000),
    alt: "Advance security planning for sensitive travel",
  },
  right: {
    src: u("photo-1497366811353-4563c8a2f0bd", 2000),
    alt: "Business venues prepared before you arrive",
  },
} as const;

export const evasionFeatures = [
  {
    title: "One request channel",
    description: "Custody",
    image: u("photo-1564501049412-61c2a3083791"),
    alt: "Dedicated concierge holding the full thread",
  },
  {
    title: "Vetted partners only",
    description: "Network",
    image: u("photo-1521737604893-d14cc237f11d"),
    alt: "Partner review before introductions",
  },
  {
    title: "Escrow-protected work",
    description: "Trust",
    image: u("photo-1554224155-6726b3ff858f"),
    alt: "Protected settlement between member and vendor",
  },
  {
    title: "Priority desk lanes",
    description: "Speed",
    image: u("photo-1470229722913-7c0e2dbbafd3"),
    alt: "Senior escalation when timing matters",
  },
  {
    title: "Discreet by default",
    description: "Privacy",
    image: u("photo-1414235077428-338989a2e8c0"),
    alt: "Reservations arranged without public visibility",
  },
  {
    title: "Closed-loop confirmations",
    description: "Clarity",
    image: u("photo-1576091160550-2173dba999ef"),
    alt: "Confirmations filed in one member channel",
  },
] as const;

export const evasionTechnology = {
  title: ["Concierge", "Meets", "Command."],
  body: "Regalia turns complex requests into closed loops — vetted partners, escrow-backed engagements and a human desk that owns every thread until confirmation.",
  hero: {
    src: u("photo-1436491865332-7a61a109cc05", 2000),
    alt: "Private aviation prepared under Regalia custody",
  },
  products: [
    {
      src: u("photo-1436491865332-7a61a109cc05"),
      label: "Private air",
      detail: "Charter and ground, one timeline",
      alt: "Private jet on tarmac",
    },
    {
      src: u("photo-1513635269975-59663e0ac1ad"),
      label: "City access",
      detail: "Tables and doors, held quietly",
      alt: "City skyline at dusk",
    },
    {
      src: u("photo-1503376780353-7e6692767b70"),
      label: "Ground move",
      detail: "Routing synced to your itinerary",
      alt: "Luxury vehicle on open road",
    },
    {
      src: u("photo-1631049307264-da0ec9d70304"),
      label: "Residence",
      detail: "Arrival feels like continuation",
      alt: "Private suite interior",
    },
  ],
  features: [
    { k: "01", label: "Single concierge channel" },
    { k: "02", label: "Vetted partner network" },
    { k: "03", label: "Escrow-protected settlement" },
    { k: "04", label: "Priority desk escalation" },
  ],
} as const;

export const evasionGallery = [
  { src: u("photo-1540962351504-03099e0a754b", 1400), alt: "Cabin ready before wheels up" },
  { src: u("photo-1513635269975-59663e0ac1ad", 1400), alt: "City evening held for a member" },
  { src: u("photo-1566073771259-6a8506099945", 1400), alt: "Residence logistics already confirmed" },
  { src: u("photo-1414235077428-338989a2e8c0", 1400), alt: "Private dining without spectacle" },
  { src: u("photo-1507679799987-c73779587ccf", 1400), alt: "Advance planning for sensitive movement" },
  { src: u("photo-1497366811353-4563c8a2f0bd", 1400), alt: "Boardroom set before the meeting" },
  { src: u("photo-1470229722913-7c0e2dbbafd3", 1400), alt: "Launch night handled end to end" },
  { src: u("photo-1576091160399-112ba8d25d1f", 1400), alt: "Priority care pathways arranged quietly" },
] as const;

export const evasionAccessories = [
  {
    name: "Travel custody",
    description: "Air, ground and manifests in one timeline",
    price: "",
    image: u("photo-1436491865332-7a61a109cc05"),
    alt: "Private jet ready for departure",
  },
  {
    name: "Lifestyle holds",
    description: "Tables, suites and evenings secured quietly",
    price: "",
    image: u("photo-1631049307264-da0ec9d70304"),
    alt: "Suite prepared for arrival",
  },
  {
    name: "Security planning",
    description: "Advance work so movement never feels improvised",
    price: "",
    image: u("photo-1507679799987-c73779587ccf"),
    alt: "Discreet security coordination",
  },
  {
    name: "Healthcare lanes",
    description: "Priority pathways when timing cannot wait",
    price: "",
    image: u("photo-1576091160550-2173dba999ef"),
    alt: "Confidential healthcare coordination",
  },
  {
    name: "Business support",
    description: "Venues and introductions before you walk in",
    price: "",
    image: u("photo-1497366811353-4563c8a2f0bd"),
    alt: "Prepared private office environment",
  },
  {
    name: "Personal desk",
    description: "Life admin owned until confirmation",
    price: "",
    image: u("photo-1564501049412-61c2a3083791"),
    alt: "Concierge desk in session",
  },
] as const;

export const evasionSpecs = [
  { label: "Partner desks", value: "8+" },
  { label: "Request custody", value: "100%" },
  { label: "Desk response", value: "<1h" },
  { label: "Escrow option", value: "Yes" },
] as const;

export const evasionEditorial = {
  quote:
    "Regalia is not a catalogue — it is a verified desk that takes custody of complexity until the outcome is confirmed, quietly and end to end.",
  image: {
    src: u("photo-1540962351504-03099e0a754b", 2400),
    alt: "Private aviation under Regalia custody",
  },
} as const;

export const evasionFooter = {
  blurb:
    "Private membership. Curated access. One desk that owns the request until it is done.",
  explore: evasionNav,
  about: ["Our Story", "Team", "Careers", "Contact"],
  service: ["FAQ", "Membership", "Assistance", "Verify"],
} as const;
