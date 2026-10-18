export const brand = {
  name: "LIMASU",
  product: "REGALIA",
  tagline: "A Higher Standard.",
} as const;

export const hero = {
  headline: ["A HIGHER", "STANDARD."],
  subtext:
    "A private membership ecosystem connecting verified members with curated services, trusted partners and discreet concierge support.",
  primaryCta: "Explore Membership",
  secondaryCta: "See Concierge",
} as const;

export const conciergePromise = {
  eyebrow: "Private concierge",
  headline: "Tell us what you need.",
  headlineAccent: "We handle the rest.",
  intro:
    "One verified team plans, books, confirms and follows through — so you are not chasing vendors, comparing quotes or fixing mistakes at midnight.",
} as const;

export const conciergeSteps = [
  {
    id: "ask",
    step: "01",
    title: "You send one request",
    body: "Travel, access, security, health or life admin — message your concierge with the outcome you want, not the to-do list.",
  },
  {
    id: "orchestrate",
    step: "02",
    title: "We run the operation",
    body: "We source vetted partners, negotiate quietly, align logistics and keep you updated only when a decision is required.",
  },
  {
    id: "confirm",
    step: "03",
    title: "You approve and arrive",
    body: "Confirmations land in one place. Escrow-protected where it matters. If plans change, we absorb the chaos — not you.",
  },
] as const;

export const networkPillars = [
  {
    id: "friction",
    title: "Less on your plate",
    description:
      "Flights, holds, confirmations and last-minute changes — handled before they reach you.",
    relief: "You approve. We execute.",
  },
  {
    id: "time",
    title: "Time returned",
    description:
      "One channel replaces ten threads, voicemails and follow-ups across vendors.",
    relief: "Hours back every week.",
  },
  {
    id: "judgment",
    title: "Clear decisions",
    description:
      "Two or three vetted options with trade-offs explained — plus quiet escalation when a human call is needed.",
    relief: "Clarity without exposure.",
  },
] as const;

export const conciergeReliefs = [
  {
    id: "travel",
    hassle: "You juggle operators, visas and ground transfers.",
    better: "We deliver a single itinerary — verified, discreet, ready.",
  },
  {
    id: "access",
    hassle: "You wait in queues and chase introductions.",
    better: "We secure partner access before you land.",
  },
  {
    id: "life",
    hassle: "Your life admin lives in fifteen apps.",
    better: "We own the request from message to confirmation.",
  },
] as const;

export const networkNodes = [
  { id: "lon", city: "London", lat: 51.5, lon: -0.12 },
  { id: "nyc", city: "New York", lat: 40.7, lon: -74.0 },
  { id: "dxb", city: "Dubai", lat: 25.2, lon: 55.3 },
  { id: "sin", city: "Singapore", lat: 1.35, lon: 103.8 },
  { id: "tyo", city: "Tokyo", lat: 35.7, lon: 139.7 },
  { id: "par", city: "Paris", lat: 48.9, lon: 2.35 },
  { id: "zrh", city: "Zurich", lat: 47.4, lon: 8.54 },
  { id: "hkg", city: "Hong Kong", lat: 22.3, lon: 114.2 },
] as const;

export const whatWeDoSection = {
  eyebrow: "What Regalia does",
  headline: "We take custody of complexity.",
  subline:
    "You describe the outcome. We own the planning, partners, logistics, follow-up and confirmation — quietly, end to end.",
} as const;

export const whatWeDoPillars = [
  {
    id: "custody",
    title: "Full request custody",
    body: "One concierge team holds the thread from first message to final confirmation — nothing handed off to a call centre.",
    image:
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "vetted",
    title: "Vetted partners only",
    body: "Operators, venues and vendors are contracted, reviewed and held to Regalia standards before they ever reach you.",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "discreet",
    title: "Discreet by default",
    body: "Itineraries, reservations and access arranged without public visibility or unnecessary exposure.",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "protected",
    title: "Protected when it matters",
    body: "Escrow-backed engagements with verified vendors where financial clarity and trust are non-negotiable.",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=2400&q=85",
  },
] as const;

export const memberJourneySection = {
  eyebrow: "How it works",
  headline: "From message to done.",
  subline: "A predictable path — designed so you never manage the middle.",
} as const;

export const memberJourneySteps = [
  {
    id: "message",
    label: "You message concierge",
    detail: "Outcome stated in plain language — not a task list.",
  },
  {
    id: "plan",
    label: "We build the plan",
    detail: "Options, trade-offs and pricing cleared before you decide.",
  },
  {
    id: "book",
    label: "We book & confirm",
    detail: "Partners coordinated, manifests aligned, holds secured.",
  },
  {
    id: "travel",
    label: "You experience",
    detail: "Arrive, attend, enjoy — we monitor and adapt in the background.",
  },
  {
    id: "close",
    label: "We close the loop",
    detail: "Receipts, escrow release and notes filed in your channel.",
  },
] as const;

/** Sticky scroll video chapters — Applications-style (AP / Rolex pattern). */
export const videoApplicationsSection = {
  eyebrow: "Concierge in motion",
  headline: "Wherever life moves, we already hold the thread.",
  subline:
    "Scroll through the environments where membership becomes real — air, city, ground and residence, owned end to end.",
} as const;

export const videoApplications = [
  {
    id: "air",
    label: "Private air",
    title: "Wheels up, already handled.",
    body: "Charter, commercial and ground converge into one timeline — you board, we own the contingency.",
    poster:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=2400&q=80",
    video: "/videos/air.mp4",
  },
  {
    id: "city",
    label: "City access",
    title: "Tables and doors, held.",
    body: "Reservations, arrivals and private rooms arranged before you land — no lists, no spectacle.",
    poster:
      "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=2400&q=80",
    video: "/videos/city.mp4",
  },
  {
    id: "road",
    label: "Ground move",
    title: "Movement without friction.",
    body: "Chauffeur, routing and timing synced to your itinerary — changes absorbed in the background.",
    poster:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2400&q=80",
    video: "/videos/road.mp4",
  },
  {
    id: "suite",
    label: "Residence",
    title: "The room is already yours.",
    body: "Stays, amenities and quiet logistics confirmed — so arrival feels like continuation, not check-in.",
    poster:
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=2400&q=80",
    video: "/videos/suite.mp4",
  },
] as const;

export const experienceStories = [
  {
    id: "weekend",
    tag: "Lifestyle",
    title: "A weekend in three cities",
    member: "Prestige member",
    story:
      "Dinner in London, board meeting in Geneva, family time in Milan — one itinerary, four vendors, zero missed connections.",
    image:
      "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "medical",
    tag: "Healthcare",
    title: "Priority care abroad",
    member: "Sovereign member",
    story:
      "Specialist introduction, private facility access and confidential transport arranged within hours of the first call.",
    image:
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "launch",
    tag: "Business",
    title: "Launch night, handled",
    member: "Signature member",
    story:
      "Venue, security sweep, guest list and after-hours logistics — presented as two options, executed as one seamless evening.",
    image:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=2400&q=85",
  },
] as const;

export const partnerReachSection = {
  eyebrow: "Global desk",
  headline: "Wherever you are, we are already there.",
  subline:
    "Local partners, central concierge — same standard in every time zone.",
  statLabel: "Cities with active partner desks",
} as const;

export const servicesSection = {
  eyebrow: "Concierge capabilities",
  headline: "What we do for you.",
  subline:
    "Scroll each domain — every chapter is a promise of custody, not a catalogue link.",
} as const;

export const services = [
  {
    id: "travel",
    title: "Private Travel",
    subtitle: "We coordinate · You arrive",
    description:
      "Routing, manifests, ground sync and contingency plans — without you chasing suppliers.",
    outcome: "You land on time, on script, without managing operators.",
    deliverables: [
      "Charter, commercial and ground in one timeline",
      "Visa and manifest coordination",
      "Contingency routing when schedules shift",
      "Discreet arrivals and private terminals",
    ],
    image:
      "https://images.unsplash.com/photo-1474302776647-1d9434538a99?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "lifestyle",
    title: "Luxury Lifestyle",
    subtitle: "We reserve · You enjoy",
    description:
      "Stays, tables and experiences secured quietly — no public lists, no wasted evenings.",
    outcome: "You show up; the evening is already yours.",
    deliverables: [
      "Private residences and suite holds",
      "Restaurant and club access",
      "Cultural and sporting experiences",
      "Last-minute changes absorbed quietly",
    ],
    image:
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "security",
    title: "Security",
    subtitle: "We plan · You move safely",
    description:
      "Advance work, vetted teams and logistics so sensitive travel never feels improvised.",
    outcome: "Movement feels calm because the work happened in advance.",
    deliverables: [
      "Advance routing and risk review",
      "Vetted protection teams",
      "Secure ground and venue coordination",
      "Family and principal logistics aligned",
    ],
    image:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "healthcare",
    title: "Healthcare",
    subtitle: "We navigate · You heal",
    description:
      "Priority pathways and confidential coordination when health cannot wait on hold music.",
    outcome: "You focus on recovery; we navigate the system.",
    deliverables: [
      "Specialist and facility introductions",
      "Priority scheduling pathways",
      "Confidential transport and stays",
      "Family coordination when needed",
    ],
    image:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "business",
    title: "Business",
    subtitle: "We prepare · You lead",
    description:
      "Introductions, venues and operational detail handled before you walk into the room.",
    outcome: "You walk in prepared; the room is already set.",
    deliverables: [
      "Introductions and partner access",
      "Boardroom and event logistics",
      "Travel aligned to meetings",
      "Operational support for private offices",
    ],
    image:
      "https://images.unsplash.com/photo-1497366811353-4563c8a2f0bd?auto=format&fit=crop&w=2400&q=85",
  },
  {
    id: "concierge",
    title: "Personal Concierge",
    subtitle: "One message · Full custody",
    description:
      "The core of Regalia — a human team that owns the request until it is done, not delegated away.",
    outcome: "Life admin, gifts, family logistics — one channel, closed loops.",
    deliverables: [
      "Dedicated concierge channel",
      "Life admin and household coordination",
      "Gift, event and family logistics",
      "Escalation to senior desk when required",
    ],
    image:
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=2400&q=85",
  },
] as const;

export const tiersSection = {
  eyebrow: "Membership tiers",
  headline: "Ascend through four metals.",
  subline:
    "Each tier unlocks deeper concierge custody, partner access and priority across the Regalia network.",
} as const;

export const membershipTiers = [
  {
    id: "bronze",
    name: "Bronze",
    metal: "Bronze",
    accent: "#c4a07a",
    metalFrom: "#8C593B",
    metalTo: "#4A2E19",
    summary: "Foundational access where the Regalia journey begins.",
    taglineLeft: "ACCESS BEGINS HERE",
    taglineRight: "JOURNEYS CREATE OPPORTUNITIES",
    privileges: [
      "Member verification",
      "Core partner network",
      "Standard concierge hours",
    ],
    image:
      "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "silver",
    name: "Silver",
    metal: "Silver",
    accent: "#c8ccd2",
    metalFrom: "#9aa0a8",
    metalTo: "#4a5058",
    summary: "Greater privileges across verified partners and destinations.",
    taglineLeft: "GREATER PRIVILEGES AHEAD",
    taglineRight: "DISTINCTIONS TAKE YOU FURTHER",
    privileges: [
      "Priority review lanes",
      "Extended partner access",
      "Dedicated request desk",
    ],
    image:
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "gold",
    name: "Gold",
    metal: "Gold",
    accent: "#d4af7a",
    metalFrom: "#D4AF37",
    metalTo: "#996515",
    summary: "Elevated experiences orchestrated to Regalia standard.",
    taglineLeft: "ELEVATED EXPERIENCES AWAIT",
    taglineRight: "EXTRAORDINARY IS A STANDARD",
    privileges: [
      "Senior concierge assignment",
      "Escrow-preferred vendors",
      "Travel command support",
    ],
    image:
      "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "victorious",
    name: "Victorious",
    metal: "Victorious",
    accent: "#d4af7a",
    metalFrom: "#1a1a1a",
    metalTo: "#0a0a0a",
    summary: "The ultimate tier — access beyond ordinary boundaries.",
    taglineLeft: "THE ULTIMATE ACCESS",
    taglineRight: "BEYOND BOUNDARIES",
    privileges: [
      "White-glove custody",
      "Immediate escalation path",
      "Invitation-led privileges",
    ],
    image:
      "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=1600&q=80",
  },
] as const;

export const controlledAccess = {
  service: "SENIOR CONCIERGE DESK",
  status: "ALLOCATION CONTROLLED",
  message:
    "High-demand desks operate under capacity control. Requests enter review; priority is granted with discretion — never by queue alone.",
  primaryCta: "Request Priority Review",
  secondaryCta: "Join Private Waitlist",
  stages: ["Request", "Desk Review", "Priority Allocation"] as const,
} as const;

export const escrowFlow = [
  {
    id: "client",
    label: "CLIENT",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "escrow",
    label: "ESCROW",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "vendor",
    label: "VERIFIED VENDOR",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "service",
    label: "SERVICE",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "confirm",
    label: "CONFIRMATION",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "release",
    label: "FUNDS RELEASE",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=80",
  },
] as const;

export const concierge = {
  greeting: "Good evening.",
  prompt: "How may we assist?",
  options: [
    { id: "travel", label: "Arrange Travel" },
    { id: "service", label: "Request Service" },
    { id: "contact", label: "Contact Concierge" },
  ],
} as const;

export const finale = {
  headline: ["WELCOME TO", "REGALIA."],
  subtext: "Access is curated.",
  cta: "Apply for Membership",
} as const;

export const heroImagery = {
  jet: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=2400&q=80",
  vehicle:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2400&q=80",
  suite:
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=2400&q=80",
} as const;
