"use client";

import { useState } from "react";
import { readJson } from "@/lib/http";

export function SimpleCredentialsForm({
  mode,
  onSuccess,
  children,
}: {
  mode: "login" | "signup";
  onSuccess: () => void;
  children?: React.ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await fetch(mode === "signup" ? "/api/session/signup" : "/api/session/member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Could not continue.");
      return;
    }
    onSuccess();
  }

  return (
    <form
      onSubmit={submit}
      className="absolute bottom-6 left-1/2 z-20 w-[min(92vw,340px)] -translate-x-1/2 rounded-2xl border border-border bg-background/70 p-4 backdrop-blur-md"
    >
      <p className="text-center text-[10px] uppercase tracking-[0.24em] text-foreground/50">
        {mode === "signup" ? "Or create an account" : "Or sign in with email"}
      </p>
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="mt-3 w-full rounded-full border border-border bg-transparent px-4 py-2 text-sm text-foreground outline-none"
      />
      <input
        required
        type="password"
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="mt-2 w-full rounded-full border border-border bg-transparent px-4 py-2 text-sm text-foreground outline-none"
      />
      {mode === "signup" ? (
        <input
          required
          type="password"
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="mt-2 w-full rounded-full border border-border bg-transparent px-4 py-2 text-sm text-foreground outline-none"
        />
      ) : null}
      {error ? <p className="mt-2 text-center text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-full border border-border py-2 text-[10px] uppercase tracking-[0.18em] text-foreground disabled:opacity-50"
      >
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      {children}
    </form>
  );
}
