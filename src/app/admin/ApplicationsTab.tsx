"use client";

import { useEffect, useState, useCallback } from "react";

// Coach-facing "Applications" inbox + public application-page settings.
// Shows prospects who applied through the coach's /join/<slug> link, lets the
// coach copy/edit that link + offer, and accept or decline each application.

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  age: number | null;
  sex: string | null;
  running_experience: string | null;
  primary_goal: string | null;
  target_race: string | null;
  days_available: string | null;
  current_prs: string | null;
  injuries: string | null;
  why_coaching: string | null;
  plan_interest: string | null;
  interested_types: string[] | null;
  interested_formats: string[] | null;
  pt_goal: string | null;
  training_experience: string | null;
  equipment_access: string | null;
  preferred_location: string | null;
  sessions_per_week: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  reviewed_at: string | null;
};

type Page = {
  slug: string;
  is_enabled: boolean;
  headline: string | null;
  intro: string | null;
  pricing: string | null;
  offer_types: string[] | null;
  offer_formats: string[] | null;
};

const TYPE_LABELS: Record<string, string> = { running: "Running coaching", personal_training: "Personal training" };
const FORMAT_LABELS: Record<string, string> = { programming: "Programming only (remote)", in_person: "In-person training" };

const SITE = typeof window !== "undefined" ? window.location.origin : "https://www.firstmilecoach.com";

// When a super admin is "viewing as" a coach, these are stored in sessionStorage
// (set by the admin page). Pass them through so the Applications APIs resolve the
// impersonated coach's data instead of the super admin's own.
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

export default function ApplicationsTab() {
  const [apps, setApps] = useState<Application[]>([]);
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "accepted" | "declined" | "all">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editable settings form state
  const [editSlug, setEditSlug] = useState("");
  const [editHeadline, setEditHeadline] = useState("");
  const [editIntro, setEditIntro] = useState("");
  const [editPricing, setEditPricing] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editTypes, setEditTypes] = useState<string[]>([]);
  const [editFormats, setEditFormats] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  const toggleEdit = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const [appsRes, pageRes] = await Promise.all([
        fetch(`/api/coach-applications${sq}`),
        fetch(`/api/application-page${sq}`),
      ]);
      const appsData = await appsRes.json().catch(() => ({}));
      const pageData = await pageRes.json().catch(() => ({}));
      if (appsRes.ok) setApps(appsData.applications || []);
      if (pageRes.ok && pageData.page) {
        setPage(pageData.page);
        setEditSlug(pageData.page.slug || "");
        setEditHeadline(pageData.page.headline || "");
        setEditIntro(pageData.page.intro || "");
        setEditPricing(pageData.page.pricing || "");
        setEditEnabled(!!pageData.page.is_enabled);
        setEditTypes(Array.isArray(pageData.page.offer_types) ? pageData.page.offer_types : []);
        setEditFormats(Array.isArray(pageData.page.offer_formats) ? pageData.page.offer_formats : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const link = page ? `${SITE}/join/${page.slug}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ text: "Couldn't copy — select and copy the link manually.", type: "error" });
    }
  }

  async function act(id: string, action: "accept" | "decline") {
    if (action === "decline" && !confirm("Decline this application? The applicant will not be notified and no account is created.")) return;
    setActingId(id);
    setMsg(null);
    try {
      const res = await fetch("/api/coach-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...scopeBody() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || "Action failed", type: "error" });
      } else {
        setMsg({
          text: action === "accept"
            ? (data.message || "Application accepted — client account created.")
            : "Application declined.",
          type: "success",
        });
        setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: data.status } : a)));
      }
    } catch {
      setMsg({ text: "Network error", type: "error" });
    } finally {
      setActingId(null);
    }
  }

  async function saveSettings() {
    if (editTypes.length === 0) {
      setMsg({ text: "Select at least one thing you offer (Running or Personal Training).", type: "error" });
      return;
    }
    if (editFormats.length === 0) {
      setMsg({ text: "Select at least one delivery format (Programming or In-person).", type: "error" });
      return;
    }
    setSavingSettings(true);
    setMsg(null);
    try {
      const res = await fetch("/api/application-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: editSlug,
          headline: editHeadline,
          intro: editIntro,
          pricing: editPricing,
          is_enabled: editEnabled,
          offer_types: editTypes,
          offer_formats: editFormats,
          ...scopeBody(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || "Could not save", type: "error" });
      } else {
        setPage(data.page);
        setEditSlug(data.page.slug);
        setMsg({ text: "Your application page was saved.", type: "success" });
        setShowSettings(false);
      }
    } catch {
      setMsg({ text: "Network error", type: "error" });
    } finally {
      setSavingSettings(false);
    }
  }

  const pendingCount = apps.filter((a) => a.status === "pending").length;
  const visible = apps.filter((a) => (filter === "all" ? true : a.status === filter));

  return (
    <div className="space-y-5">
      {/* ---- Link / offer header ---- */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-white font-heading uppercase tracking-wider text-sm">Your Application Link</h3>
            <p className="text-gray-400 text-xs mt-1">Share this on your socials, bio, or DMs. People who apply show up below for you to accept or decline.</p>
          </div>
          <button onClick={() => setShowSettings((s) => !s)} className="text-xs border border-white/10 text-gray-300 hover:text-white hover:border-white/20 px-3 py-1.5 rounded-lg">
            {showSettings ? "Close" : "Edit page & link"}
          </button>
        </div>

        {page && !page.is_enabled && (
          <p className="mt-3 text-xs text-amber-400">Your link is currently turned OFF — prospects can&apos;t apply. Turn it on under “Edit page &amp; link”.</p>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-[200px] bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-accent text-sm break-all">{link || "…"}</code>
          <button onClick={copyLink} disabled={!link} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
            {copied ? "Copied!" : "Copy link"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-white underline px-2">Preview</a>
          )}
        </div>

        {/* ---- Settings editor ---- */}
        {showSettings && (
          <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Link ending (letters, numbers, hyphens)</label>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-gray-500 text-sm">{SITE}/join/</span>
                <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="your-name" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">What do you offer? (shown as choices to applicants)</label>
              <div className="space-y-1.5">
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={editTypes.includes(val)} onChange={() => toggleEdit(editTypes, setEditTypes, val)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Delivery format(s) you offer</label>
              <div className="space-y-1.5">
                {Object.entries(FORMAT_LABELS).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={editFormats.includes(val)} onChange={() => toggleEdit(editFormats, setEditFormats, val)} />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Applicants pick from what you offer, and the form reveals the matching questions.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Headline</label>
              <input value={editHeadline} onChange={(e) => setEditHeadline(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50" placeholder="1-on-1 Marathon Coaching with …" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">About / what you offer</label>
              <textarea value={editIntro} onChange={(e) => setEditIntro(e.target.value)} rows={4} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50 resize-y" placeholder="Your coaching philosophy, what's included, your experience…" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Coaching plans &amp; pricing (free text)</label>
              <textarea value={editPricing} onChange={(e) => setEditPricing(e.target.value)} rows={4} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50 resize-y" placeholder={"Starter — $99/mo: weekly plan + check-ins\nFull Coaching — $199/mo: running + strength, 2x weekly calls"} />
              <p className="text-[11px] text-gray-500 mt-1">Shown to prospects so they know what you offer. No payment is collected yet — that comes in a later update.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />
              Link is live (prospects can apply)
            </label>
            <div className="flex gap-2">
              <button onClick={saveSettings} disabled={savingSettings} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg text-sm disabled:opacity-50">
                {savingSettings ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white text-sm px-3">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.type === "success" ? "bg-green-500/15 text-green-300 border border-green-500/20" : "bg-red-500/15 text-red-300 border border-red-500/20"}`}>
          {msg.text}
        </div>
      )}

      {/* ---- Filter bar ---- */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["pending", "accepted", "declined", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider ${filter === f ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
            {f}{f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {/* ---- Applications list ---- */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading applications…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">
            {filter === "pending" ? "No pending applications yet. Share your link to start getting them!" : `No ${filter} applications.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const open = expandedId === a.id;
            return (
              <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold">{a.full_name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="text-gray-400 text-xs mt-1 break-all">
                      {a.email}{a.phone ? ` · ${a.phone}` : ""}{a.age ? ` · Age ${a.age}` : ""}{a.sex ? ` · ${a.sex}` : ""}
                    </p>
                    {a.primary_goal && <p className="text-gray-300 text-sm mt-1">Goal: {a.primary_goal}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedId(open ? null : a.id)} className="text-xs border border-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg">
                      {open ? "Hide" : "View details"}
                    </button>
                    {a.status === "pending" && (
                      <>
                        <button onClick={() => act(a.id, "accept")} disabled={actingId === a.id} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">
                          {actingId === a.id ? "…" : "Accept"}
                        </button>
                        <button onClick={() => act(a.id, "decline")} disabled={actingId === a.id} className="border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Detail label="Interested in" value={(a.interested_types || []).map((t) => TYPE_LABELS[t] || t).join(", ")} />
                    <Detail label="Training format" value={(a.interested_formats || []).map((f) => FORMAT_LABELS[f] || f).join(", ")} />
                    <Detail label="Running experience / mileage" value={a.running_experience} />
                    <Detail label="Target race / date" value={a.target_race} />
                    <Detail label="PT goal" value={a.pt_goal ? a.pt_goal.replace(/_/g, " ") : null} />
                    <Detail label="Training experience" value={a.training_experience} />
                    <Detail label="Where / equipment" value={a.equipment_access} />
                    <Detail label="Preferred location" value={a.preferred_location} />
                    <Detail label="Sessions per week" value={a.sessions_per_week} />
                    <Detail label="Days available" value={a.days_available} />
                    <Detail label="Current PRs" value={a.current_prs} />
                    <Detail label="Injuries / limitations" value={a.injuries} />
                    <Detail label="Plan interested in" value={a.plan_interest} />
                    <div className="sm:col-span-2">
                      <Detail label="Why coaching?" value={a.why_coaching} />
                    </div>
                    <div className="sm:col-span-2 text-[11px] text-gray-500 pt-1">
                      Applied {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Application["status"] }) {
  const map = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    accepted: "bg-green-500/15 text-green-300 border-green-500/20",
    declined: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  } as const;
  return <span className={`text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-full ${map[status]}`}>{status}</span>;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-gray-500 text-[11px] uppercase tracking-wider">{label}</p>
      <p className="text-gray-200 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
