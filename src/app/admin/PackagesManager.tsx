"use client";

import { useCallback, useEffect, useState } from "react";

// Coach-facing manager for their packages (the offerings they charge for).
// Standalone card used inside the Applications tab. Reads/writes
// /api/coach-packages. Honors super-admin "view as coach" via sessionStorage
// scope (same convention as ApplicationsTab).

export type CoachPackage = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: "monthly" | "one_time";
  client_cap: number | null;
  is_active: boolean;
  sort_order: number;
  stripe_price_id: string | null;
};

function scopeQuery(): string {
  if (typeof window === "undefined") return "";
  const org = sessionStorage.getItem("superadmin_target_org");
  const coach = sessionStorage.getItem("superadmin_target_coach");
  const p = new URLSearchParams();
  if (org) p.set("org", org);
  if (coach) p.set("coach", coach);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function scopeBody(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const org = sessionStorage.getItem("superadmin_target_org");
  const coach = sessionStorage.getItem("superadmin_target_coach");
  const b: Record<string, string> = {};
  if (org) b.org = org;
  if (coach) b.coach = coach;
  return b;
}

function formatPrice(cents: number, currency: string, interval: string): string {
  const amount = (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
  return interval === "monthly" ? `${amount}/mo` : `${amount} one-time`;
}

type DraftForm = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  billing_interval: "monthly" | "one_time";
  client_cap: string;
  is_active: boolean;
};

const EMPTY_FORM: DraftForm = {
  id: null,
  name: "",
  description: "",
  price: "",
  billing_interval: "monthly",
  client_cap: "",
  is_active: true,
};

export default function PackagesManager() {
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach-packages${scopeQuery()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPackages(data.packages || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startAdd() {
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMsg(null);
  }

  function startEdit(p: CoachPackage) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description || "",
      price: (p.price_cents / 100).toString(),
      billing_interval: p.billing_interval,
      client_cap: p.client_cap != null ? String(p.client_cap) : "",
      is_active: p.is_active,
    });
    setShowForm(true);
    setMsg(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setMsg({ text: "Give the package a name.", type: "error" });
      return;
    }
    if (!form.price.trim() || isNaN(Number(form.price.replace(/[^0-9.]/g, "")))) {
      setMsg({ text: "Enter a valid price.", type: "error" });
      return;
    }
    setSaving(true);
    setMsg(null);
    const capNum = form.client_cap.trim() ? parseInt(form.client_cap, 10) : null;
    const payload: Record<string, any> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: form.price,
      billing_interval: form.billing_interval,
      client_cap: capNum && capNum > 0 ? capNum : null,
      is_active: form.is_active,
      ...scopeBody(),
    };
    try {
      const res = await fetch("/api/coach-packages", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.id ? { id: form.id, ...payload } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || "Could not save package.", type: "error" });
      } else {
        setShowForm(false);
        setForm(EMPTY_FORM);
        setMsg({ text: form.id ? "Package updated." : "Package added.", type: "success" });
        await load();
      }
    } catch {
      setMsg({ text: "Network error.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: CoachPackage) {
    setBusyId(p.id);
    try {
      await fetch("/api/coach-packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active, ...scopeBody() }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: CoachPackage) {
    if (!confirm(`Delete "${p.name}"? This can't be undone. (To just hide it, use "Turn off" instead.)`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/coach-packages?id=${encodeURIComponent(p.id)}${scopeQuery().replace("?", "&")}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMsg({ text: "Package deleted.", type: "success" });
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg({ text: data.error || "Could not delete.", type: "error" });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white font-heading uppercase tracking-wider text-sm">Your Packages</h3>
          <p className="text-gray-400 text-xs mt-1">
            The offerings you charge for. Add your common ones here so they&apos;re ready to request payment for — you can still charge a custom one-off amount anytime.
          </p>
        </div>
        {!showForm && (
          <button onClick={startAdd} className="text-xs bg-accent hover:bg-orange-700 text-white font-bold px-3 py-1.5 rounded-lg">
            + Add package
          </button>
        )}
      </div>

      {msg && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.type === "success" ? "bg-green-500/15 text-green-300 border border-green-500/20" : "bg-red-500/15 text-red-300 border border-red-500/20"}`}>
          {msg.text}
        </div>
      )}

      {/* Add / edit form */}
      {showForm && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. Run + Strength" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Price</label>
              <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="200" inputMode="decimal" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50 resize-y" placeholder="What's included…" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Billing</label>
              <select value={form.billing_interval} onChange={(e) => setForm((f) => ({ ...f, billing_interval: e.target.value as "monthly" | "one_time" }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50">
                <option value="monthly">Recurring (monthly)</option>
                <option value="one_time">One-time charge</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Client cap (optional)</label>
              <input value={form.client_cap} onChange={(e) => setForm((f) => ({ ...f, client_cap: e.target.value.replace(/[^0-9]/g, "") }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. 5 (leave blank = unlimited)" inputMode="numeric" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Coaching type</label>
              <select value={form.package_type} onChange={(e) => setForm((f) => ({ ...f, package_type: e.target.value as "running" | "personal_training" | "hybrid" }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50">
                <option value="running">Running</option>
                <option value="personal_training">Personal Training / Strength</option>
                <option value="hybrid">Hybrid (Running + PT)</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">Controls which questions applicants see</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Delivery format</label>
              <select value={form.delivery_format} onChange={(e) => setForm((f) => ({ ...f, delivery_format: e.target.value as "programming" | "in_person" | "both" }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50">
                <option value="programming">Programming only (remote)</option>
                <option value="in_person">In-person sessions</option>
                <option value="both">Both / Either</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">In-person shows location questions</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active (shown to prospects &amp; available to request)
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg text-sm disabled:opacity-50">
              {saving ? "Saving…" : form.id ? "Save changes" : "Add package"}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="text-gray-400 hover:text-white text-sm px-3">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-4">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading packages…</p>
        ) : packages.length === 0 ? (
          !showForm && <p className="text-gray-400 text-sm">No packages yet. Add your common offerings to get started.</p>
        ) : (
          <div className="space-y-2">
            {packages.map((p) => (
              <div key={p.id} className={`flex items-center justify-between gap-3 flex-wrap border rounded-lg px-3 py-2.5 ${p.is_active ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-60"}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{p.name}</span>
                    <span className="text-accent text-sm font-heading">{formatPrice(p.price_cents, p.currency, p.billing_interval)}</span>
                    {p.client_cap != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300">cap {p.client_cap}</span>}
                    {!p.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400">off</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                      {p.package_type === 'running' ? '🏃 Running' : p.package_type === 'personal_training' ? '💪 PT' : '🏃💪 Hybrid'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
                      {p.delivery_format === 'programming' ? '📱 Remote' : p.delivery_format === 'in_person' ? '📍 In-person' : '📱📍 Both'}
                    </span>
                  </div>
                  {p.description && <p className="text-gray-400 text-xs mt-1 truncate">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(p)} disabled={busyId === p.id} className="text-xs text-gray-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1 disabled:opacity-50">Edit</button>
                  <button onClick={() => toggleActive(p)} disabled={busyId === p.id} className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1 disabled:opacity-50">{p.is_active ? "Turn off" : "Turn on"}</button>
                  <button onClick={() => remove(p)} disabled={busyId === p.id} className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-400/40 rounded-lg px-2.5 py-1 disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
