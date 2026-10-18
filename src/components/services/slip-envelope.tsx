"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  Crown,
  DoorClosed,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import type { FulfillmentSlip } from "@/lib/tier-access/rules";

export type SlipView = {
  requestId: number;
  service: string;
  guest?: string;
  status: string;
  slip: FulfillmentSlip;
  issuedAt: string | null;
  completedAt?: string | null;
};

const GOLD = "#c9a45c";
const PAPER_SHADOW_REST = "0 2px 6px -2px rgba(0,0,0,0.35)";
const PAPER_SHADOW_LIFT = "0 28px 50px -18px rgba(0,0,0,0.65)";

type Phase = "sealed" | "opening" | "sliding" | "revealed";

function slipNumber(id: number) {
  return `Nº ${String(id).padStart(6, "0")}`;
}

function day(value: string | null) {
  if (!value) return "—";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const miniFlap: Variants = { rest: { rotateX: 0 }, hover: { rotateX: 165 } };
const miniPaper: Variants = { rest: { y: 0 }, hover: { y: -7 } };

/** Small envelope used in request lists; the flap lifts on hover and the full reveal opens on click. */
export function SlipEnvelopeButton({ view, label = "View slip" }: { view: SlipView; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.button
        type="button"
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileFocus="hover"
        onClick={() => setOpen(true)}
        aria-label={`${label} for ${view.service}`}
        className="inline-flex items-center gap-3 rounded-full border border-[#c9a45c]/60 bg-[#1d140d] py-1.5 pl-2 pr-4 text-[11px] uppercase tracking-[0.18em] text-[#ecd9ae] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.7)] transition-colors hover:border-[#e2c27f]"
      >
        <span className="relative block h-[26px] w-[38px]" style={{ perspective: 300 }} aria-hidden>
          <span className="absolute inset-0 rounded-[3px] border border-[#c9a45c]/70 bg-gradient-to-b from-[#3a2716] to-[#24170d]" />
          <motion.span
            variants={miniPaper}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="absolute inset-x-[5px] top-[3px] h-[18px] rounded-[2px] bg-[#f8f1e3]"
          />
          <span
            className="absolute inset-0 rounded-[3px] bg-gradient-to-b from-[#3f2a18] to-[#2a1b0f]"
            style={{ clipPath: "polygon(0 0, 50% 55%, 100% 0, 100% 100%, 0 100%)" }}
          />
          <motion.span
            variants={miniFlap}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="absolute inset-x-0 top-0 h-[15px] origin-top bg-gradient-to-b from-[#4a321d] to-[#33220f]"
            style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", backfaceVisibility: "visible" }}
          />
          <span className="absolute left-1/2 top-[11px] h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-[#b23a2e] ring-1 ring-[#e2c27f]/60" />
        </span>
        {label}
      </motion.button>
      <AnimatePresence>{open ? <SlipReveal view={view} onClose={() => setOpen(false)} /> : null}</AnimatePresence>
    </>
  );
}

/** Full-screen sequence: seal breaks, flap rotates open, the slip slides out, then the voucher comes forward. */
export function SlipReveal({ view, onClose }: { view: SlipView; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? "revealed" : "sealed");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (phase !== "sealed") return;
    const t = window.setTimeout(() => setPhase("opening"), 450);
    return () => window.clearTimeout(t);
  }, [phase]);

  const flapOpen = phase !== "sealed";
  const sliding = phase === "sliding";

  return (
    <motion.div
      className="fixed inset-0 z-[230] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Booking slip for ${view.service}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(45,30,18,0.82),rgba(10,7,4,0.94))] backdrop-blur-[3px]"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/30 p-2 text-white/80 transition hover:text-white"
        aria-label="Close slip"
      >
        <X className="h-4 w-4" />
      </button>

      <AnimatePresence mode="wait">
        {phase !== "revealed" ? (
          <motion.div
            key="envelope"
            className="relative h-[230px] w-[min(86vw,360px)] cursor-pointer"
            style={{ perspective: 1100 }}
            initial={{ y: 40, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 120, opacity: 0, transition: { duration: 0.4, ease: "easeIn" } }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            onClick={() => setPhase((p) => (p === "sealed" ? "opening" : p))}
          >
            {/* back of the envelope */}
            <div
              className="absolute inset-0 rounded-[10px] bg-gradient-to-b from-[#2c1d10] to-[#1a1009]"
              style={{ boxShadow: `inset 0 0 0 1px ${GOLD}66, 0 40px 80px -30px rgba(0,0,0,0.9)` }}
            />

            {/* flap: in front while closed, drops behind the slip once fully open */}
            <motion.div
              className="absolute inset-x-0 top-0 h-[58%] origin-top"
              style={{ zIndex: phase === "sealed" || phase === "opening" ? 30 : 1, transformStyle: "preserve-3d" }}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: flapOpen ? 180 : 0 }}
              transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
              onAnimationComplete={() => setPhase((p) => (p === "opening" ? "sliding" : p))}
            >
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#4b321c] to-[#2f1f10]"
                style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
              />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                <path d="M0 0 L50 100 L100 0" fill="none" stroke={GOLD} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
            </motion.div>

            {/* wax seal breaks as the flap lifts */}
            <motion.div
              className="absolute left-1/2 top-[52%] z-[35] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d0574a,#8e2219)] font-display text-sm tracking-[0.12em] text-[#f3d9a4] shadow-[0_6px_14px_rgba(0,0,0,0.5)] ring-2 ring-[#e2c27f]/50"
              animate={flapOpen ? { scale: 1.25, opacity: 0, rotate: 18 } : { scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.35 }}
            >
              LR
            </motion.div>

            {/* the slip, tucked inside until it slides up */}
            <motion.div
              className="absolute inset-x-[7%] top-[8%] z-10 h-[84%] overflow-hidden rounded-md bg-[#f8f1e3] px-4 py-3 text-[#2b1d13]"
              initial={{ y: 0, scale: 1, boxShadow: PAPER_SHADOW_REST }}
              animate={sliding ? { y: -150, scale: 1.04, boxShadow: PAPER_SHADOW_LIFT } : { y: 0, scale: 1, boxShadow: PAPER_SHADOW_REST }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => {
                if (sliding) window.setTimeout(() => setPhase("revealed"), 220);
              }}
            >
              <div className="pointer-events-none absolute inset-1.5 rounded border border-[#b88a44]/60" />
              <p className="text-center text-[8px] uppercase tracking-[0.42em] text-[#8a5a2e]">Limasu Regalia</p>
              <p className="mt-1 text-center font-display text-lg leading-tight">{view.slip.hotelName}</p>
              <p className="mt-0.5 text-center text-[9px] uppercase tracking-[0.24em] text-[#2b1d13]/60">Booking slip · {slipNumber(view.requestId)}</p>
            </motion.div>

            {/* front pocket keeps the lower part of the slip hidden */}
            <div
              className="absolute inset-0 z-20 rounded-[10px] bg-gradient-to-b from-[#3a2716] to-[#22160c]"
              style={{ clipPath: "polygon(0 0, 50% 56%, 100% 0, 100% 100%, 0 100%)" }}
            />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden>
              <path d="M0 0 L50 56 L100 0" fill="none" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path d="M0 100 L42 52 M100 100 L58 52" fill="none" stroke={GOLD} strokeOpacity="0.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="absolute inset-x-0 bottom-4 z-20 text-center text-[9px] uppercase tracking-[0.4em] text-[#c9a45c]/80">
              {phase === "sealed" ? "Tap to open" : "Private & confidential"}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="slip"
            className="relative z-10 grid justify-items-center gap-4"
            initial={reduce ? { opacity: 0 } : { y: 90, scale: 0.72, rotateX: 18, opacity: 0 }}
            animate={{ y: 0, scale: 1, rotateX: 0, opacity: 1 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 120, damping: 16 }}
            style={{ perspective: 1200 }}
          >
            <BookingSlipCard view={view} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#c9a45c]/60 px-6 py-2 text-[11px] uppercase tracking-[0.24em] text-[#ecd9ae] transition hover:bg-[#c9a45c] hover:text-[#1d140d]"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const GOLD_TEXT =
  "bg-gradient-to-b from-[#d9b36a] via-[#b0843c] to-[#8a6128] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]";
const SILVER_TEXT =
  "bg-gradient-to-b from-[#f2efea] via-[#b9b3ab] to-[#8c857c] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]";

function barcodeBars(seed: string) {
  let h = 2166136261;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < 44; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i % seed.length) ^ i, 16777619);
    const w = 1 + (Math.abs(h) % 3);
    bars.push({ x, w });
    x += w + 1 + (Math.abs(h >> 4) % 2);
  }
  return { bars, width: x };
}

function Barcode({ code }: { code: string }) {
  const { bars, width } = barcodeBars(code);
  return (
    <div className="text-center">
      <svg viewBox={`0 0 ${width} 30`} preserveAspectRatio="none" className="h-9 w-36 sm:w-40" aria-hidden>
        {bars.map((b) => (
          <rect key={b.x} x={b.x} y={0} width={b.w} height={30} fill="#1d140d" />
        ))}
      </svg>
      <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-[#2b1d13]">{code}</p>
    </div>
  );
}

/** Fine gold sweep lines tucked into a corner; rotate to reuse at each corner. */
function CornerFlourish({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 80 80" className={`pointer-events-none absolute h-16 w-16 sm:h-20 sm:w-20 ${className}`} aria-hidden>
      {[0, 5, 10, 15].map((o) => (
        <path key={o} d={`M${4 + o} 80 C ${8 + o} ${46 - o}, ${34 - o} ${8 + o}, 80 ${4 + o}`} fill="none" stroke="#c49a52" strokeOpacity={0.75 - o / 30} strokeWidth="0.9" />
      ))}
    </svg>
  );
}

function WaxSeal() {
  return (
    <div
      className="absolute -top-7 left-[52%] z-10 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full shadow-[0_8px_16px_-6px_rgba(60,40,10,0.55)] sm:-top-8 sm:h-16 sm:w-16"
      style={{
        background: "radial-gradient(circle at 35% 30%, #f3d891 0%, #c99a45 45%, #8f6424 100%)",
        borderRadius: "48% 52% 50% 50% / 52% 48% 52% 48%",
      }}
      aria-hidden
    >
      <div className="grid h-[72%] w-[72%] place-items-center rounded-full border border-[#7a5320]/40 shadow-[inset_0_2px_4px_rgba(90,60,20,0.45)]">
        <span className="font-display text-xl text-[#7a5320]/80 sm:text-2xl">R</span>
      </div>
    </div>
  );
}

/** The voucher: cream ticket with gold flourishes, wax seal, notched perforation and a silver-crest stub. */
export function BookingSlipCard({ view }: { view: SlipView }) {
  const { slip } = view;
  const completed = view.status === "COMPLETED";
  const code = `RG-${String(view.requestId).padStart(6, "0")}`;
  return (
    <div className="relative w-[min(94vw,820px)] pt-8 drop-shadow-[0_30px_50px_rgba(0,0,0,0.55)]">
      <WaxSeal />
      <article className="regalia-ticket relative grid overflow-hidden rounded-[14px] bg-[linear-gradient(135deg,#fbf7f0_0%,#f3ecdf_55%,#efe6d6_100%)] text-[#2b1d13] sm:grid-cols-[minmax(0,1fr)_var(--stub)]">
        <div className="pointer-events-none absolute inset-[9px] rounded-[9px] border border-[#c49a52]/45" aria-hidden />
        <CornerFlourish className="left-0 top-0 rotate-180" />
        <CornerFlourish className="bottom-0 left-0 rotate-90" />
        <CornerFlourish className="right-0 top-0 -rotate-90 sm:hidden" />
        <CornerFlourish className="bottom-0 right-0 sm:hidden" />

        <div className="relative px-7 pb-7 pt-7 sm:px-10 sm:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="text-center">
              <Crown className="mx-auto h-4 w-4 text-[#b0843c]" strokeWidth={1.5} aria-hidden />
              <p className={`font-display text-[30px] leading-none tracking-[0.18em] sm:text-[34px] ${GOLD_TEXT}`}>REGALIA</p>
              <p className="mt-1.5 flex items-center justify-center gap-2 text-[8px] uppercase tracking-[0.34em] text-[#5c4330]">
                <span className="h-px w-5 bg-[#b0843c]/70" />
                The way of life
                <span className="h-px w-5 bg-[#b0843c]/70" />
              </p>
            </div>
            <p className="text-right text-[8px] uppercase leading-relaxed tracking-[0.32em] text-[#5c4330]">
              Exclusive access
              <br />
              Premium experience
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1.1fr)_1px_minmax(0,1fr)] sm:gap-7">
            <div className="grid gap-3.5">
              <IconField icon={Building2} label={view.service.toLowerCase().includes("hotel") ? "Hotel" : view.service} value={slip.hotelName} />
              {slip.roomNumber ? <IconField icon={DoorClosed} label="Room" value={slip.roomNumber} /> : null}
              <IconField icon={CalendarDays} label="Check-in" value={slip.checkIn ? day(slip.checkIn) : null} />
            </div>
            <span className="hidden bg-[#c49a52]/40 sm:block" aria-hidden />
            <div className="grid content-start gap-3.5">
              <IconField icon={UserRound} label="Guest" value={view.guest || null} />
              <IconField icon={CalendarCheck} label="Check-out" value={slip.checkOut ? day(slip.checkOut) : null} />
              {slip.confirmationCode ? <IconField icon={Ticket} label="Confirmation" value={slip.confirmationCode} mono /> : null}
            </div>
          </div>

          {slip.notes ? (
            <p className="mt-4 border-t border-[#c49a52]/30 pt-3 text-[12px] italic leading-relaxed text-[#2b1d13]/70">{slip.notes}</p>
          ) : null}

          <div className="mt-5 grid items-end gap-4 sm:grid-cols-3">
            <p className="-rotate-[8deg] font-display text-lg italic leading-tight text-[#b0843c] [-webkit-text-fill-color:#b0843c]">
              Your Journey
              <br />
              <span className="pl-5">Begins Here</span>
            </p>
            <div className="text-center">
              <Crown className="mx-auto h-5 w-5 text-[#b0843c]" strokeWidth={1.4} aria-hidden />
              <p className="mt-0.5 font-display text-[13px] tracking-[0.3em] text-[#5c4330]">REGALIA</p>
              <p className="text-[7px] uppercase tracking-[0.3em] text-[#5c4330]/80">Luxury stays</p>
            </div>
            <div className="justify-self-center sm:justify-self-end">
              <Barcode code={code} />
            </div>
          </div>

          <p className="mt-3 text-[9px] text-[#2b1d13]/45">
            Issued {day(view.issuedAt)}
            {completed && view.completedAt ? ` · completed ${day(view.completedAt)}` : ""}
          </p>

          <motion.div
            className={`absolute left-[42%] top-9 rotate-[-12deg] rounded-md border-[3px] border-double px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] max-sm:hidden ${
              completed ? "border-[#8a5a2e] text-[#8a5a2e]" : "border-[#9b2d22] text-[#9b2d22]"
            }`}
            initial={{ scale: 2.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            transition={{ delay: 0.55, type: "spring", stiffness: 420, damping: 18 }}
          >
            {completed ? "Completed" : "Confirmed"}
          </motion.div>
        </div>

        <div className="relative flex flex-col items-center justify-center border-t border-dashed border-[#b0843c]/60 px-5 py-8 text-center sm:border-l sm:border-t-0">
          <CornerFlourish className="right-0 top-0 -rotate-90 max-sm:hidden" />
          <CornerFlourish className="bottom-0 right-0 max-sm:hidden" />
          <Crown className="h-5 w-5 text-[#a59f97]" strokeWidth={1.4} aria-hidden />
          <p className={`font-display text-6xl leading-none ${SILVER_TEXT}`} style={{ filter: "drop-shadow(0 1px 0 rgba(90,80,70,0.35))" }}>
            R
          </p>
          <p className={`mt-3 font-display text-[15px] tracking-[0.32em] ${GOLD_TEXT}`}>REGALIA</p>
          <p className="mt-1 text-[7px] uppercase tracking-[0.3em] text-[#5c4330]/80">The way of life</p>
          <p className="mt-6 text-[9px] uppercase leading-relaxed tracking-[0.3em] text-[#b0843c]">
            Premium
            <br />
            stay pass
          </p>
          {slip.roomNumber ? <p className="mt-3 font-mono text-[10px] text-[#8a6128]">Room {slip.roomNumber}</p> : null}
        </div>
      </article>
    </div>
  );
}

function IconField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Building2;
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-1 h-[18px] w-[18px] shrink-0 text-[#b0843c]" strokeWidth={1.4} aria-hidden />
      <div className="min-w-0">
        <p className="text-[8px] uppercase tracking-[0.3em] text-[#6b5240]">{label}</p>
        <p className={`mt-0.5 break-words leading-tight text-[#1d140d] ${mono ? "font-mono text-sm tracking-wider" : "font-display text-lg"}`}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

