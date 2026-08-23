"use client";

import { useState, useEffect } from "react";

type Session = {
  id: string;
  client_id: string;
  coach_id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  session_type: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled_charged" | "cancelled_no_charge" | "no_show" | "rescheduled";
  marked_at: string | null;
  created_at: string;
};

type SessionPackage = {
  id: string;
  sessions_purchased: number;
  amount_paid: number;
  notes: string | null;
  purchased_at: string;
};

type SessionBalance = {
  total_purchased: number;
  total_used: number;
  sessions_remaining: number;
  total_paid: number;
};

type Props = {
  clientId: string;
  clientName: string;
  onBack?: () => void;
};

export default function SessionsTab({ clientId, clientName, onBack }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create session form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("09:00");
  const [createDuration, setCreateDuration] = useState("60");
  const [createLocation, setCreateLocation] = useState("");
  const [createType, setCreateType] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Status update
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Show/hide history
  const [showHistory, setShowHistory] = useState(false);

  // Fetch sessions and packages
  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessRes, pkgRes] = await Promise.all([
        fetch(`/api/sessions?client_id=${clientId}`),
        fetch(`/api/session-packages?client_id=${clientId}`),
      ]);

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData.sessions || []);
      }

      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        setPackages(pkgData.packages || []);
        setBalance(pkgData.balance || null);
      }
    } catch (err) {
      setError("Failed to load session data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) fetchData();
  }, [clientId]);

  // Create a new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDate || !createTime) return;
    setCreating(true);
    setError("");

    const scheduled_at = new Date(`${createDate}T${createTime}`).toISOString();

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          scheduled_at,
          duration_minutes: parseInt(createDuration) || 60,
          location: createLocation || null,
          session_type: createType || null,
          notes: createNotes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create session");
      } else {
        setShowCreateForm(false);
        setCreateDate("");
        setCreateTime("09:00");
        setCreateDuration("60");
        setCreateLocation("");
        setCreateType("");
        setCreateNotes("");
        await fetchData();
      }
    } catch {
      setError("Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  // Update session status
  const handleStatusUpdate = async (sessionId: string, newStatus: string) => {
    setUpdatingId(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch {}
    setUpdatingId(null);
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this session?")) return;
    setUpdatingId(sessionId);
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      await fetchData();
    } catch {}
    setUpdatingId(null);
  };

  // Split sessions into upcoming and past
  const now = new Date();
  const upcoming = sessions
    .filter((s) => s.status === "scheduled" && new Date(s.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const history = sessions
    .filter((s) => s.status !== "scheduled" || new Date(s.scheduled_at) < now)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  // Helpers
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      completed: "bg-green-500/20 text-green-400 border-green-500/30",
      cancelled_charged: "bg-red-500/20 text-red-400 border-red-500/30",
      cancelled_no_charge: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      no_show: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      rescheduled: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    const labels: Record<string, string> = {
      scheduled: "Scheduled",
      completed: "Completed",
      cancelled_charged: "Cancelled (charged)",
      cancelled_no_charge: "Cancelled",
      no_show: "No Show",
      rescheduled: "Rescheduled",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] || "bg-gray-500/20 text-gray-400"}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError("")} className="text-red-400/60 text-xs mt-1 hover:text-red-400">Dismiss</button>
        </div>
      )}

      {/* ====== BALANCE CARD ====== */}
      <div className="bg-secondary/50 border border-white/10 rounded-xl p-5">
        <h3 className="font-heading text-sm uppercase text-gray-400 mb-4">Session Balance</h3>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-heading text-3xl text-accent">{balance?.sessions_remaining ?? 0}</p>
            <p className="text-gray-400 text-xs mt-1">Remaining</p>
          </div>
          <div>
            <p className="font-heading text-3xl text-white">{balance?.total_purchased ?? 0}</p>
            <p className="text-gray-400 text-xs mt-1">Total Purchased</p>
          </div>
          <div>
            <p className="font-heading text-3xl text-green-400">{balance?.total_used ?? 0}</p>
            <p className="text-gray-400 text-xs mt-1">Used</p>
          </div>
        </div>

        {balance && balance.total_paid > 0 && (
          <p className="text-gray-500 text-xs text-center mt-3">
            ${balance.total_paid.toFixed(2)} total paid across all packages
          </p>
        )}

        {/* Package History (read-only) */}
        {packages.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-gray-500 text-xs mb-2">Package History ({packages.length})</p>
            <div className="space-y-1.5">
              {packages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between bg-primary/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white text-sm font-medium">{pkg.sessions_purchased} sessions</span>
                    {pkg.amount_paid > 0 && <span className="text-green-400 text-xs">${pkg.amount_paid.toFixed(2)}</span>}
                    {pkg.notes && <span className="text-gray-500 text-xs">— {pkg.notes}</span>}
                  </div>
                  <span className="text-gray-500 text-xs">{formatDate(pkg.purchased_at)}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-2">To add more sessions, go to Account → plan → Add Session Package</p>
          </div>
        )}
      </div>

      {/* ====== UPCOMING SESSIONS ====== */}
      <div className="bg-secondary/50 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm uppercase text-gray-400">
            Upcoming Sessions {upcoming.length > 0 && <span className="text-accent">({upcoming.length})</span>}
          </h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {showCreateForm ? "Cancel" : "+ New Session"}
          </button>
        </div>

        {/* Create Session Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateSession} className="mb-4 pb-4 border-b border-white/10 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Date <span className="text-accent">*</span></label>
                <input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Time <span className="text-accent">*</span></label>
                <input
                  type="time"
                  value={createTime}
                  onChange={(e) => setCreateTime(e.target.value)}
                  className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Duration (min)</label>
                <select
                  value={createDuration}
                  onChange={(e) => setCreateDuration(e.target.value)}
                  className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="75">75 min</option>
                  <option value="90">90 min</option>
                  <option value="120">120 min</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Session Type</label>
                <input
                  type="text"
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g., Upper Body, Assessment"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Location</label>
                <input
                  type="text"
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g., Home gym, Park"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Notes</label>
              <textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows={2}
                placeholder="Session notes..."
              />
            </div>
            <button
              type="submit"
              disabled={creating || !createDate || !createTime}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
          </form>
        )}

        {/* Upcoming Sessions List */}
        {upcoming.length === 0 && !showCreateForm ? (
          <p className="text-gray-500 text-sm text-center py-6">No upcoming sessions scheduled</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((session) => (
              <div key={session.id} className="bg-primary/30 border border-white/5 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-medium">{formatDateTime(session.scheduled_at)}</p>
                      <span className="text-gray-500 text-xs">{session.duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {session.session_type && (
                        <span className="text-accent text-xs">{session.session_type}</span>
                      )}
                      {session.location && (
                        <span className="text-gray-400 text-xs">📍 {session.location}</span>
                      )}
                    </div>
                    {session.notes && (
                      <p className="text-gray-500 text-xs mt-1">{session.notes}</p>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {updatingId === session.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(session.id, "completed")}
                          title="Mark Complete"
                          className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(session.id, "no_show")}
                          title="No Show"
                          className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(session.id, "cancelled_charged")}
                          title="Cancel (charged)"
                          className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(session.id, "cancelled_no_charge")}
                          title="Cancel (no charge)"
                          className="w-7 h-7 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-400 hover:bg-gray-500/20 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          title="Delete"
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== SESSION HISTORY ====== */}
      {history.length > 0 && (
        <div className="bg-secondary/50 border border-white/10 rounded-xl p-5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-heading text-sm uppercase text-gray-400">
              Session History <span className="text-gray-500">({history.length})</span>
            </h3>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {showHistory && (
            <div className="mt-4 space-y-2">
              {history.map((session) => (
                <div key={session.id} className="flex items-center justify-between bg-primary/30 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-white text-sm">{formatDateTime(session.scheduled_at)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {session.session_type && <span className="text-gray-400 text-xs">{session.session_type}</span>}
                        {session.location && <span className="text-gray-500 text-xs">📍 {session.location}</span>}
                        <span className="text-gray-600 text-xs">{session.duration_minutes} min</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    {statusBadge(session.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions Legend */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-4">
        <p className="text-gray-500 text-xs mb-2 font-heading uppercase">Quick Action Legend</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400">✓</span>
            <span className="text-gray-400">Complete (deducts)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400">⊘</span>
            <span className="text-gray-400">No Show (deducts)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">✕</span>
            <span className="text-gray-400">Cancel (charged)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-gray-400">—</span>
            <span className="text-gray-400">Cancel (free)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
