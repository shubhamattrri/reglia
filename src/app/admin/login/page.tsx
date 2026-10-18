"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { RainbowButton } from "@/components/ui/rainbow-button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/session/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      setError("Admin ID or password is wrong.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="datta-auth">
      <form onSubmit={onSubmit} className="datta-card datta-auth-card">
        <div className="mx-auto mb-5 h-11 w-11 overflow-hidden rounded-xl">
          <BrandMark variant="admin" className="h-11 w-11" fallback="LR" />
        </div>
        <h1 className="text-xl font-semibold text-[#1d2630]">Admin sign in</h1>
        <p className="mt-2 text-sm text-[#5b6b79]">
          Enter the Admin ID and password, or the email and password of a staff account with the Admin role.
        </p>
        <label className="mt-6 flex items-center gap-2 rounded-lg border border-[#dbe0e5] bg-white px-3">
          <UserRound className="h-4 w-4 text-[#8996a4]" />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Admin ID"
            autoComplete="username"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 rounded-lg border border-[#dbe0e5] bg-white px-3">
          <Lock className="h-4 w-4 text-[#8996a4]" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        {error && <p className="mt-3 text-sm text-[#ea4d4d]">{error}</p>}
        <RainbowButton type="submit" className="mt-5 w-full text-white">
          Sign in
        </RainbowButton>
      </form>
    </div>
  );
}
