"use client";

import { useCallback, useEffect, useState } from "react";

// Coach-facing manager for their packages (the offerings they charge for).
// Each package defines what's included via checkboxes, which controls
// what questions applicants see when they select that package.

export type CoachPackage = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: "monthly" | "one_time";
  // What's included in this package (controls applicant questions)
  includes_running: boolean;
  includes_strength: boolean;
  includes_in_person: boolean;
  includes_programming: boolean;
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

// Generate a suggested name based on what's included
function suggestName(includes: { running: boolean; strength: boolean; in_person: boolean; programming: boolean }): string {
  const parts: string[] = [];
  if (includes.running && includes.strength) {
    parts.push("Run + Strength");
  } else if (includes.running) {
    parts.push("Running");
  } else if (includes.strength) {
    parts.push("Strength");
  }
  
  if (includes.in_person && includes.programming) {
    parts.push("Hybrid");
  } else if (includes.in_person) {
    parts.push("In-Person");
  } else if (includes.programming) {
    parts.push("Remote");
  }
  
  return parts.join(" - ") || "Coaching Package";
}

type DraftForm = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  billing_interval: "monthly" | "one_time";
  includes_running: boolean;
  includes_strength: boolean;
  includes_in_person: boolean;
  includes_programming: boolean;
  client_cap: string;
  is_active: boolean;
};

const EMPTY_FORM: DraftForm = {
  id: null,
  name: "",
  description: "",
  price: "",
  billing_interval: "monthly",
  includes_running: true,
  includes_strength: false,
  includes_in_person: false,
  includes_programming: true,
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
    console.log("startEdit called with:", p);
    const newForm: DraftForm = {
      id: p.id,
      name: p.name,
      description: p.description || "",
      price: (p.price_cents / 100).toString(),
      billing_interval: p.billing_interval,
      includes_running: p.includes_running ?? true,
      includes_strength: p.includes_strength ?? false,
      includes_in_person: p.includes_in_person ?? false,
      includes_programming: p.includes_programming ?? true,
      client_cap: p.client_cap != null ? String(p.client_cap) : "",
      is_active: p.is_active,
    };
    console.log("Setting form to:", newForm);
    setForm(newForm);
    setShowForm(true);
    setMsg(null);
  }

  // Auto-suggest name when checkboxes change (only if name is empty or was auto-generated)
  function handleIncludesChange(key: keyof DraftForm, value: boolean) {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      // Auto-suggest name if it's empty or matches a previous suggestion
      const oldSuggestion = suggestName({
        running: f.includes_running,
        strength: f.includes_strength,
        in_person: f.includes_in_person,
        programming: f.includes_programming,
      });
      if (!f.name || f.name === oldSuggestion) {
        updated.name = suggestName({
          running: key === "includes_running" ? value : f.includes_running,
          strength: key === "includes_strength" ? value : f.includes_strength,
          in_person: key === "includes_in_person" ? value : f.includes_in_person,
          programming: key === "includes_programming" ? value : f.includes_programming,
        });
      }
      return updated;
    });
  }

  async function save() {
    // Validate at least one type selected
    if (!form.includes_running && !form.includes_strength) {
      setMsg({ text: "Select at least Running or Strength.", type: "error" });
      return;
    }
    if (!form.includes_in_person && !form.includes_programming) {
      setMsg({ text: "Select at least In-person or Programming.", type: "error" });
      return;
    }
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
      includes_running: form.includes_running,
      includes_strength: form.includes_strength,
      includes_in_person: form.includes_in_person,
      includes_programming: form.includes_programming,
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

  // Build badge text for package includes
  function getIncludesBadges(p: CoachPackage) {
    const badges: { text: string; color: string }[] = [];
    if (p.includes_running) badges.push({ text: "🏃 Running", color: "bg-green-500/15 text-green-300" });
    if (p.includes_strength) badges.push({ text: "💪 Strength", color: "bg-purple-500/15 text-purple-300" });
    if (p.includes_in_person) badges.push({ text: "📍 In-person", color: "bg-blue-500/15 text-blue-300" });
    if (p.includes_programming) badges.push({ text: "📱 Remote", color: "bg-cyan-500/15 text-cyan-300" });
    return badges;
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white font-heading uppercase tracking-wider text-sm">Your Packages</h3>
          <p className="text-gray-400 text-xs mt-1">
            Define your coaching packages. What you include in each package controls what questions applicants see.
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
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {/* What's included checkboxes */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">What&apos;s included in this package?</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:border-white/20">
                <input
                  type="checkbox"
                  checked={form.includes_running}
                  onChange={(e) => handleIncludesChange("includes_running", e.target.checked)}
                  className="accent-accent"
                />
                <span>🏃 Running</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:border-white/20">
                <input
                  type="checkbox"
                  checked={form.includes_strength}
                  onChange={(e) => handleIncludesChange("includes_strength", e.target.checked)}
                  className="accent-accent"
                />
                <span>💪 Strength / PT</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:border-white/20">
                <input
                  type="checkbox"
                  checked={form.includes_programming}
                  onChange={(e) => handleIncludesChange("includes_programming", e.target.checked)}
                  className="accent-accent"
                />
                <span>📱 Programming (remote)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:border-white/20">
                <input
                  type="checkbox"
                  checked={form.includes_in_person}
                  onChange={(e) => handleIncludesChange("includes_in_person", e.target.checked)}
                  className="accent-accent"
                />
                <span>📍 In-person sessions</span>
              </label>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">These control which questions applicants see when they select this package</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Package name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. Run + Strength - Hybrid" />
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
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="accent-accent" />
            Active (shown to applicants)
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
          !showForm && <p className="text-gray-400 text-sm">No packages yet. Add your coaching packages to get started.</p>
        ) : (
          <div className="space-y-2">
            {packages.map((p) => (
              <div key={p.id} className={`border rounded-lg px-3 py-2.5 ${p.is_active ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-60"}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{p.name}</span>
                      <span className="text-accent text-sm font-heading">{formatPrice(p.price_cents, p.currency, p.billing_interval)}</span>
                      {p.client_cap != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300">cap {p.client_cap}</span>}
                      {!p.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400">off</span>}
                    </div>
                    {p.description && <p className="text-gray-400 text-xs mt-1 truncate">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(p)} disabled={busyId === p.id} className="text-xs text-gray-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1 disabled:opacity-50">Edit</button>
                    <button onClick={() => toggleActive(p)} disabled={busyId === p.id} className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1 disabled:opacity-50">{p.is_active ? "Turn off" : "Turn on"}</button>
                    <button onClick={() => remove(p)} disabled={busyId === p.id} className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-400/40 rounded-lg px-2.5 py-1 disabled:opacity-50">Delete</button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {getIncludesBadges(p).map((badge, i) => (
                    <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.color}`}>{badge.text}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
