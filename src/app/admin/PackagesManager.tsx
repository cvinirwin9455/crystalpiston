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
  // Plan-recipe fields — a package stamps out a client plan on acceptance.
  program_template_id: string | null;
  billing_mode: "programming_only" | "per_session" | "hybrid";
  duration_weeks: number | null;
  session_count: number | null;
  session_cost: number | null;
  programming_cost: number | null;
};

type ProgramTemplateOption = { id: string; name: string };

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
  // Plan-recipe fields
  program_template_id: string;
  billing_mode: "programming_only" | "per_session" | "hybrid";
  duration_weeks: string;
  session_count: string;
  // Coach enters COST PER SESSION; we store the computed total (count × per)
  // as session_cost in the payload (Option A — no schema change).
  session_cost_per: string;
  programming_cost: string;
  // Whether the coach has manually overridden the auto-filled description.
  description_touched: boolean;
};

const EMPTY_FORM: DraftForm = {
  id: null,
  name: "",
  description: "",
  price: "",
  billing_interval: "monthly",
  includes_running: false,
  includes_strength: false,
  includes_in_person: false,
  includes_programming: false,
  client_cap: "",
  is_active: true,
  program_template_id: "",
  billing_mode: "programming_only",
  duration_weeks: "",
  session_count: "",
  session_cost_per: "",
  programming_cost: "",
  description_touched: false,
};

// --- Auto-calculation helpers (Option A: top price = sum of the parts) ---

function num(v: string): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Total value of the in-person component = # sessions × cost per session.
function sessionsTotal(f: DraftForm): number {
  if (f.billing_mode !== "per_session" && f.billing_mode !== "hybrid") return 0;
  return num(f.session_count) * num(f.session_cost_per);
}

// Programming component of the package.
function programmingTotal(f: DraftForm): number {
  if (f.billing_mode === "per_session") return 0;
  return num(f.programming_cost);
}

// Top price = programming + in-person total (the whole-package total).
function packageTotal(f: DraftForm): number {
  return programmingTotal(f) + sessionsTotal(f);
}

// Format a number as a plain price string for the read-only Price field.
function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

// Build the auto description from the current selections, e.g.:
//   "12-week program • 10 in-person sessions ($30/session)"
function autoDescription(f: DraftForm): string {
  const parts: string[] = [];
  const weeks = num(f.duration_weeks);
  if (f.billing_mode !== "per_session" && weeks > 0) {
    parts.push(`${weeks}-week program`);
  }
  const count = num(f.session_count);
  const per = num(f.session_cost_per);
  if ((f.billing_mode === "per_session" || f.billing_mode === "hybrid") && count > 0) {
    const perStr = per > 0 ? ` ($${fmtMoney(per)}/session)` : "";
    parts.push(`${count} in-person session${count === 1 ? "" : "s"}${perStr}`);
  }
  return parts.join(" • ");
}

// Suggest a billing mode from the "what's included" checkboxes:
//   in-person only           -> per_session
//   in-person + programming  -> hybrid
//   otherwise                -> programming_only
function billingModeFromIncludes(inc: { in_person: boolean; programming: boolean }): DraftForm["billing_mode"] {
  if (inc.in_person && inc.programming) return "hybrid";
  if (inc.in_person) return "per_session";
  return "programming_only";
}

export default function PackagesManager() {
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [programTemplates, setProgramTemplates] = useState<ProgramTemplateOption[]>([]);
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

  const loadProgramTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/program-templates`);
      const data = await res.json().catch(() => ({}));
      // The route returns an array (or {templates}); handle both shapes.
      const list = Array.isArray(data) ? data : data.templates || [];
      setProgramTemplates(list.map((t: any) => ({ id: t.id, name: t.name })));
    } catch {
      /* non-fatal — the picker just shows no options */
    }
  }, []);

  useEffect(() => { load(); loadProgramTemplates(); }, [load, loadProgramTemplates]);

  // Keep the top Price (read-only) and the auto description in sync with the
  // plan-detail selections. Price is always the computed total; the
  // description auto-fills unless the coach has edited it themselves.
  useEffect(() => {
    if (!showForm) return;
    setForm((f) => {
      const computedPrice = fmtMoney(packageTotal(f));
      const auto = autoDescription(f);
      const nextDescription = f.description_touched ? f.description : auto;
      if (f.price === computedPrice && f.description === nextDescription) return f;
      return { ...f, price: computedPrice, description: nextDescription };
    });
  }, [
    showForm,
    form.billing_mode,
    form.duration_weeks,
    form.session_count,
    form.session_cost_per,
    form.programming_cost,
    form.description_touched,
  ]);

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
      program_template_id: p.program_template_id || "",
      billing_mode: p.billing_mode || "programming_only",
      duration_weeks: p.duration_weeks != null ? String(p.duration_weeks) : "",
      session_count: p.session_count != null ? String(p.session_count) : "",
      // Stored session_cost is the TOTAL; derive cost-per-session for the form.
      session_cost_per:
        p.session_cost != null && p.session_count && p.session_count > 0
          ? String(Math.round((Number(p.session_cost) / p.session_count) * 100) / 100)
          : "",
      programming_cost: p.programming_cost != null ? String(p.programming_cost) : "",
      // Existing packages keep their saved description — don't auto-overwrite it.
      description_touched: !!(p.description && p.description.trim()),
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
      const nextIncludes = {
        running: key === "includes_running" ? value : f.includes_running,
        strength: key === "includes_strength" ? value : f.includes_strength,
        in_person: key === "includes_in_person" ? value : f.includes_in_person,
        programming: key === "includes_programming" ? value : f.includes_programming,
      };
      if (!f.name || f.name === oldSuggestion) {
        updated.name = suggestName(nextIncludes);
      }
      // Auto-suggest billing mode from the delivery checkboxes (only if the
      // coach hasn't diverged from what the previous checkboxes implied).
      const oldModeSuggestion = billingModeFromIncludes({ in_person: f.includes_in_person, programming: f.includes_programming });
      if (f.billing_mode === oldModeSuggestion) {
        updated.billing_mode = billingModeFromIncludes({ in_person: nextIncludes.in_person, programming: nextIncludes.programming });
      }
      return updated;
    });
  }

  async function save() {
    // Validate at least one from each group
    if (!form.includes_running && !form.includes_strength) {
      setMsg({ text: "Select at least Running or Strength/PT.", type: "error" });
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
    if (packageTotal(form) <= 0) {
      setMsg({
        text: form.billing_mode === "per_session"
          ? "Enter the number of sessions and cost per session."
          : "Enter a programming cost (and session details for hybrid).",
        type: "error",
      });
      return;
    }
    setSaving(true);
    setMsg(null);
    const capNum = form.client_cap.trim() ? parseInt(form.client_cap, 10) : null;
    // Option A: store the COMPUTED totals (the form captures per-session + the
    // parts; the price and session_cost sent to the API are the sums).
    const computedTotal = packageTotal(form);
    const computedSessionTotal = sessionsTotal(form);
    const payload: Record<string, any> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: String(computedTotal),
      billing_interval: form.billing_interval,
      includes_running: form.includes_running,
      includes_strength: form.includes_strength,
      includes_in_person: form.includes_in_person,
      includes_programming: form.includes_programming,
      client_cap: capNum && capNum > 0 ? capNum : null,
      is_active: form.is_active,
      // Plan-recipe fields
      program_template_id: form.program_template_id || null,
      billing_mode: form.billing_mode,
      duration_weeks: form.duration_weeks.trim() || null,
      session_count: form.session_count.trim() || null,
      // Stored as the TOTAL (count × per-session).
      session_cost: computedSessionTotal > 0 ? String(computedSessionTotal) : null,
      programming_cost: form.programming_cost.trim() || null,
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
          {/* What's included checkboxes - two groups */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">What type of coaching? (select at least one)</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
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
            </div>
            
            <label className="block text-xs text-gray-400 mb-2">How is it delivered? (select at least one)</label>
            <div className="grid grid-cols-2 gap-2">
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
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Package name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. Run + Strength - Hybrid" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Total price</label>
              <div className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
                <span className="font-heading">${form.price || "0"}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">auto</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Sum of programming + in-person below.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description (auto-filled — you can edit)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value, description_touched: true }))}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50 resize-y"
              placeholder="What's included…"
            />
            {form.description_touched && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, description_touched: false, description: autoDescription(f) }))}
                className="text-[10px] text-cyan-300/80 hover:text-cyan-200 mt-1"
              >
                ↻ Reset to auto description
              </button>
            )}
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

          {/* ---- Plan details: a package stamps out a client plan on acceptance ---- */}
          <div className="border-t border-white/10 pt-4">
            <label className="block text-xs text-gray-400 mb-1">Plan details</label>
            <p className="text-[11px] text-gray-500 mb-3">
              When a client is accepted (or pays), these create their plan on the Account page — just like a plan you set up by hand.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Program template (optional)</label>
                <select
                  value={form.program_template_id}
                  onChange={(e) => setForm((f) => ({ ...f, program_template_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                >
                  <option value="">— None —</option>
                  {programTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Billing mode</label>
                <select
                  value={form.billing_mode}
                  onChange={(e) => setForm((f) => ({ ...f, billing_mode: e.target.value as DraftForm["billing_mode"] }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                >
                  <option value="programming_only">Programming only</option>
                  <option value="per_session">Per session (in-person)</option>
                  <option value="hybrid">Hybrid (programming + sessions)</option>
                </select>
              </div>
            </div>

            {form.program_template_id && (
              <p className="text-[11px] text-cyan-300/80 mt-2">
                📋 This program will be flagged on the client&apos;s plan for you to load once they&apos;re set up.
              </p>
            )}

            {/* Programming component (programming_only + hybrid) */}
            {form.billing_mode !== "per_session" && (
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Program duration (weeks)</label>
                  <input value={form.duration_weeks} onChange={(e) => setForm((f) => ({ ...f, duration_weeks: e.target.value.replace(/[^0-9]/g, "") }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. 12" inputMode="numeric" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Programming cost</label>
                  <input value={form.programming_cost} onChange={(e) => setForm((f) => ({ ...f, programming_cost: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. 200" inputMode="decimal" />
                </div>
              </div>
            )}

            {/* In-person component (per_session + hybrid): # sessions × cost per session */}
            {(form.billing_mode === "per_session" || form.billing_mode === "hybrid") && (
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1"># In-person sessions</label>
                  <input value={form.session_count} onChange={(e) => setForm((f) => ({ ...f, session_count: e.target.value.replace(/[^0-9]/g, "") }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. 10" inputMode="numeric" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cost per session</label>
                  <input value={form.session_cost_per} onChange={(e) => setForm((f) => ({ ...f, session_cost_per: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. 30" inputMode="decimal" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">In-person total</label>
                  <div className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
                    <span className="font-heading">${fmtMoney(sessionsTotal(form))}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">auto</span>
                  </div>
                </div>
              </div>
            )}
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
