"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import SuperAdminFeedbackTab from "./FeedbackTab";
import InboxTab from "./InboxTab";
import Changelog from "@/app/admin/Changelog";

const CRYSTAL_ORG_ID = 'fffa6f6b-8226-40d9-9e49-ff17164334f4';
const LEGACY_FIRSTMILE_ORG_ID = '1eb9b481-b6b6-455c-b733-fee789803a17';

type Organization = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  totalUsers: number;
  admins: number;
  clients: number;
  activeClients: number;
  accountCoachId: string | null;
};

type BetaSignup = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  coaching_type: string;
  expected_clients: number;
  agreed_to_terms: boolean;
  signed_up_at: string;
  created_at: string;
  activated: boolean;
  activatedUserId: string | null;
  activatedAt: string | null;
  hasSetPassword: boolean;
};

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [betaSignups, setBetaSignups] = useState<BetaSignup[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "beta" | "feedback" | "inbox" | "admins" | "changelog" | "tools">("overview");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "activated" | "pending">("all");
  const [superAdmins, setSuperAdmins] = useState<{ id: string; email: string; name: string }[]>([]);
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState("");
  const [addingSuperAdmin, setAddingSuperAdmin] = useState(false);
  const [removingSuperAdminId, setRemovingSuperAdminId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin");
      if (res.status === 403) {
        router.push("/admin");
        return;
      }
      if (!res.ok) {
        setError("Failed to load super admin data");
        return;
      }
      const data = await res.json();
      setOrganizations(data.organizations || []);
      setBetaSignups(data.betaSignups || []);
      setSuperAdmins(data.superAdmins || []);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function activateCoach(signupId: string) {
    setActionMessage(null);
    try {
      const res = await fetch("/api/super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate_coach", signupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || "Failed to activate", type: "error" });
      } else {
        setActionMessage({ text: data.message, type: "success" });
        setActivatingId(null);
        fetchData();
      }
    } catch {
      setActionMessage({ text: "Network error", type: "error" });
    }
  }

  async function resendInvite(signupId: string) {
    setActionMessage(null);
    setResendingId(signupId);
    try {
      const res = await fetch("/api/super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend_invite", signupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || "Failed to resend", type: "error" });
      } else {
        setActionMessage({ text: data.message, type: "success" });
        fetchData();
      }
    } catch {
      setActionMessage({ text: "Network error", type: "error" });
    } finally {
      setResendingId(null);
    }
  }

  async function deleteAccount(signupId: string) {
    setActionMessage(null);
    try {
      const res = await fetch("/api/super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_account", signupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || "Failed to delete", type: "error" });
      } else {
        setActionMessage({ text: data.message, type: "success" });
        setDeletingId(null);
        fetchData();
      }
    } catch {
      setActionMessage({ text: "Network error", type: "error" });
    }
  }

  async function viewAsCoach(userId: string) {
    setImpersonatingId(userId);
    try {
      const res = await fetch("/api/super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "impersonate", userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || "Failed to impersonate", type: "error" });
      } else {
        window.open(data.url, "_blank");
      }
    } catch {
      setActionMessage({ text: "Network error", type: "error" });
    } finally {
      setImpersonatingId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Filter out the legacy shared First Mile org
  const coachOrgs = organizations.filter(o => o.id !== LEGACY_FIRSTMILE_ORG_ID);

  // Aggregate metrics across ALL coach orgs (including Crystal)
  const totalCoaches = coachOrgs.reduce((sum, o) => sum + o.admins, 0);
  const totalClients = coachOrgs.reduce((sum, o) => sum + o.clients, 0);
  const totalActiveClients = coachOrgs.reduce((sum, o) => sum + o.activeClients, 0);
  const betaSpotsLeft = 50 - betaSignups.length;
  const coachesActive = betaSignups.filter(s => s.hasSetPassword).length;
  const avgClientsPerCoach = coachesActive > 0 ? (totalClients / coachesActive).toFixed(1) : "0";

  const filteredSignups = betaSignups.filter((s) => {
    if (filterStatus === "activated") return s.activated;
    if (filterStatus === "pending") return !s.activated;
    return true;
  });

  const activatedCount = betaSignups.filter((s) => s.activated).length;
  const pendingCount = betaSignups.filter((s) => !s.activated).length;
  const completedCount = betaSignups.filter((s) => s.hasSetPassword).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading super admin...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Super Admin</h1>
            <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded-full uppercase tracking-wide">
              First Mile Coach
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 transition">
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-6 border-t border-gray-100 pt-2">
            {[
              { key: "overview", label: "Coaches" },
              { key: "beta", label: `Beta Signups (${betaSignups.length})` },
              { key: "inbox", label: "Inbox" },
              { key: "feedback", label: "Feedback & Bugs" },
              { key: "changelog", label: "Changelog" },
              { key: "tools", label: "Tools" },
              { key: "admins", label: "Super Admins" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.key
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Aggregate Dashboard */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Platform Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center p-3 rounded-xl bg-purple-50 border border-purple-100">
                  <div className="text-2xl font-bold text-purple-700">{totalCoaches}</div>
                  <div className="text-xs text-purple-600 font-medium mt-1">Total Coaches</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="text-2xl font-bold text-blue-700">{totalClients}</div>
                  <div className="text-xs text-blue-600 font-medium mt-1">Total Clients</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                  <div className="text-2xl font-bold text-green-700">{totalActiveClients}</div>
                  <div className="text-xs text-green-600 font-medium mt-1">Active Clients</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-orange-50 border border-orange-100">
                  <div className="text-2xl font-bold text-orange-700">{betaSpotsLeft}</div>
                  <div className="text-xs text-orange-600 font-medium mt-1">Beta Spots Left</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-2xl font-bold text-emerald-700">{coachesActive}</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">Coaches Active</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <div className="text-2xl font-bold text-indigo-700">{avgClientsPerCoach}</div>
                  <div className="text-xs text-indigo-600 font-medium mt-1">Avg Clients/Coach</div>
                </div>
              </div>
            </div>

            {/* All Coaches */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">First Mile Coaches ({coachOrgs.length})</h3>
              {coachOrgs.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <p className="text-gray-500">No coaches activated yet. Go to Beta Signups to activate coaches.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {coachOrgs.map((org) => (
                    <div key={org.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-900 text-sm">{org.name}</h4>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="text-center flex-1">
                          <div className="text-lg font-bold text-gray-900">{org.admins}</div>
                          <div className="text-[10px] text-gray-500">Coaches</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-lg font-bold text-gray-900">{org.activeClients}</div>
                          <div className="text-[10px] text-gray-500">Active Clients</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-lg font-bold text-gray-900">{org.clients}</div>
                          <div className="text-[10px] text-gray-500">Total Clients</div>
                        </div>
                      </div>
                      {org.accountCoachId && (
                        <button
                          onClick={() => viewAsCoach(org.accountCoachId!)}
                          disabled={impersonatingId === org.accountCoachId}
                          className="w-full text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition font-medium disabled:opacity-50"
                        >
                          {impersonatingId === org.accountCoachId ? "Opening..." : "View as Coach \u2192"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "beta" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Beta Signups</h2>
              <span className="text-sm text-gray-500">{betaSignups.length} / 50 spots</span>
            </div>

            {/* Status summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{betaSignups.length}</div>
                <div className="text-xs text-gray-500">Total Signups</div>
              </div>
              <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              <div className="bg-white rounded-xl border border-blue-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{activatedCount - completedCount}</div>
                <div className="text-xs text-gray-500">Invited (awaiting)</div>
              </div>
              <div className="bg-white rounded-xl border border-green-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                <div className="text-xs text-gray-500">Completed Setup</div>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2">
              {[
                { key: "all", label: "All" },
                { key: "activated", label: "Activated" },
                { key: "pending", label: "Pending" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key as any)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                    filterStatus === f.key
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {actionMessage && (
              <div className={`p-4 rounded-lg text-sm ${
                actionMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {actionMessage.text}
              </div>
            )}

            {filteredSignups.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">
                  {filterStatus === "all" ? "No beta signups yet." : `No ${filterStatus} signups.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSignups.map((signup) => (
                  <div
                    key={signup.id}
                    className={`bg-white rounded-xl border p-6 shadow-sm transition ${
                      signup.hasSetPassword
                        ? "border-gray-100 opacity-60"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold ${signup.hasSetPassword ? "text-gray-500" : "text-gray-900"}`}>
                            {signup.full_name}
                          </h3>
                          {signup.hasSetPassword ? (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                              Completed
                            </span>
                          ) : signup.activated ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              Invited
                            </span>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${signup.hasSetPassword ? "text-gray-400" : "text-gray-500"}`}>
                          {signup.email}
                        </p>
                        <div className="flex gap-3 mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${signup.hasSetPassword ? "bg-gray-50 text-gray-400" : "bg-blue-50 text-blue-700"}`}>
                            {signup.coaching_type.replace(/_/g, " ")}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${signup.hasSetPassword ? "bg-gray-50 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
                            {signup.expected_clients} expected clients
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Signed up: {new Date(signup.signed_up_at).toLocaleDateString()}
                          {signup.activatedAt && (
                            <> &bull; Activated: {new Date(signup.activatedAt).toLocaleDateString()}</>
                          )}
                          {signup.hasSetPassword && (
                            <> &bull; <span className="text-green-500">Password set</span></>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {signup.hasSetPassword && signup.activatedUserId && (
                          <button
                            onClick={() => viewAsCoach(signup.activatedUserId!)}
                            disabled={impersonatingId === signup.activatedUserId}
                            className="text-sm bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-100 transition font-medium disabled:opacity-50"
                          >
                            {impersonatingId === signup.activatedUserId ? "Opening..." : "View as Coach"}
                          </button>
                        )}

                        {!signup.activated && (
                          <>
                            {activatingId === signup.id ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => activateCoach(signup.id)}
                                  className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
                                >
                                  Confirm &amp; Send Invite
                                </button>
                                <button
                                  onClick={() => setActivatingId(null)}
                                  className="text-sm text-gray-500 px-3 py-2 hover:text-gray-800 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setActivatingId(signup.id)}
                                className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium"
                              >
                                Activate Coach
                              </button>
                            )}
                          </>
                        )}

                        {signup.activated && !signup.hasSetPassword && (
                          <button
                            onClick={() => resendInvite(signup.id)}
                            disabled={resendingId === signup.id}
                            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                          >
                            {resendingId === signup.id ? "Sending..." : "Resend Invite"}
                          </button>
                        )}

                        {deletingId === signup.id ? (
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => deleteAccount(signup.id)}
                              className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
                            >
                              Confirm Delete
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-sm text-gray-500 px-3 py-2 hover:text-gray-800 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(signup.id)}
                            className="text-xs text-red-500 hover:text-red-700 transition mt-1"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "inbox" && (
          <InboxTab />
        )}

        {activeTab === "feedback" && (
          <SuperAdminFeedbackTab />
        )}

        {activeTab === "changelog" && (
          <div className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-6">
            <Changelog />
          </div>
        )}

        {/* Tools & Services Tab */}
        {activeTab === "tools" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Tools & Services</h2>
              <p className="text-sm text-gray-500">Quick access to all the platforms that power First Mile Coach. Each super admin needs their own account on these services.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* GitHub */}
              <a href="https://github.com/cvinirwin9455/crystalpiston" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">GitHub</h3>
                    <p className="text-xs text-gray-500">Source code & version control</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">View code, pull requests, issues, and deployment history.</p>
              </a>

              {/* Vercel */}
              <a href="https://vercel.com/cvinirwin9455s-projects/crystalpiston" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L24 22H0L12 1z"/></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">Vercel</h3>
                    <p className="text-xs text-gray-500">Hosting & deployments</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Manage deployments, domains, environment variables, and build logs.</p>
              </a>

              {/* Supabase */}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"/></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">Supabase</h3>
                    <p className="text-xs text-gray-500">Database & auth</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Database tables, SQL editor, authentication users, and storage.</p>
              </a>

              {/* Resend */}
              <a href="https://resend.com/overview" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">Resend</h3>
                    <p className="text-xs text-gray-500">Transactional email</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Email delivery logs, domains, API keys, and sending analytics.</p>
              </a>

              {/* Kiro */}
              <a href="https://kiro.dev" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">Kiro</h3>
                    <p className="text-xs text-gray-500">AI development assistant</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">AI-powered coding, feature development, bug fixes, and platform updates.</p>
              </a>

              {/* Spaceship */}
              <a href="https://www.spaceship.com" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-900 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">Spaceship</h3>
                    <p className="text-xs text-gray-500">Domain registrar</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Domain registration, DNS settings, and domain renewals for firstmilecoach.com.</p>
              </a>

              {/* First Mile Coach (Live Site) */}
              <a href="https://www.firstmilecoach.com" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">Live Site</h3>
                    <p className="text-xs text-gray-500">firstmilecoach.com</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">The production website that coaches and clients use.</p>
              </a>
            </div>

            {/* Access Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-bold text-yellow-800 mb-1">Access Note</h4>
                  <p className="text-xs text-yellow-700 leading-relaxed">
                    Each super admin needs their own account on these services. Ask the account owner to invite you as a team member on each platform. 
                    Being a super admin on First Mile Coach does not automatically grant access to these external services.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Super Admins Tab */}
        {activeTab === "admins" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Manage Super Admins</h2>
              <p className="text-sm text-gray-500 mb-6">Super admins have full access to this panel, all organizations, and can manage other super admins.</p>

              {/* Current Super Admins */}
              <div className="space-y-3 mb-6">
                {superAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{admin.name || admin.email}</p>
                      <p className="text-xs text-gray-500">{admin.email}</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove super admin access for ${admin.email}? They will still be a coach but won't be able to access this panel.`)) return;
                        setRemovingSuperAdminId(admin.id);
                        setActionMessage(null);
                        try {
                          const res = await fetch("/api/super-admin", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "remove_super_admin", userId: admin.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            setActionMessage({ text: data.error || "Failed to remove", type: "error" });
                          } else {
                            setActionMessage({ text: `Removed super admin access for ${admin.email}`, type: "success" });
                            setSuperAdmins(prev => prev.filter(a => a.id !== admin.id));
                          }
                        } catch {
                          setActionMessage({ text: "Network error", type: "error" });
                        } finally {
                          setRemovingSuperAdminId(null);
                        }
                      }}
                      disabled={removingSuperAdminId === admin.id}
                      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {removingSuperAdminId === admin.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ))}
                {superAdmins.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No super admins found.</p>
                )}
              </div>

              {/* Add New Super Admin */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Add Super Admin</h3>
                <p className="text-xs text-gray-500 mb-3">Enter the email of an existing user (coach or admin) to grant them super admin access.</p>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={newSuperAdminEmail}
                    onChange={(e) => setNewSuperAdminEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    onClick={async () => {
                      if (!newSuperAdminEmail.trim()) return;
                      setAddingSuperAdmin(true);
                      setActionMessage(null);
                      try {
                        const res = await fetch("/api/super-admin", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "add_super_admin", email: newSuperAdminEmail.trim() }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setActionMessage({ text: data.error || "Failed to add", type: "error" });
                        } else {
                          setActionMessage({ text: `Added ${newSuperAdminEmail} as super admin`, type: "success" });
                          setNewSuperAdminEmail("");
                          fetchData();
                        }
                      } catch {
                        setActionMessage({ text: "Network error", type: "error" });
                      } finally {
                        setAddingSuperAdmin(false);
                      }
                    }}
                    disabled={addingSuperAdmin || !newSuperAdminEmail.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors"
                  >
                    {addingSuperAdmin ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>

              {/* Action message */}
              {actionMessage && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${actionMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {actionMessage.text}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
