"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Layers, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { refreshNavCounts } from "@/lib/admin-nav";
import { readJson } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import {
  PLAN_DURATION_TYPES,
  PLAN_LIMITS,
  PLAN_UNIT_DAYS,
  durationUnits,
  type PlanDurationType,
} from "@/lib/subscriptions/plans";

type Plan = {
  id: number;
  name: string;
  durationType: PlanDurationType;
  durationValue: number;
  duration: string;
  price: number;
  currency: string;
  tierId: string | null;
  tierName: string | null;
  isActive: boolean;
  activeSubscriptions: number;
};

type Expiring = {
  id: number;
  memberId: string;
  fullName: string;
  email: string;
  regaliaId: string | null;
  planName: string;
  expiryDate: string;
  hoursLeft: number;
  card: { cardBrand: string; cardLast4: string } | null;
};

type Tier = { id: string; name: string; currency?: string };

type PlansResponse = { plans: Plan[]; expiring: Expiring[] };

const UNIT_LABEL: Record<PlanDurationType, string> = {
  WEEK: "Week(s)",
  MONTH: "Month(s)",
  YEAR: "Year(s)",
  CUSTOM: "Days (custom)",
};

const PRESETS: { label: string; type: PlanDurationType }[] = [
  { label: "1 week", type: "WEEK" },
  { label: "1 month", type: "MONTH" },
  { label: "1 year", type: "YEAR" },
];

async function fetchPlans() {
  const [plans, tiers] = await Promise.all([
    fetch("/api/admin/plans", { cache: "no-store" }).then((r) => readJson<PlansResponse>(r)),
    fetch("/api/tiers").then((r) => readJson<Tier[]>(r)),
  ]);
  return {
    plans: plans?.plans ?? [],
    expiring: plans?.expiring ?? [],
    tiers: Array.isArray(tiers) ? tiers : [],
  };
}

function expiresIn(hours: number) {
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days} d ${rest} h` : `${days} d`;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expiring, setExpiring] = useState<Expiring[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [ask, confirmDialog] = useConfirm();

  useEffect(() => {
    let live = true;
    void fetchPlans().then((data) => {
      if (!live) return;
      setPlans(data.plans);
      setExpiring(data.expiring);
      setTiers(data.tiers);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  async function reload() {
    const data = await fetchPlans();
    setPlans(data.plans);
    setExpiring(data.expiring);
    refreshNavCounts();
  }

  async function toggle(plan: Plan) {
    if (plan.isActive) {
      const ok = await ask({
        title: `Stop selling ${plan.name}?`,
        message: "It disappears from checkout. Members already on it keep renewing at its current price.",
        confirmLabel: "Retire plan",
        tone: "primary",
      });
      if (!ok) return;
    }
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    await reload();
  }

  async function remove(plan: Plan) {
    const ok = await ask({
      title: `Delete ${plan.name}?`,
      message: plan.activeSubscriptions
        ? "Members are subscribed to this plan, so it will be retired instead of deleted."
        : "The plan is removed. Plans that were ever bought are retired instead, so their history is kept.",
      confirmLabel: plan.activeSubscriptions ? "Retire" : "Delete",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
    const data = await readJson<{ retired?: boolean; error?: string }>(res);
    setNotice(
      !res.ok
        ? data?.error || "Could not delete this plan."
        : data?.retired
          ? `${plan.name} has purchases, so it was retired instead.`
          : `${plan.name} was deleted.`,
    );
    await reload();
  }

  const onSale = plans.filter((p) => p.isActive).length;
  const subscribed = plans.reduce((sum, p) => sum + p.activeSubscriptions, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#1d2630]">Plans &amp; renewals</h1>
          <p className="mt-1 text-sm text-[#5b6b79]">
            Durations and prices members buy at checkout and renew with their saved card.
          </p>
        </div>
        <RainbowButton type="button" onClick={() => setEditing("new")} className="h-10 px-4 text-sm text-white">
          <Plus className="h-4 w-4" />
          Add plan
        </RainbowButton>
      </div>

      <div className="datta-card overflow-hidden">
        <div className="datta-flat is-three">
          <Stat icon={<Layers className="h-4 w-4" />} label="Plans on sale" value={loaded ? onSale : "—"} />
          <Stat icon={<Users className="h-4 w-4" />} label="Active subscriptions" value={loaded ? subscribed : "—"} />
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label="Expiring within 2 days"
            value={loaded ? expiring.length : "—"}
          />
        </div>
      </div>

      {notice ? (
        <p className="flex items-center justify-between gap-3 rounded-lg bg-[var(--da-primary-soft)] px-4 py-2 text-sm text-[var(--da-primary)]">
          {notice}
          <button type="button" aria-label="Dismiss" onClick={() => setNotice("")} className="datta-icon-btn h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      ) : null}

      <section className="datta-card overflow-hidden">
        <div className="px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[#1d2630]">Plans</h2>
          <p className="text-xs text-[#8996a4]">
            A tier with plans on sale asks the member to pick one at checkout. Months count as 30 days, years as 365.
          </p>
        </div>
        <div className="datta-table-wrap">
          <table className="datta-table min-w-[760px]">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Tier</th>
                <th>Duration</th>
                <th className="is-num">Price</th>
                <th className="is-num">Subscribers</th>
                <th>Status</th>
                <th className="is-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="font-semibold">{plan.name}</td>
                  <td>{plan.tierName || <span className="text-[#c45c5c]">No tier — not sold</span>}</td>
                  <td className="whitespace-nowrap">
                    {plan.duration}
                    <span className="ml-1 text-xs text-[#8996a4]">({plan.durationValue} d)</span>
                  </td>
                  <td className="is-num font-semibold">{formatMoney(plan.price, plan.currency)}</td>
                  <td className="is-num">{plan.activeSubscriptions}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void toggle(plan)}
                      className={`datta-pill cursor-pointer ${plan.isActive ? "datta-pill-verified" : "datta-pill-muted"}`}
                      title={plan.isActive ? "Click to retire" : "Click to put on sale"}
                    >
                      {plan.isActive ? "On sale" : "Retired"}
                    </button>
                  </td>
                  <td className="is-actions">
                    <button type="button" className="datta-icon-btn" onClick={() => setEditing(plan)} aria-label={`Edit ${plan.name}`} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="datta-icon-btn is-danger"
                      onClick={() => void remove(plan)}
                      aria-label={`Delete ${plan.name}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {loaded && !plans.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#8996a4]">
                    No plans yet. Add one so members can choose a duration at checkout.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="datta-card overflow-hidden">
        <div className="px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[#1d2630]">Expiring within 2 days</h2>
          <p className="text-xs text-[#8996a4]">These members see the renewal popup when they sign in.</p>
        </div>
        <div className="datta-table-wrap">
          <table className="datta-table min-w-[680px]">
            <thead>
              <tr>
                <th>Member</th>
                <th>Plan</th>
                <th>Expires</th>
                <th>Saved card</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((row) => (
                <tr key={row.id}>
                  <td>
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-xs text-[#5b6b79]">{row.regaliaId || row.email}</p>
                  </td>
                  <td>{row.planName}</td>
                  <td className="whitespace-nowrap">
                    {new Date(row.expiryDate).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <span className="datta-pill datta-pill-pending ml-2">in {expiresIn(row.hoursLeft)}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    {row.card ? (
                      `${row.card.cardBrand} •••• ${row.card.cardLast4}`
                    ) : (
                      <span className="text-[#c45c5c]">No card on file</span>
                    )}
                  </td>
                </tr>
              ))}
              {loaded && !expiring.length ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-[#8996a4]">
                    No memberships expire in the next 2 days.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {editing ? (
        <PlanDialog
          plan={editing === "new" ? null : editing}
          tiers={tiers}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            setNotice(message);
            await reload();
          }}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="datta-flat-cell">
      <span className="datta-flat-icon">{icon}</span>
      <div className="min-w-0">
        <p className="datta-flat-label">{label}</p>
        <p className="datta-flat-value">{value}</p>
      </div>
    </div>
  );
}

function PlanDialog({
  plan,
  tiers,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  tiers: Tier[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [tierId, setTierId] = useState(plan?.tierId ?? tiers[0]?.id ?? "");
  const [durationType, setDurationType] = useState<PlanDurationType>(plan?.durationType ?? "MONTH");
  const [count, setCount] = useState(String(plan ? durationUnits(plan.durationType, plan.durationValue) : 1));
  const [price, setPrice] = useState(plan ? plan.price.toFixed(2) : "");
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const units = Number(count);
  const days =
    Number.isInteger(units) && units > 0
      ? durationType === "CUSTOM"
        ? units
        : units * PLAN_UNIT_DAYS[durationType]
      : 0;
  const currency = tiers.find((t) => t.id === tierId)?.currency || "GBP";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(plan ? `/api/admin/plans/${plan.id}` : "/api/admin/plans", {
      method: plan ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tierId, durationType, count: units, price, isActive }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await readJson<{ error?: string }>(res);
      setError(data?.error || "Could not save this plan.");
      return;
    }
    await onSaved(plan ? `${name.trim()} was updated.` : `${name.trim()} was added.`);
  }

  return (
    <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="plan-title">
      <form onSubmit={save} className="datta-modal-panel grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--da-primary)]">
              {plan ? "Edit plan" : "New plan"}
            </p>
            <h2 id="plan-title" className="mt-1 text-[15px] font-semibold">
              {plan ? plan.name : "Create a membership plan"}
            </h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="datta-icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-[#5b6b79] sm:col-span-2">
            Plan name
            <input
              required
              className="datta-input"
              maxLength={PLAN_LIMITS.nameLength}
              placeholder="Imperium — Monthly"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[#5b6b79] sm:col-span-2">
            Card tier
            <select className="datta-input" value={tierId} onChange={(e) => setTierId(e.target.value)}>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="">No tier (not offered at checkout)</option>
            </select>
          </label>

          <div className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-[#5b6b79]">Duration</span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = durationType === p.type && units === 1;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setDurationType(p.type);
                      setCount("1");
                    }}
                    className={`datta-btn h-8 px-3 text-xs ${on ? "" : "datta-btn-outline"}`}
                    aria-pressed={on}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={durationType === "CUSTOM" ? PLAN_LIMITS.maxDays : PLAN_LIMITS.maxUnits}
                step={1}
                required
                className="datta-input w-28"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                aria-label="How many"
              />
              <select
                className="datta-input"
                value={durationType}
                onChange={(e) => setDurationType(e.target.value as PlanDurationType)}
                aria-label="Unit"
              >
                {PLAN_DURATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {UNIT_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-[#8996a4]">
              {days ? `Each purchase or renewal adds ${days} day${days === 1 ? "" : "s"}.` : "Enter a whole number."}
            </span>
          </div>

          <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
            Price ({currency})
            <input
              required
              inputMode="decimal"
              pattern="\d+(\.\d{1,2})?"
              className="datta-input"
              placeholder="49.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-[#1d2630]">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            On sale
          </label>
        </div>

        {error ? <p className="text-sm text-[#c45c5c]">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="datta-btn datta-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <RainbowButton type="submit" disabled={busy} className="text-white">
            {busy ? "Saving…" : plan ? "Save plan" : "Create plan"}
          </RainbowButton>
        </div>
      </form>
    </div>
  );
}
