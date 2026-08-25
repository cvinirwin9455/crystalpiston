"use client";

import { useState, useEffect } from "react";

interface Session {
  id: string;
  client_id: string;
  coach_id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  session_type: string | null;
  notes: string | null;
  status: string;
  marked_at: string | null;
  created_at: string;
}

interface SessionsTabProps {
  clientId: string;
  clientName: string;
}

export default function SessionsTab({ clientId, clientName }: SessionsTabProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  // Add session form state
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newLocation, setNewLocation] = useState("");
  const [newType, setNewType] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit session state
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    fetchSessions();
    fetchBalance();
  }, [clientId]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`/api/sessions?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch(`/api/session-packages?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionsRemaining(data.sessionsRemaining ?? 0);
      }
    } catch {}
  };

  const handleAddSession = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${newDate}T${newTime}:00`).toISOString();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          scheduledAt,
          durationMinutes: parseInt(newDuration) || 60,
          location: newLocation || null,
          sessionType: newType || null,
          notes: newNotes || null,
        }),
      });
      if (res.ok) {
        setShowAddSession(false);
        setNewDate("");
        setNewTime("09:00");
        setNewDuration("60");
        setNewLocation("");
        setNewType("");
        setNewNotes("");
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (sessionId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: newStatus }),
      });
      if (res.ok) {
        fetchSessions();
        fetchBalance();
      }
    } catch (err) {
      console.error("Failed to update session status:", err);
    }
  };

  const handleEditSession = async (sessionId: string) => {
    setSaving(true);
    try {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const dateStr = session.scheduled_at.split("T")[0];
      const scheduledAt = editTime ? new Date(`${dateStr}T${editTime}:00`).toISOString() : undefined;

      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ...(scheduledAt ? { scheduledAt } : {}),
          ...(editDuration ? { durationMinutes: parseInt(editDuration) } : {}),
          ...(editLocation !== undefined ? { location: editLocation } : {}),
          ...(editNotes !== undefined ? { notes: editNotes } : {}),
        }),
      });
      if (res.ok) {
        setEditingSession(null);
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to edit session:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/sessions?id=${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        fetchSessions();
        fetchBalance();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const startEditing = (session: Session) => {
    const time = new Date(session.scheduled_at).toTimeString().slice(0, 5);
    setEditTime(time);
    setEditDuration(session.duration_minutes.toString());
    setEditLocation(session.location || "");
    setEditNotes(session.notes || "");
    setEditingSession(session.id);
  };

  // Filter sessions
  const now = new Date();
  const filteredSessions = sessions.filter((s) => {
    if (filter === "upcoming") return new Date(s.scheduled_at) >= now && s.status === "scheduled";
    if (filter === "past") return new Date(s.scheduled_at) < now || s.status !== "scheduled";
    return true;
  });

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const statusColors: Record<string, string> = {
    scheduled: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    completed: "text-green-400 bg-green-500/10 border-green-500/30",
    cancelled_charged: "text-red-400 bg-red-500/10 border-red-500/30",
    cancelled_no_charge: "text-gray-400 bg-gray-500/10 border-gray-500/30",
    no_show: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    rescheduled: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Scheduled",
    completed: "Completed",
    cancelled_charged: "Cancelled (charged)",
    cancelled_no_charge: "Cancelled",
    no_show: "No-Show",
    rescheduled: "Rescheduled",
  };

  if (loading) {
    return <div className="text-center py-8"><p className="text-gray-400">Loading sessions...</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with balance */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg uppercase text-white">Sessions</h3>
          <p className="text-gray-400 text-xs">In-person training sessions for {clientName.split(" ")[0]}</p>
        </div>
        <div className="flex items-center gap-3">
          {sessionsRemaining !== null && (
            <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${sessionsRemaining <= 3 ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/30 text-green-400"}`}>
              {sessionsRemaining} session{sessionsRemaining !== 1 ? "s" : ""} remaining
            </div>
          )}
          <button onClick={() => setShowAddSession(true)} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-sm">
            + Add Session
          </button>
        </div>
      </div>

      {/* Add Session Form */}
      {showAddSession && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
          <h4 className="text-white text-sm font-medium">New Session</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Date *</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Time</label>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Duration</label>
              <select value={newDuration} onChange={(e) => setNewDuration(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="75">75 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Location</label>
              <input type="text" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. Main Gym" className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Type</label>
              <input type="text" value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. Upper Body" className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Notes</label>
              <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optional notes" className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAddSession} disabled={!newDate || saving} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
              {saving ? "Creating..." : "Create Session"}
            </button>
            <button onClick={() => setShowAddSession(false)} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1">
        {(["upcoming", "past", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-white bg-white/5"}`}>
            {f === "upcoming" ? "Upcoming" : f === "past" ? "History" : "All"}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-8 bg-primary/20 border border-white/5 rounded-xl">
          <p className="text-gray-400 text-sm">
            {filter === "upcoming" ? "No upcoming sessions." : filter === "past" ? "No session history." : "No sessions found."}
          </p>
          {filter === "upcoming" && (
            <p className="text-gray-500 text-xs mt-1">Sessions are auto-created when you publish a week with in-person days, or you can add one manually above.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map((session) => (
            <div key={session.id} className={`bg-primary/30 border border-white/5 rounded-xl p-4 ${editingSession === session.id ? "ring-1 ring-accent/50" : ""}`}>
              {editingSession === session.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Time</label>
                      <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Duration</label>
                      <select value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">60 min</option>
                        <option value="75">75 min</option>
                        <option value="90">90 min</option>
                        <option value="120">120 min</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Location</label>
                      <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Notes</label>
                      <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditSession(session.id)} disabled={saving} className="bg-accent hover:bg-orange-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs disabled:opacity-50">
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingSession(null)} className="text-gray-400 hover:text-white text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-white text-sm font-medium">{formatDateTime(session.scheduled_at)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {session.session_type && <span className="text-gray-400 text-xs">{session.session_type}</span>}
                        {session.location && <span className="text-gray-500 text-xs">📍 {session.location}</span>}
                        <span className="text-gray-500 text-xs">{session.duration_minutes} min</span>
                        {session.notes && <span className="text-gray-500 text-xs italic">&ldquo;{session.notes}&rdquo;</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[session.status] || "text-gray-400 bg-gray-500/10 border-gray-500/30"}`}>
                      {statusLabels[session.status] || session.status}
                    </span>
                    {session.status === "scheduled" && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdateStatus(session.id, "completed")} title="Mark Complete" className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button onClick={() => handleUpdateStatus(session.id, "no_show")} title="No-Show" className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                        <button onClick={() => handleUpdateStatus(session.id, "cancelled_charged")} title="Cancel (charged)" className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <button onClick={() => handleUpdateStatus(session.id, "cancelled_no_charge")} title="Cancel (no charge)" className="p-1.5 rounded-lg bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button onClick={() => startEditing(session)} title="Edit" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSession(session.id)} title="Delete" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                    {session.status !== "scheduled" && (
                      <button onClick={() => handleDeleteSession(session.id)} title="Delete" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {sessions.length > 0 && (
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-4">
          <h4 className="text-gray-400 text-xs font-heading uppercase mb-2">Session Summary</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div>
              <p className="text-white font-heading text-lg">{sessions.filter((s) => s.status === "scheduled").length}</p>
              <p className="text-gray-400 text-xs">Scheduled</p>
            </div>
            <div>
              <p className="text-green-400 font-heading text-lg">{sessions.filter((s) => s.status === "completed").length}</p>
              <p className="text-gray-400 text-xs">Completed</p>
            </div>
            <div>
              <p className="text-yellow-400 font-heading text-lg">{sessions.filter((s) => s.status === "no_show").length}</p>
              <p className="text-gray-400 text-xs">No-Shows</p>
            </div>
            <div>
              <p className="text-red-400 font-heading text-lg">{sessions.filter((s) => s.status === "cancelled_charged").length}</p>
              <p className="text-gray-400 text-xs">Cancelled (charged)</p>
            </div>
            <div>
              <p className="text-gray-300 font-heading text-lg">{sessions.filter((s) => s.status === "cancelled_no_charge").length}</p>
              <p className="text-gray-400 text-xs">Cancelled (free)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
