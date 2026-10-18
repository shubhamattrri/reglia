"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { readJson } from "@/lib/http";
import { brand } from "@/lib/site-config";

function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return next.startsWith("/staff/") && !next.startsWith("//") && next !== "/staff/login"
    ? next
    : "/staff/dashboard";
}

export default function StaffLoginPage() {
  const router = useRouter();
  const settings = useSiteSettings();
  const [busy, setBusy] = useState(false);

  return (
    <SignIn1
      brandName={`${brand.name} ${brand.product}`}
      logoSrc={isUsableImageSrc(settings.siteLogo) ? settings.siteLogo : "/api/uploads/siteLogo-1790261917782.png"}
      videoSrc={settings.loginBackgroundVideo}
      title="Staff Sign In"
      subtitle="Assistance desk for the Limasu Regalia concierge team."
      submitLabel="Enter assistance desk"
      busy={busy}
      identifierMode
      identifierPlaceholder="Staff ID or email"
      showGoogle={false}
      switchHref="/staff/signup"
      switchPrefix="New to the concierge team?"
      switchLabel="Apply for staff access"
      onSignIn={async (identifier, password) => {
        setBusy(true);
        try {
          const res = await fetch("/api/staff/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
          });
          const data = await readJson<{ error?: string }>(res);
          if (!res.ok) throw new Error(data?.error || "Sign in failed.");
          router.replace(safeNext());
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="flex items-center justify-center gap-2 text-[11px] text-[#f6efe2]/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
        <ShieldCheck className="h-3.5 w-3.5 text-[#e2c48f]" />
        Restricted to authorised Regalia staff. Activity is logged.
      </p>
    </SignIn1>
  );
}
