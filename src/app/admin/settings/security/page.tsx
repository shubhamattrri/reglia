"use client";

import { useEffect, useState } from "react";
import { SaveSuccess } from "@/components/admin/save-success";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { readJson } from "@/lib/http";

export default function SettingsSecurityPage() {
  const [username, setUsername] = useState("admin");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/password")
      .then((r) => readJson<{ username?: string }>(r))
      .then((data) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => undefined);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, currentPassword, newPassword }),
      });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) {
        setError(data?.error || "Could not update admin login.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setSaved(true);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-xl">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-[var(--da-text)]">Security</h2>
        <p className="mt-1 text-sm text-[var(--da-muted)]">
          Change the Admin ID and password used at /admin/login. Nothing updates
          until you click Save.
        </p>
      </header>

      <section className="datta-card space-y-4 p-5">
        <h3 className="text-[15px] font-semibold">Admin identity</h3>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Admin ID</span>
          <input
            className="datta-input mt-1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Current password</span>
          <input
            type="password"
            className="datta-input mt-1"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">New password</span>
          <input
            type="password"
            className="datta-input mt-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Confirm new password</span>
          <input
            type="password"
            className="datta-input mt-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <RainbowButton type="submit" disabled={saving} className="text-white">
          {saving ? "Saving…" : "Save"}
        </RainbowButton>
        {error ? <p className="text-sm text-[#ea4d4d]">{error}</p> : null}
      </div>
      <SaveSuccess show={saved} message="Saved" onDone={() => setSaved(false)} />
    </form>
  );
}
