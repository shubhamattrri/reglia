"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { readJson } from "@/lib/http";
import { brand } from "@/lib/site-config";

export default function LoginPage() {
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
      title="Welcome Back"
      busy={busy}
      identifierMode
      switchHref="/signup"
      switchPrefix="Don't have an account?"
      switchLabel="Sign up. It's free!"
      onSignIn={async (identifier, password) => {
        setBusy(true);
        try {
          const res = await fetch("/api/session/member", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
          });
          const data = await readJson<{ error?: string }>(res);
          if (!res.ok) {
            throw new Error(data?.error || "Could not sign you in.");
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
