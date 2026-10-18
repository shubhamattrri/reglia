"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Eye, EyeOff, Lock, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { isUsableImageSrc } from "@/lib/image-src";
import { PROFILE_LIMITS, isoDate, parseMemberProfile } from "@/lib/member-profile";
import { cn } from "@/lib/utils";

export type SignUpProfile = {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  address: string;
};

const EMPTY_PROFILE: SignUpProfile = { fullName: "", phone: "", dateOfBirth: "", address: "" };

const FIELD =
  "h-[50px] w-full rounded-[12px] border border-[#8a5a2e]/20 bg-white/70 pr-4 pl-11 text-[14px] text-[#3b2819] outline-none transition duration-200 placeholder:text-[#9a8570] focus:border-[#8a5a2e]/60";
const FIELD_ICON = "pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#8a5a2e]/60";

export type SignIn1Props = {
  brandName?: string;
  logoSrc?: string;
  videoSrc?: string;
  title?: string;
  submitLabel?: string;
  switchHref?: string;
  switchPrefix?: string;
  switchLabel?: string;
  busy?: boolean;
  /** Accept email, REGALIA ID or Membership Code in the first field instead of email only. */
  identifierMode?: boolean;
  identifierPlaceholder?: string;
  subtitle?: string;
  showGoogle?: boolean;
  /** Also collect the member's identity details (name, mobile, date of birth, address). */
  profileMode?: boolean;
  onSignIn?: (email: string, password: string, profile: SignUpProfile) => Promise<void> | void;
  children?: React.ReactNode;
};

export function SignIn1({
  brandName = "LIMASU REGALIA",
  logoSrc,
  videoSrc,
  title = "Welcome Back",
  submitLabel = "Sign in",
  switchHref = "/signup",
  switchPrefix = "Don't have an account?",
  switchLabel = "Sign up. It's free!",
  busy = false,
  identifierMode = false,
  identifierPlaceholder = "Email, REGALIA ID or Membership Code",
  subtitle,
  showGoogle = true,
  profileMode = false,
  onSignIn,
  children,
}: SignIn1Props) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [profile, setProfile] = React.useState<SignUpProfile>(EMPTY_PROFILE);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [latestBirthDate] = React.useState(() => {
    const today = new Date();
    return isoDate(new Date(Date.UTC(today.getUTCFullYear() - PROFILE_LIMITS.minAge, today.getUTCMonth(), today.getUTCDate())));
  });

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const setField = (key: keyof SignUpProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfile((p) => ({ ...p, [key]: e.target.value }));

  const handleSignIn = async () => {
    if (profileMode) {
      const checked = parseMemberProfile(profile);
      if (!checked.ok) {
        setError(checked.error);
        return;
      }
    }
    if (!email.trim() || !password) {
      setError(
        identifierMode
          ? `Please enter your ${identifierPlaceholder.charAt(0).toLowerCase()}${identifierPlaceholder.slice(1)}, and your password.`
          : "Please enter both email and password.",
      );
      return;
    }
    if (!identifierMode && !validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    try {
      await onSignIn?.(email, password, profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    }
  };

  const note =
    subtitle ?? (profileMode ? "Enter your details exactly as they appear on your identity document." : undefined);

  return (
    <AuthShell
      brandName={brandName}
      logoSrc={logoSrc}
      videoSrc={videoSrc}
      title={title}
      subtitle={note}
      width={profileMode ? "md" : "sm"}
      after={children}
    >

        <div className="mt-8 flex w-full flex-col gap-3.5 sm:mt-9">
          {profileMode ? (
            <label className="relative block">
              <UserRound className={FIELD_ICON} />
              <input
                placeholder="Full name (as on ID document)"
                aria-label="Full name as on your identity document"
                autoComplete="name"
                maxLength={PROFILE_LIMITS.nameLength}
                value={profile.fullName}
                className={FIELD}
                onChange={setField("fullName")}
              />
            </label>
          ) : null}

          <label className="relative block">
            <Mail className={FIELD_ICON} />
            <input
              placeholder={identifierMode ? identifierPlaceholder : "Email"}
              type={identifierMode ? "text" : "email"}
              autoComplete={identifierMode ? "username" : "email"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              translate="no"
              aria-label={identifierMode ? identifierPlaceholder : "Email"}
              value={email}
              className="h-[50px] w-full rounded-[12px] border border-[#8a5a2e]/20 bg-white/70 pr-4 pl-11 text-[14px] text-[#3b2819] outline-none transition duration-200 placeholder:text-[#9a8570] focus:border-[#8a5a2e]/60"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          {profileMode ? (
            <>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="relative block">
                  <Phone className={FIELD_ICON} />
                  <input
                    type="tel"
                    placeholder="Mobile number"
                    aria-label="Mobile number with country code"
                    autoComplete="tel"
                    inputMode="tel"
                    value={profile.phone}
                    className={FIELD}
                    onChange={setField("phone")}
                  />
                </label>
                <label className="relative block">
                  <CalendarDays className={FIELD_ICON} />
                  <span className="pointer-events-none absolute top-[6px] left-11 text-[10px] leading-none tracking-[0.08em] text-[#8a5a2e]/75">
                    Date of birth
                  </span>
                  <input
                    type="date"
                    aria-label="Date of birth as on your identity document"
                    title="Date of birth (as on ID document)"
                    autoComplete="bday"
                    max={latestBirthDate}
                    value={profile.dateOfBirth}
                    className={cn(FIELD, "pt-3.5", !profile.dateOfBirth && "text-[#9a8570]")}
                    onChange={setField("dateOfBirth")}
                  />
                </label>
              </div>
              <label className="relative block">
                <MapPin className="pointer-events-none absolute top-[17px] left-4 h-4 w-4 text-[#8a5a2e]/60" />
                <textarea
                  rows={2}
                  placeholder="Residential address (as on ID document)"
                  aria-label="Residential address as on your identity document"
                  autoComplete="street-address"
                  maxLength={PROFILE_LIMITS.addressLength}
                  value={profile.address}
                  className={cn(FIELD, "h-auto min-h-[74px] resize-none py-[14px] leading-snug")}
                  onChange={setField("address")}
                />
              </label>
            </>
          ) : null}

          <label className="relative block">
            <Lock className={FIELD_ICON} />
            <input
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              autoComplete={profileMode ? "new-password" : "current-password"}
              value={password}
              className="h-[50px] w-full rounded-[12px] border border-[#8a5a2e]/20 bg-white/70 pr-12 pl-11 text-[14px] text-[#3b2819] outline-none transition duration-200 placeholder:text-[#9a8570] focus:border-[#8a5a2e]/60"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSignIn();
              }}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[#8a5a2e]/60 transition duration-200 hover:text-[#3b2819]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-[12px] leading-relaxed text-[#a63d32]">{error}</p>
        ) : null}

        {showGoogle ? <OrDivider /> : null}

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSignIn()}
            className={PRIMARY_BUTTON}
          >
            {busy ? (profileMode ? "Creating account…" : "Signing in…") : submitLabel}
            {!busy ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          {showGoogle ? (
            <button
              type="button"
              onClick={() => setError("Continue with email and password.")}
              className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[25px] border border-[#8a5a2e]/25 bg-white/80 text-[14px] font-medium text-[#3b2819] transition duration-300 hover:border-[#8a5a2e]/50 hover:bg-white active:scale-[0.99]"
            >
              <GoogleMark />
              Continue with Google
            </button>
          ) : null}
        </div>

        <SwitchLink prefix={switchPrefix} href={switchHref} label={switchLabel} />
    </AuthShell>
  );
}

export const PRIMARY_BUTTON =
  "inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[25px] bg-[linear-gradient(180deg,#9a6a3a_0%,#7c4e26_55%,#5e3a1c_100%)] text-[14px] font-medium text-[#fbf6ec] shadow-[0_14px_30px_-14px_rgba(94,58,28,0.75)] transition duration-300 hover:brightness-110 active:scale-[0.99] disabled:opacity-50";

export { FIELD as AUTH_FIELD, FIELD_ICON as AUTH_FIELD_ICON };

function OrDivider() {
  return (
    <div className="mt-7 flex items-center gap-3">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#8a5a2e]/30" />
      <span className="text-[10px] font-medium tracking-[0.28em] text-[#7b6450] uppercase">Or</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#8a5a2e]/30" />
    </div>
  );
}

export function SwitchLink({ prefix, href, label }: { prefix: string; href: string; label: string }) {
  return (
    <p className="mt-7 text-center text-[12px] leading-relaxed text-[#7b6450]">
      {prefix}{" "}
      <Link href={href} className="font-medium text-[#8a5a2e] transition duration-200 hover:text-[#5e3a1c]">
        {label}
      </Link>
    </p>
  );
}

const SHELL_WIDTH = { sm: "max-w-[400px]", md: "max-w-[460px]", lg: "max-w-[560px]" } as const;

/** Shared backdrop and glass card for every sign-in and sign-up screen. */
export function AuthShell({
  brandName = "LIMASU REGALIA",
  logoSrc,
  videoSrc,
  title,
  subtitle,
  width = "sm",
  after,
  children,
}: {
  brandName?: string;
  logoSrc?: string;
  videoSrc?: string;
  title: string;
  subtitle?: string;
  width?: keyof typeof SHELL_WIDTH;
  after?: React.ReactNode;
  children: React.ReactNode;
}) {
  const logo = isUsableImageSrc(logoSrc) ? logoSrc : "/api/uploads/siteLogo-1790261917782.png";

  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-start overflow-x-hidden overflow-y-auto bg-ink px-5 py-8 sm:justify-center sm:py-10">
      {isUsableImageSrc(videoSrc) ? (
        <video src={videoSrc} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/login-hall.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      )}

      <div className="absolute inset-0 bg-[#f6efe2]/45" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 50% 48%, rgba(246,239,226,0.25) 0%, rgba(59,40,25,0.35) 100%)",
        }}
      />

      <div
        className={cn(
          "relative z-10 w-full rounded-[28px] border border-[#8a5a2e]/25",
          SHELL_WIDTH[width],
          "bg-[#f6efe2]/90 px-6 py-8 backdrop-blur-[20px] sm:px-8 sm:py-10",
          "shadow-[0_28px_70px_-20px_rgba(59,40,25,0.55)]",
          "animate-luxury-rise",
        )}
      >
        <div className="flex justify-center animate-luxury-fade">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={brandName} className="h-auto w-[190px] bg-transparent object-contain sm:w-[230px]" />
        </div>

        <h1 className="mt-7 text-center font-display text-[22px] font-medium tracking-[0.18em] text-[#3b2819] sm:mt-8 sm:text-[24px]">
          {title}
        </h1>

        {subtitle ? <p className="mt-2 text-center text-[12px] leading-relaxed text-[#7b6450]">{subtitle}</p> : null}

        {children}
      </div>

      {after ? <div className="relative z-10 mt-6 w-full max-w-[400px]">{after}</div> : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3 2.3c1.8-1.6 2.8-4 2.8-6.9 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M12 21c2.4 0 4.5-.8 6-2.1l-3-2.3c-.8.6-1.9 1-3 1-2.3 0-4.3-1.6-5-3.7L3.8 16c1.5 3 4.6 5 8.2 5z"
      />
      <path
        fill="#4A90E2"
        d="M7 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L3.8 8C3.3 9.1 3 10.5 3 12s.3 2.9.8 4l3.2-2.1z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.5c1.3 0 2.5.5 3.4 1.3l2.5-2.5C16.5 3.8 14.4 3 12 3 8.4 3 5.3 5 3.8 8l3.2 2.1C7.7 8.1 9.7 6.5 12 6.5z"
      />
    </svg>
  );
}

export default SignIn1;
