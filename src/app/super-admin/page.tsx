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
};

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [betaSignups, setBetaSignups] = useState<BetaSignup[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "beta" | "actions">("overview");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activatePassword, setActivatePassword] = useState("");
  const [activateMessage, setActivateMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function activateCoach(signupId: string, organizationId: string) {
    if (!activatePassword) {
      setActivateMessage({ text: "Please enter a password for the new account", type: "error" });
      return;
    }

    setActivateMessage(null);
    try {
      const res = await fetch("/api/super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_coach",
          signupId,
          organizationId,
          password: activatePassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActivateMessage({ text: data.error || "Failed to activate", type: "error" });
      } else {
        setActivateMessage({ text: data.message, type: "success" });
        setActivatingId(null);
        setActivatePassword("");
        fetchData(); // Refresh
      }
    } catch {
      setActivateMessage({ text: "Network error", type: "error" });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

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
            <a href="/admin" className="text-sm text-gray-500 hover:text-gray-800 transition">
              &larr; Crystal Admin
            </a>
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
                  <div className="grid grid-cols-3 gap-4">
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

            {activateMessage && (
              <div className={`p-4 rounded-lg text-sm ${
                activateMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {activateMessage.text}
              </div>
            )}

            {betaSignups.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">No beta signups yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {betaSignups.map((signup) => (
                  <div key={signup.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{signup.full_name}</h3>
                        <p className="text-sm text-gray-500">{signup.email}</p>
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                            {signup.coaching_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {signup.expected_clients} expected clients
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Signed up: {new Date(signup.signed_up_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {activatingId === signup.id ? (
                          <div className="flex flex-col gap-2 items-end">
                            <input
                              type="text"
                              placeholder="Set password for coach"
                              value={activatePassword}
                              onChange={(e) => setActivatePassword(e.target.value)}
                              className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-56 focus:outline-none focus:border-purple-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => activateCoach(signup.id, signup.organization_id)}
                                className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
                              >
                                Create Account
                              </button>
                              <button
                                onClick={() => { setActivatingId(null); setActivatePassword(""); }}
                                className="text-sm text-gray-500 px-3 py-2 hover:text-gray-800 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActivatingId(signup.id)}
                            className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium"
                          >
                            Activate Coach
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
