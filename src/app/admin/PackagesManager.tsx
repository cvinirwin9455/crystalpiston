"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  recur_months: number | null;
};

// A program template, enriched with what we can derive from its content:
// total weeks (duration) and whether it contains running / strength work.
type ProgramTemplateOption = {
  id: string;
  name: string;
  totalWeeks: number | null;
  hasRunning: boolean;
  hasStrength: boolean;
};

// Inspect a program template's JSONB `data` to infer duration + type.
// Templates store weeks -> days -> workouts, each workout tagged with a `type`
// (run / walk / cross / cycling / strength / stretching / rest …).
function deriveTemplateMeta(data: any): { totalWeeks: number | null; hasRunning: boolean; hasStrength: boolean } {
  const totalWeeks = Number.isFinite(Number(data?.totalWeeks)) ? Number(data.totalWeeks) : null;
  let hasRunning = false;
  let hasStrength = false;
  const weeks = Array.isArray(data?.weeks) ? data.weeks : [];
  for (const wk of weeks) {
    for (const day of wk?.days || []) {
      for (const w of day?.workouts || []) {
        const t = String(w?.type || "").toLowerCase();
        const tt = String(w?.trainingType || "").toLowerCase();
        if (t === "run" || t === "walk" || tt.includes("run")) hasRunning = true;
        // "cross" / "cycling" / explicit strength/mobility all count as strength-side work.
        if (t === "cross" || t === "cycling" || t === "strength" || t === "stretching" || tt.includes("strength") || tt.includes("mobility")) {
          hasStrength = true;
        }
      }
    }
  }
  return { totalWeeks, hasRunning, hasStrength };
}

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
  // Recurring (monthly) packages: number of months to bill. "" = until cancelled.
  recur_months: string;
  // Whether the coach has manually overridden the auto-filled description.
  description_touched: boolean;
  // Whether the coach has manually overridden the auto-filled name.
  name_touched: boolean;
  // Progressive reveal: the coach picks Billing first; the rest of the form only
  // appears once a billing type has been chosen.
  billing_chosen: boolean;
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
  recur_months: "",
  description_touched: false,
  name_touched: false,
  billing_chosen: false,
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
//   one-time: "12-week program • 10 in-person sessions ($30/session)"
//   monthly:  "$125/month, recurring"  /  "$125/month for 3 months"
function autoDescription(f: DraftForm): string {
  // Recurring (monthly) membership: describe the billing cadence, not weeks.
  if (f.billing_interval === "monthly") {
    const monthly = num(f.programming_cost);
    if (monthly <= 0) return "";
    const months = num(f.recur_months);
    return months > 0
      ? `$${fmtMoney(monthly)}/month for ${months} month${months === 1 ? "" : "s"}`
      : `$${fmtMoney(monthly)}/month, recurring until cancelled`;
  }

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
  const formRef = useRef<HTMLDivElement | null>(null);

  // Scroll the add/edit form into view when it opens (so editing a package
  // further down the list doesn't look like it did nothing).
  useEffect(() => {
    if (showForm) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, [showForm]);

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
      setProgramTemplates(
        list.map((t: any) => {
          const meta = deriveTemplateMeta(t.data);
          return { id: t.id, name: t.name, ...meta };
        })
      );
    } catch {
      /* non-fatal — the picker just shows no options */
    }
  }, []);

  useEffect(() => { load(); loadProgramTemplates(); }, [load, loadProgramTemplates]);

  // The currently selected program template (one-time packages only).
  const selectedTemplate = programTemplates.find((t) => t.id === form.program_template_id) || null;
  // When a template is chosen on a one-time package, duration + type are LOCKED
  // to the template (so the package can't drift out of sync with the program).
  const templateLocked = form.billing_interval === "one_time" && !!selectedTemplate;

  // Pick / clear a program template. Selecting one auto-fills + locks duration
  // and the running/strength type, and defaults the name (unless the coach has
  // already typed their own).
  function handleSelectTemplate(templateId: string) {
    const tmpl = programTemplates.find((t) => t.id === templateId) || null;
    setForm((f) => {
      if (!tmpl) {
        // Cleared — unlock fields, keep whatever values were there.
        return { ...f, program_template_id: "" };
      }
      return {
        ...f,
        program_template_id: templateId,
        duration_weeks: tmpl.totalWeeks != null ? String(tmpl.totalWeeks) : f.duration_weeks,
        includes_running: tmpl.hasRunning,
        includes_strength: tmpl.hasStrength,
        // Template packages are programming (not in-person).
        includes_programming: true,
        includes_in_person: false,
        billing_mode: "programming_only",
        // Default the name to the template name unless the coach customised it.
        name: f.name_touched && f.name.trim() ? f.name : tmpl.name,
      };
    });
  }

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
    form.billing_interval,
    form.billing_mode,
    form.duration_weeks,
    form.session_count,
    form.session_cost_per,
    form.programming_cost,
    form.recur_months,
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
      // Programming cost drives the computed total. OLD packages predate this
      // field (null) but have a real price_cents — fall back to the package
      // price so editing doesn't wipe the price to $0. (Only for
      // programming_only, where price == programming cost.)
      programming_cost:
        p.programming_cost != null
          ? String(p.programming_cost)
          : ((p.billing_mode || "programming_only") === "programming_only" && p.price_cents > 0
              ? String(p.price_cents / 100)
              : ""),
      recur_months: p.recur_months != null ? String(p.recur_months) : "",
      // Existing packages keep their saved description/name — don't auto-overwrite.
      description_touched: !!(p.description && p.description.trim()),
      name_touched: !!(p.name && p.name.trim()),
      // Editing an existing package: billing is already set, show the full form.
      billing_chosen: true,
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
    // A one-time programming package needs a program length so the client's plan
    // spans the right period (and the create-week flow works). Recurring is
    // open-ended (no fixed weeks); per_session has no program span.
    if (
      form.billing_interval === "one_time" &&
      form.billing_mode !== "per_session" &&
      !(parseInt(form.duration_weeks.replace(/[^0-9]/g, ""), 10) > 0)
    ) {
      setMsg({ text: "Enter the program length (weeks) — or pick a program template that sets it.", type: "error" });
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
      // Recurring duration: only meaningful for monthly packages; "" = forever.
      recur_months: form.billing_interval === "monthly" ? (form.recur_months.trim() || null) : null,
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

  // The add/edit form. Rendered at the top when ADDING, or inline beneath the
  // package being edited (so editing a package lower in the list expands in place).
  const renderForm = () => (
    <div ref={formRef} className="mt-4 space-y-4 border-t border-white/10 pt-4 scroll-mt-4">
      <p className="text-accent text-xs font-heading uppercase tracking-wider">
        {form.id ? `Editing: ${form.name || "package"}` : "New package"}
      </p>
      {/* STEP 1 — Billing is the first choice; it shapes the whole form. */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">How do you want to bill this package?</label>
        <select
          value={form.billing_chosen ? form.billing_interval : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") { setForm((f) => ({ ...f, billing_chosen: false })); return; }
            const interval = v as "monthly" | "one_time";
            setForm((f) =>
              interval === "monthly"
                ? {
                    ...f,
                    billing_chosen: true,
                    billing_interval: interval,
                    program_template_id: "",
                    billing_mode: "programming_only",
                    duration_weeks: "",
                    includes_in_person: false,
                    includes_programming: true,
                    session_count: "",
                    session_cost_per: "",
                  }
                : { ...f, billing_chosen: true, billing_interval: interval, recur_months: "" }
            );
          }}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
        >
          <option value="">— Choose billing to begin —</option>
          <option value="monthly">Recurring (monthly) — ongoing membership</option>
          <option value="one_time">One-time charge — a fixed program</option>
        </select>
      </div>

      {form.billing_chosen && (<>

      {form.billing_interval === "one_time" && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Start from a program template (optional)</label>
          <select
            value={form.program_template_id}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
          >
            <option value="">— None (enter details manually) —</option>
            {programTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.totalWeeks ? ` (${t.totalWeeks} wks)` : ""}
              </option>
            ))}
          </select>
          {templateLocked && (
            <p className="text-[11px] text-cyan-300/80 mt-1">
              📋 This program sets the type, delivery and duration below. It&apos;ll be flagged on the client&apos;s plan to load once they&apos;re set up.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-400 mb-2">
          What type of coaching? (select at least one)
          {templateLocked && <span className="text-cyan-300/70 ml-1">— set by the program template</span>}
        </label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className={`flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 ${templateLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-white/20"}`}>
            <input type="checkbox" checked={form.includes_running} disabled={templateLocked} onChange={(e) => handleIncludesChange("includes_running", e.target.checked)} className="accent-accent" />
            <span>🏃 Running</span>
          </label>
          <label className={`flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 ${templateLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-white/20"}`}>
            <input type="checkbox" checked={form.includes_strength} disabled={templateLocked} onChange={(e) => handleIncludesChange("includes_strength", e.target.checked)} className="accent-accent" />
            <span>💪 Strength / PT</span>
          </label>
        </div>

        <label className="block text-xs text-gray-400 mb-2">
          How is it delivered? (select at least one)
          {templateLocked && <span className="text-cyan-300/70 ml-1">— set by the program template</span>}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={`flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 ${templateLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-white/20"}`}>
            <input type="checkbox" checked={form.includes_programming} disabled={templateLocked} onChange={(e) => handleIncludesChange("includes_programming", e.target.checked)} className="accent-accent" />
            <span>📱 Programming (remote)</span>
          </label>
          <label className={`flex items-center gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 ${templateLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-white/20"}`}>
            <input type="checkbox" checked={form.includes_in_person} disabled={templateLocked} onChange={(e) => handleIncludesChange("includes_in_person", e.target.checked)} className="accent-accent" />
            <span>📍 In-person sessions</span>
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Package name</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, name_touched: true }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. Run + Strength - Hybrid" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            {form.billing_interval === "monthly" ? "Price / month" : "Total price"}
          </label>
          <div className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
            <span className="font-heading">${form.price || "0"}{form.billing_interval === "monthly" ? "/mo" : ""}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">auto</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {form.billing_interval === "monthly" ? "The monthly billing amount below." : "Sum of programming + in-person below."}
          </p>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description (auto-filled — you can edit)</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value, description_touched: true }))} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50 resize-y" placeholder="What's included…" />
        {form.description_touched && (
          <button type="button" onClick={() => setForm((f) => ({ ...f, description_touched: false, description: autoDescription(f) }))} className="text-[10px] text-cyan-300/80 hover:text-cyan-200 mt-1">
            ↻ Reset to auto description
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {form.billing_interval === "monthly" ? (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bill for how many months?</label>
            <input value={form.recur_months} onChange={(e) => setForm((f) => ({ ...f, recur_months: e.target.value.replace(/[^0-9]/g, "") }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="blank = until cancelled" inputMode="numeric" />
            <p className="text-[10px] text-gray-500 mt-1">Leave blank to bill every month until you (or the client) cancel.</p>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Client cap (optional)</label>
            <input value={form.client_cap} onChange={(e) => setForm((f) => ({ ...f, client_cap: e.target.value.replace(/[^0-9]/g, "") }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="e.g. 5 (leave blank = unlimited)" inputMode="numeric" />
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-4">
        <label className="block text-xs text-gray-400 mb-1">Plan details</label>
        <p className="text-[11px] text-gray-500 mb-3">
          When a client is accepted (or pays), these create their plan on the Account page — just like a plan you set up by hand.
        </p>

        {form.billing_interval === "one_time" && !templateLocked && (
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">Billing mode</label>
            <select value={form.billing_mode} onChange={(e) => setForm((f) => ({ ...f, billing_mode: e.target.value as DraftForm["billing_mode"] }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50">
              <option value="programming_only">Programming only</option>
              <option value="per_session">Per session (in-person)</option>
              <option value="hybrid">Hybrid (programming + sessions)</option>
            </select>
          </div>
        )}

        {form.billing_mode !== "per_session" && (
          <div className="grid sm:grid-cols-2 gap-3 mt-1">
            {form.billing_interval === "one_time" && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Program duration (weeks)</label>
                <input value={form.duration_weeks} onChange={(e) => setForm((f) => ({ ...f, duration_weeks: e.target.value.replace(/[^0-9]/g, "") }))} disabled={templateLocked} className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50 ${templateLocked ? "opacity-60 cursor-not-allowed" : ""}`} placeholder="e.g. 12" inputMode="numeric" />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {form.billing_interval === "monthly" ? "Monthly cost" : "Programming cost"}
              </label>
              <input value={form.programming_cost} onChange={(e) => setForm((f) => ({ ...f, programming_cost: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder={form.billing_interval === "monthly" ? "e.g. 125" : "e.g. 200"} inputMode="decimal" />
            </div>
          </div>
        )}

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

      </>)}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !form.billing_chosen} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg text-sm disabled:opacity-50">
          {saving ? "Saving…" : form.id ? "Save changes" : "Add package"}
        </button>
        <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="text-gray-400 hover:text-white text-sm px-3">Cancel</button>
      </div>
    </div>
  );

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

      {/* Add form — only when ADDING (editing renders inline under the package below). */}
      {showForm && !form.id && renderForm()}

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

                {/* Inline edit form — expands directly under the package being edited. */}
                {showForm && form.id === p.id && renderForm()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
