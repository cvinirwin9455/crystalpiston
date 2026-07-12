"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const [activeTab, setActiveTab] = useState<"overview" | "beta">("overview");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "activated" | "pending">("all");
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
        // Open in new tab so super admin session isn't lost
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
              All Organizations
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
              { key: "overview", label: "Organizations" },
              { key: "beta", label: `Beta Signups (${betaSignups.length})` },
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
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Organizations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {organizations.map((org) => (
                <div key={org.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">{org.name}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {org.slug}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{org.domain || "No domain"}</p>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{org.admins}</div>
                      <div className="text-xs text-gray-500">Coaches</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{org.activeClients}</div>
                      <div className="text-xs text-gray-500">Active Clients</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{org.totalUsers}</div>
                      <div className="text-xs text-gray-500">Total Users</div>
                    </div>
                  </div>
                  {/* View As button */}
                  {org.accountCoachId && (
                    <button
                      onClick={() => viewAsCoach(org.accountCoachId!)}
                      disabled={impersonatingId === org.accountCoachId}
                      className="w-full text-sm bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-100 transition font-medium disabled:opacity-50"
                    >
                      {impersonatingId === org.accountCoachId ? "Opening..." : "View as Coach \u2192"}
                    </button>
                  )}
                </div>
              ))}
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
                        {/* View as button (only for completed setup) */}
                        {signup.hasSetPassword && signup.activatedUserId && (
                          <button
                            onClick={() => viewAsCoach(signup.activatedUserId!)}
                            disabled={impersonatingId === signup.activatedUserId}
                            className="text-sm bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-100 transition font-medium disabled:opacity-50"
                          >
                            {impersonatingId === signup.activatedUserId ? "Opening..." : "View as Coach"}
                          </button>
                        )}

                        {/* Activate button (only for pending) */}
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

                        {/* Resend button (only for activated but NOT completed) */}
                        {signup.activated && !signup.hasSetPassword && (
                          <button
                            onClick={() => resendInvite(signup.id)}
                            disabled={resendingId === signup.id}
                            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                          >
                            {resendingId === signup.id ? "Sending..." : "Resend Invite"}
                          </button>
                        )}

                        {/* Delete button */}
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
      </main>
    </div>
  );
}
