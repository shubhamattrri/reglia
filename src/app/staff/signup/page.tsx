"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  FileUp,
  Globe2,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  AUTH_FIELD,
  AUTH_FIELD_ICON,
  AuthShell,
  PRIMARY_BUTTON,
  SwitchLink,
} from "@/components/ui/modern-stunning-sign-in";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { readJson } from "@/lib/http";
import { brand } from "@/lib/site-config";
import { DOCUMENT_TYPES, KYC_ACCEPT, KYC_MAX_BYTES, PRIMARY_PHOTO_IDS, type DocumentType } from "@/lib/kyc";
import { PROFILE_LIMITS, isoDate } from "@/lib/member-profile";
import { STAFF_PASSWORD_MIN, STAFF_REGIONS, parseStaffApplication, parseStaffDetails } from "@/lib/staff-application";
import { cn } from "@/lib/utils";

type Details = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  region: string;
};

const STEPS = ["Your details", "Documents", "Password"] as const;
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

function checkFile(file: File | null, label: string) {
  if (!file) return `Attach your ${label}.`;
  if (!ALLOWED_MIME.includes(file.type)) return `${label}: upload a PDF, JPG or PNG file.`;
  if (file.size > KYC_MAX_BYTES) return `${label}: the file is larger than 5 MB.`;
  return "";
}

export default function StaffSignupPage() {
  const settings = useSiteSettings();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    region: "",
  });
  const [primaryType, setPrimaryType] = useState<DocumentType>("Aadhaar Card");
  const [secondaryType, setSecondaryType] = useState<DocumentType>("PAN Card");
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [latestBirthDate] = useState(() => {
    const t = new Date();
    return isoDate(new Date(Date.UTC(t.getUTCFullYear() - PROFILE_LIMITS.minAge, t.getUTCMonth(), t.getUTCDate())));
  });

  const set = (key: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDetails((d) => ({ ...d, [key]: e.target.value }));

  function next() {
    setError("");
    if (step === 0) {
      const checked = parseStaffDetails(details);
      if (!checked.ok) return setError(checked.error);
    }
    if (step === 1) {
      if (primaryType === secondaryType) return setError("Your second document must be a different type from your photo ID.");
      const problem = checkFile(primaryFile, "photo ID") || checkFile(secondaryFile, "second document");
      if (problem) return setError(problem);
    }
    setStep((s) => s + 1);
  }

  async function submit() {
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!consent) return setError("Confirm that your details and documents are genuine.");
    const checked = parseStaffApplication({ ...details, password, primaryType, secondaryType });
    if (!checked.ok) return setError(checked.error);

    const form = new FormData();
    for (const [k, v] of Object.entries(details)) form.set(k, v);
    form.set("password", password);
    form.set("primaryType", primaryType);
    form.set("secondaryType", secondaryType);
    form.set("primaryFile", primaryFile as File);
    form.set("secondaryFile", secondaryFile as File);

    setBusy(true);
    const res = await fetch("/api/staff/signup", { method: "POST", body: form }).catch(() => null);
    const data = res ? await readJson<{ staffCode?: string; error?: string }>(res) : null;
    setBusy(false);
    if (!res?.ok || !data?.staffCode) return setError(data?.error || "Could not submit your application. Try again.");
    setStaffCode(data.staffCode);
  }

  const shell = {
    brandName: `${brand.name} ${brand.product}`,
    logoSrc: isUsableImageSrc(settings.siteLogo) ? settings.siteLogo : "/api/uploads/siteLogo-1790261917782.png",
    videoSrc: settings.loginBackgroundVideo,
  };

  if (staffCode) {
    return (
      <AuthShell {...shell} title="Application Received" width="md">
        <div className="mt-7 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#8a5a2e]/30 bg-white/70 text-[#8a5a2e]">
            <BadgeCheck className="h-7 w-7" />
          </span>
          <p className="mt-5 text-[13px] leading-relaxed text-[#5c4532]">
            Thank you, {details.fullName.split(" ")[0]}. An administrator will verify your documents and approve your
            access. You can sign in as soon as your account is approved.
          </p>
          <div className="mt-6 w-full rounded-[14px] border border-[#8a5a2e]/25 bg-white/70 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#7b6450]">Your staff ID</p>
            <p className="mt-1 font-mono text-2xl tracking-[0.12em] text-[#3b2819]">{staffCode}</p>
            <p className="mt-1 text-[11px] text-[#7b6450]">Use this or {details.email} to sign in.</p>
          </div>
          <Link href="/staff/login" className={cn(PRIMARY_BUTTON, "mt-7")}>
            Back to staff sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      {...shell}
      title="Join the Concierge Team"
      subtitle="Apply for staff access. Enter your details exactly as they appear on your identity documents."
      width="lg"
    >
      <ol className="mt-7 grid grid-cols-3 gap-2" aria-label="Application progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-col items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-medium transition-colors",
                i < step
                  ? "border-[#8a5a2e] bg-[#8a5a2e] text-[#fbf6ec]"
                  : i === step
                    ? "border-[#8a5a2e] bg-white text-[#8a5a2e]"
                    : "border-[#8a5a2e]/25 bg-white/50 text-[#9a8570]",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("text-[10px] uppercase tracking-[0.18em]", i === step ? "text-[#3b2819]" : "text-[#9a8570]")}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-7 flex flex-col gap-3.5">
        {step === 0 ? (
          <>
            <Field icon={UserRound}>
              <input
                placeholder="Full name (as on ID document)"
                aria-label="Full name as on your identity document"
                autoComplete="name"
                maxLength={PROFILE_LIMITS.nameLength}
                value={details.fullName}
                onChange={set("fullName")}
                className={AUTH_FIELD}
              />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field icon={Mail}>
                <input
                  type="email"
                  placeholder="Email"
                  aria-label="Email"
                  autoComplete="email"
                  value={details.email}
                  onChange={set("email")}
                  className={AUTH_FIELD}
                />
              </Field>
              <Field icon={Phone}>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Mobile number"
                  aria-label="Mobile number with country code"
                  autoComplete="tel"
                  value={details.phone}
                  onChange={set("phone")}
                  className={AUTH_FIELD}
                />
              </Field>
              <Field icon={CalendarDays}>
                <span className="pointer-events-none absolute top-[6px] left-11 text-[10px] leading-none tracking-[0.08em] text-[#8a5a2e]/75">
                  Date of birth
                </span>
                <input
                  type="date"
                  aria-label="Date of birth as on your identity document"
                  autoComplete="bday"
                  max={latestBirthDate}
                  value={details.dateOfBirth}
                  onChange={set("dateOfBirth")}
                  className={cn(AUTH_FIELD, "pt-3.5", !details.dateOfBirth && "text-[#9a8570]")}
                />
              </Field>
              <Field icon={Globe2}>
                <input
                  list="staff-signup-regions"
                  placeholder="City / region you work from"
                  aria-label="City or region you work from"
                  value={details.region}
                  onChange={set("region")}
                  className={AUTH_FIELD}
                />
                <datalist id="staff-signup-regions">
                  {STAFF_REGIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
            </div>
            <label className="relative block">
              <MapPin className="pointer-events-none absolute top-[17px] left-4 h-4 w-4 text-[#8a5a2e]/60" />
              <textarea
                rows={2}
                placeholder="Residential address (as on ID document)"
                aria-label="Residential address as on your identity document"
                autoComplete="street-address"
                maxLength={PROFILE_LIMITS.addressLength}
                value={details.address}
                onChange={set("address")}
                className={cn(AUTH_FIELD, "h-auto min-h-[74px] resize-none py-[14px] leading-snug")}
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <DocumentSlot
              title="Government photo ID"
              hint="Aadhaar, Passport, Driving Licence, Voter ID or National ID"
              types={PRIMARY_PHOTO_IDS}
              type={primaryType}
              onType={(t) => {
                setPrimaryType(t);
                if (t === secondaryType) setSecondaryType(DOCUMENT_TYPES.find((d) => d !== t) ?? "PAN Card");
              }}
              file={primaryFile}
              onFile={setPrimaryFile}
            />
            <DocumentSlot
              title="Second government document"
              hint="A different type from your photo ID, e.g. PAN Card"
              types={DOCUMENT_TYPES.filter((t) => t !== primaryType)}
              type={secondaryType}
              onType={setSecondaryType}
              file={secondaryFile}
              onFile={setSecondaryFile}
            />
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#7b6450]">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-[#8a5a2e]" />
              PDF, JPG or PNG up to 5 MB each. Stored in a private vault and seen only by the verification desk.
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field icon={Lock}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder={`Password (min ${STAFF_PASSWORD_MIN} characters)`}
                aria-label="Password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(AUTH_FIELD, "pr-12")}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[#8a5a2e]/60 hover:text-[#3b2819]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>
            <Field icon={Lock}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm password"
                aria-label="Confirm password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                className={AUTH_FIELD}
              />
            </Field>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[14px] border border-[#8a5a2e]/20 bg-white/60 px-4 py-3.5 text-[12px]">
              {[
                ["Name", details.fullName],
                ["Email", details.email],
                ["Mobile", details.phone],
                ["Region", details.region],
                ["Documents", `${primaryType} · ${secondaryType}`],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-[#9a8570]">{k}</dt>
                  <dd className="truncate text-[#3b2819]">{v}</dd>
                </div>
              ))}
            </dl>

            <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-[#5c4532]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#8a5a2e]"
              />
              I confirm these details and documents are genuine and agree to background verification by Limasu Regalia.
            </label>
          </>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[12px] leading-relaxed text-[#a63d32]">
          {error}
        </p>
      ) : null}

      <div className="mt-7 flex gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setStep((s) => s - 1);
            }}
            className="inline-flex h-[50px] items-center justify-center gap-2 rounded-[25px] border border-[#8a5a2e]/25 bg-white/80 px-5 text-[14px] font-medium text-[#3b2819] transition hover:border-[#8a5a2e]/50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className={PRIMARY_BUTTON}>
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={() => void submit()} disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>

      <SwitchLink prefix="Already approved?" href="/staff/login" label="Sign in to the desk" />
    </AuthShell>
  );
}

function Field({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <label className="relative block">
      <Icon className={AUTH_FIELD_ICON} />
      {children}
    </label>
  );
}

function DocumentSlot({
  title,
  hint,
  types,
  type,
  onType,
  file,
  onFile,
}: {
  title: string;
  hint: string;
  types: readonly DocumentType[];
  type: DocumentType;
  onType: (t: DocumentType) => void;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div className="rounded-[16px] border border-[#8a5a2e]/20 bg-white/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-[#3b2819]">{title}</p>
          <p className="text-[11px] text-[#7b6450]">{hint}</p>
        </div>
        <select
          value={type}
          onChange={(e) => onType(e.target.value as DocumentType)}
          aria-label={`${title} type`}
          className="h-9 rounded-[10px] border border-[#8a5a2e]/25 bg-white px-2.5 text-[12px] text-[#3b2819] outline-none focus:border-[#8a5a2e]/60"
        >
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {file ? (
        <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-[#8a5a2e]/25 bg-[#fbf6ec] px-3 py-2.5">
          <FileUp className="h-4 w-4 shrink-0 text-[#8a5a2e]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-[#3b2819]">{file.name}</span>
            <span className="text-[10px] text-[#9a8570]">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </span>
          <button
            type="button"
            onClick={() => onFile(null)}
            aria-label={`Remove ${title}`}
            className="rounded-full p-1 text-[#8a5a2e]/70 hover:bg-[#8a5a2e]/10 hover:text-[#3b2819]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "mt-3 flex w-full flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed px-3 py-5 text-center transition-colors",
            drag ? "border-[#8a5a2e] bg-[#8a5a2e]/[0.06]" : "border-[#8a5a2e]/30 hover:border-[#8a5a2e]/60",
          )}
        >
          <FileUp className="h-5 w-5 text-[#8a5a2e]" />
          <span className="text-[12px] text-[#3b2819]">Drop file or click to browse</span>
          <span className="text-[10px] text-[#9a8570]">PDF, JPG or PNG · max 5 MB</span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept={KYC_ACCEPT}
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}
