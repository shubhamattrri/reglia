"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { FeatureIcon, FEATURE_ICON_NAMES } from "@/components/regalia/feature-icon";
import { ServiceMediaManager } from "@/components/admin/service-media-manager";
import { useConfirm } from "@/components/admin/confirm-dialog";
import type { PublicTier } from "@/lib/regalia-types";
import { readJson } from "@/lib/http";

type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  active: boolean;
};

const TABS = [
  { id: "pages", label: "Service pages & media" },
  { id: "catalog", label: "Categories & tiers" },
] as const;

export default function AdminServicesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pages");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1d2630]">Services</h1>
        <p className="mt-1 text-sm text-[#5b6b79]">
          Public service pages, media, request categories and tier privileges.
        </p>
      </div>
      <nav className="datta-tabs" aria-label="Services sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`datta-tab ${tab === t.id ? "is-active" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "pages" ? <ServiceMediaManager /> : <CategoryCatalog />}
    </div>
  );
}

async function fetchCatalog() {
  const [c, t] = await Promise.all([
    fetch("/api/admin/categories", { cache: "no-store" }).then((r) => readJson<Category[]>(r)),
    fetch("/api/tiers", { cache: "no-store" }).then((r) => readJson<PublicTier[]>(r)),
  ]);
  return { categories: Array.isArray(c) ? c : [], tiers: Array.isArray(t) ? t : [] };
}

function CategoryCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tiers, setTiers] = useState<PublicTier[]>([]);
  const [name, setName] = useState("");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [ask, confirmDialog] = useConfirm();

  async function load() {
    const data = await fetchCatalog();
    setCategories(data.categories);
    setTiers(data.tiers);
  }

  useEffect(() => {
    let live = true;
    void fetchCatalog().then((data) => {
      if (!live) return;
      setCategories(data.categories);
      setTiers(data.tiers);
    });
    return () => {
      live = false;
    };
  }, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    await load();
  }

  async function patchCategory(id: string, patch: Partial<Category>) {
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function addToTier(tierId: string) {
    const category = categories.find((c) => c.id === picks[tierId]);
    if (!category) return;
    await fetch(`/api/tiers/${tierId}/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: category.name, icon: category.icon }),
    });
    setPicks((p) => ({ ...p, [tierId]: "" }));
    await load();
  }

  async function removeFeature(tierName: string, id: string, label: string) {
    const ok = await ask({
      title: `Remove "${label}" from ${tierName}?`,
      message: "The privilege disappears from this card on the public site straight away.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    await fetch(`/api/features/${id}`, { method: "DELETE" });
    await load();
  }

  const activeCategories = categories.filter((c) => c.active);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="datta-card self-start overflow-hidden">
        <div className="border-b border-[var(--da-line)] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[#1d2630]">Request categories</h2>
          <p className="text-xs text-[#8996a4]">Members pick these when they open a concierge request.</p>
        </div>
        <form onSubmit={addCategory} className="flex gap-2 p-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name"
            className="datta-input py-[9px]"
          />
          <button type="submit" className="datta-btn shrink-0">
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
        <div className="datta-table-wrap">
          <table className="datta-table min-w-[420px]">
            <thead>
              <tr>
                <th>Icon</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="w-[210px]">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <FeatureIcon name={c.icon} className="h-4 w-4 shrink-0 text-[var(--da-primary)]" />
                      <select
                        value={c.icon}
                        onChange={(e) => void patchCategory(c.id, { icon: e.target.value })}
                        className="datta-input w-auto px-2 py-1 text-xs"
                        aria-label={`Icon for ${c.name}`}
                      >
                        {FEATURE_ICON_NAMES.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <input
                      defaultValue={c.name}
                      key={c.name}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== c.name) void patchCategory(c.id, { name: next });
                      }}
                      className="datta-input px-2 py-1.5 text-[13px]"
                      aria-label="Category name"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void patchCategory(c.id, { active: !c.active })}
                      className={`datta-pill cursor-pointer ${c.active ? "datta-pill-verified" : "datta-pill-muted"}`}
                      title={c.active ? "Click to hide" : "Click to activate"}
                    >
                      {c.active ? "Active" : "Hidden"}
                    </button>
                  </td>
                </tr>
              ))}
              {!categories.length ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-sm text-[#8996a4]">
                    No categories yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="datta-card self-start overflow-hidden">
        <div className="border-b border-[var(--da-line)] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[#1d2630]">Privileges per tier</h2>
          <p className="text-xs text-[#8996a4]">Add a category to a card as a live privilege. Homepage cards update immediately.</p>
        </div>
        <div className="divide-y divide-[var(--da-line)]">
          {tiers.map((tier) => (
            <div key={tier.id} className="grid gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#1d2630]">
                  {tier.name}
                  <span className="ml-2 text-xs font-normal text-[#8996a4]">
                    {tier.features.length} privilege{tier.features.length === 1 ? "" : "s"}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={picks[tier.id] || ""}
                    onChange={(e) => setPicks((p) => ({ ...p, [tier.id]: e.target.value }))}
                    className="datta-input w-auto px-2 py-1.5 text-xs"
                    aria-label={`Add a privilege to ${tier.name}`}
                  >
                    <option value="">Add privilege…</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="datta-btn h-8 px-3 text-xs"
                    disabled={!picks[tier.id]}
                    onClick={() => void addToTier(tier.id)}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tier.features.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--da-line)] bg-[#f6f7f9] py-1 pl-2.5 pr-1 text-xs text-[#1d2630]"
                  >
                    <FeatureIcon name={f.icon} className="h-3.5 w-3.5 text-[var(--da-primary)]" />
                    {f.label}
                    <button
                      type="button"
                      onClick={() => void removeFeature(tier.name, f.id, f.label)}
                      className="grid h-5 w-5 place-items-center rounded-full text-[#8996a4] hover:bg-[#fdecec] hover:text-[#c43c3c]"
                      aria-label={`Remove ${f.label} from ${tier.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {!tier.features.length ? <span className="text-xs text-[#8996a4]">No privileges yet.</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
      {confirmDialog}
    </div>
  );
}
