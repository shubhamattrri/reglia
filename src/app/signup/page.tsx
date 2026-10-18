"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { readJson } from "@/lib/http";
import { brand } from "@/lib/site-config";

export default function SignUpPage() {
  const router = useRouter();
  const settings = useSiteSettings();
  const [busy, setBusy] = useState(false);

  return (
    <SignIn1
      brandName={`${brand.name} ${brand.product}`}
      logoSrc={
        isUsableImageSrc(settings.siteLogo)
          ? settings.siteLogo
          : "/api/uploads/siteLogo-1790261917782.png"
      }
      videoSrc={settings.loginBackgroundVideo}
      title="Create Account"
      submitLabel="Create account"
      busy={busy}
      switchHref="/login"
      switchPrefix="Already a member?"
      switchLabel="Sign in"
      profileMode
      onSignIn={async (email, password, profile) => {
        setBusy(true);
        try {
          const res = await fetch("/api/session/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...profile, email, password }),
          });
          const data = await readJson<{ error?: string }>(res);
          if (!res.ok) {
            throw new Error(data?.error || "Could not create your account.");
          }
          router.push("/membership");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
