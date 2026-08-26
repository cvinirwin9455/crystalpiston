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
  recurring_schedule_id: string | null;
  created_at: string;
}

interface RecurringSchedule {
  id: string;
  client_id: string;
  days_of_week: number[];
  time_of_day: string;
  duration_minutes: number;
  location: string | null;
  session_type: string | null;
  active: boolean;
  created_at: string;
}

interface SessionsTabProps {
  clientId: string;
  clientName: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SessionsTab({ clientId, clientName }: SessionsTabProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [reschedulingSession, setReschedulingSession] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
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

  // Reschedule state
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  // Add recurring schedule form state
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleDayTimes, setScheduleDayTimes] = useState<Record<number, string>>({});
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("60");
  const [scheduleLocation, setScheduleLocation] = useState("");
  const [scheduleType, setScheduleType] = useState("");

  // Edit schedule state
  const [editScheduleDays, setEditScheduleDays] = useState<number[]>([]);
  const [editScheduleDayTimes, setEditScheduleDayTimes] = useState<Record<number, string>>({});
  const [editScheduleDuration, setEditScheduleDuration] = useState("");
  const [editScheduleLocation, setEditScheduleLocation] = useState("");
  const [editScheduleType, setEditScheduleType] = useState("");

  useEffect(() => {
    fetchSessions();
    fetchBalance();
    fetchSchedules();
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

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`/api/recurring-schedules?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
    }
  };

  // ============ SESSION ACTIONS ============

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
        fetchBalance();
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
      const dateStr = new Date(session.scheduled_at).toISOString().split("T")[0];
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

  const handleReschedule = async (sessionId: string) => {
    if (!rescheduleDate || !rescheduleTime) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, scheduledAt }),
      });
      if (res.ok) {
        setReschedulingSession(null);
        setRescheduleDate("");
        setRescheduleTime("");
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to reschedule session:", err);
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
    const d = new Date(session.scheduled_at);
    setEditTime(d.toTimeString().slice(0, 5));
    setEditDuration(session.duration_minutes.toString());
    setEditLocation(session.location || "");
    setEditNotes(session.notes || "");
    setEditingSession(session.id);
    setReschedulingSession(null);
  };

  const startRescheduling = (session: Session) => {
    const d = new Date(session.scheduled_at);
    setRescheduleDate(d.toISOString().split("T")[0]);
    setRescheduleTime(d.toTimeString().slice(0, 5));
    setReschedulingSession(session.id);
    setEditingSession(null);
  };

  // ============ RECURRING SCHEDULE ACTIONS ============

  const handleCreateSchedule = async () => {
    if (scheduleDays.length === 0 || !scheduleStartDate) return;
    setSaving(true);
    try {
      const daySchedules = scheduleDays.map(day => ({
        day,
        time: scheduleDayTimes[day] || "09:00",
      }));
      const res = await fetch("/api/recurring-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          daySchedules,
          startDate: scheduleStartDate,
          durationMinutes: parseInt(scheduleDuration) || 60,
          location: scheduleLocation || null,
          sessionType: scheduleType || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowAddSchedule(false);
        setScheduleDays([]);
        setScheduleDayTimes({});
        setScheduleStartDate("");
        setScheduleDuration("60");
        setScheduleLocation("");
        setScheduleType("");
        fetchSchedules();
        fetchSessions();
        fetchBalance();
        if (data.generatedSessions > 0) {
          alert(`Schedule created! ${data.generatedSessions} session${data.generatedSessions > 1 ? 's' : ''} auto-generated.`);
        }
      }
    } catch (err) {
      console.error("Failed to create schedule:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, currentActive: boolean) => {
    const clearFuture = !currentActive ? false : confirm("Pause this schedule?\n\nDo you also want to DELETE all future scheduled sessions from this pattern?\n\nClick OK to delete future sessions, Cancel to keep them.");
    try {
      const res = await fetch("/api/recurring-schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          active: !currentActive,
          clearFutureSessions: clearFuture,
        }),
      });
      if (res.ok) {
        fetchSchedules();
        fetchSessions();
        fetchBalance();
      }
    } catch (err) {
      console.error("Failed to toggle schedule:", err);
    }
  };

  const handleEditSchedule = async (scheduleId: string) => {
    setSaving(true);
    const clearFuture = confirm("You're changing this schedule pattern.\n\nDelete existing future sessions from the OLD pattern and generate new ones?\n\nClick OK to regenerate, Cancel to just update the pattern.");
    try {
      const daySchedules = editScheduleDays.map(day => ({
        day,
        time: editScheduleDayTimes[day] || "09:00",
      }));
      const res = await fetch("/api/recurring-schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          daySchedules,
          durationMinutes: parseInt(editScheduleDuration) || 60,
          location: editScheduleLocation || null,
          sessionType: editScheduleType || null,
          clearFutureSessions: clearFuture,
        }),
      });
      if (res.ok) {
        setEditingSchedule(null);
        fetchSchedules();
        fetchSessions();
        fetchBalance();
      }
    } catch (err) {
      console.error("Failed to edit schedule:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const clearFuture = confirm("Delete this recurring schedule?\n\nAlso delete all future scheduled sessions from this pattern?\n\nClick OK to delete future sessions too, Cancel to keep them (only removes the pattern).");
    try {
      const res = await fetch(`/api/recurring-schedules?id=${scheduleId}&clear_future=${clearFuture}`, { method: "DELETE" });
      if (res.ok) {
        fetchSchedules();
        fetchSessions();
        fetchBalance();
      }
    } catch (err) {
      console.error("Failed to delete schedule:", err);
    }
  };

  const startEditingSchedule = (schedule: RecurringSchedule) => {
    setEditScheduleDays([...schedule.days_of_week]);
    // Set the same time for all days (from the schedule's default time)
    const defaultTime = schedule.time_of_day.slice(0, 5);
    const dayTimes: Record<number, string> = {};
    schedule.days_of_week.forEach(d => { dayTimes[d] = defaultTime; });
    setEditScheduleDayTimes(dayTimes);
    setEditScheduleDuration(schedule.duration_minutes.toString());
    setEditScheduleLocation(schedule.location || "");
    setEditScheduleType(schedule.session_type || "");
    setEditingSchedule(schedule.id);
  };

  // (toggleDay is now inlined in renderDayPicker)

  // ============ DISPLAY HELPERS ============

  const now = new Date();
  const filteredSessions = sessions.filter((s) => {
    if (filter === "upcoming") return new Date(s.scheduled_at) >= now && s.status === "scheduled";
    if (filter === "past") return new Date(s.scheduled_at) < now || s.status !== "scheduled";
    return true;
  }).sort((a, b) => {
    // Upcoming: soonest first (ascending). Past/All: most recent first (descending).
    if (filter === "upcoming") return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  });

  const formatDateTime = (iso: string) => {
    // Parse without timezone conversion — display the time as stored
    // Handle both "2026-08-31T06:00:00" and "2026-08-31T06:00:00Z" or "2026-08-31T06:00:00+00:00"
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      const [, yearStr, monthStr, dayStr, hourStr, minStr] = match;
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1;
      const day = parseInt(dayStr);
      const hour = parseInt(hourStr);
      const min = parseInt(minStr);
      // Build display date using local-context Date just for day-of-week/month formatting
      const displayDate = new Date(year, month, day);
      const weekday = displayDate.toLocaleDateString("en-US", { weekday: "short" });
      const monthName = displayDate.toLocaleDateString("en-US", { month: "short" });
      // Format time as 12h
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      const timeStr = `${hour12}:${minStr} ${ampm}`;
      return `${weekday}, ${monthName} ${day} at ${timeStr}`;
    }
    // Fallback
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const formatTime12h = (time24: string) => {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
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

  // ============ DAY PICKER INLINE HELPERS ============
  const renderDayPicker = (days: number[], setDays: (d: number[]) => void, dayTimes: Record<number, string>, setDayTimes: (t: Record<number, string>) => void) => (
    <div>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              if (days.includes(day)) {
                setDays(days.filter((d) => d !== day));
                const updated = { ...dayTimes };
                delete updated[day];
                setDayTimes(updated);
              } else {
                setDays([...days, day].sort());
                setDayTimes({ ...dayTimes, [day]: "09:00" });
              }
            }}
            className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${days.includes(day) ? "bg-accent text-white" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white hover:border-white/30"}`}
          >
            {DAY_NAMES[day]}
          </button>
        ))}
      </div>
      {days.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {[...days].sort().map((day) => (
            <div key={day} className="flex items-center gap-1.5 bg-primary/50 border border-white/10 rounded-lg px-2 py-1.5">
              <span className="text-gray-300 text-xs font-medium w-7">{DAY_NAMES[day]}</span>
              <input
                type="time"
                value={dayTimes[day] || "09:00"}
                onChange={(e) => setDayTimes({ ...dayTimes, [day]: e.target.value })}
                className="bg-transparent border-none text-white text-xs focus:outline-none w-20"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
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

      {/* ============ RECURRING SCHEDULES SECTION ============ */}
      <div className="bg-secondary/30 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <h4 className="font-heading text-sm uppercase text-white">Recurring Schedule</h4>
          </div>
          {!showAddSchedule && (
            <button onClick={() => setShowAddSchedule(true)} className="text-blue-400 text-xs hover:underline">+ Add Pattern</button>
          )}
        </div>

        {/* Existing schedules */}
        {schedules.length === 0 && !showAddSchedule && (
          <p className="text-gray-500 text-xs">No recurring schedule set. Add a pattern to auto-generate sessions based on session balance.</p>
        )}

        {schedules.map((schedule) => (
          <div key={schedule.id} className={`border rounded-lg p-3 mb-2 ${schedule.active ? "border-blue-500/20 bg-blue-500/5" : "border-white/5 bg-white/2 opacity-60"}`}>
            {editingSchedule === schedule.id ? (
              /* Edit schedule */
              <div className="space-y-3">
                {renderDayPicker(editScheduleDays, setEditScheduleDays, editScheduleDayTimes, setEditScheduleDayTimes)}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Duration</label>
                    <select value={editScheduleDuration} onChange={(e) => setEditScheduleDuration(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
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
                    <input type="text" value={editScheduleLocation} onChange={(e) => setEditScheduleLocation(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Type</label>
                    <input type="text" value={editScheduleType} onChange={(e) => setEditScheduleType(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditSchedule(schedule.id)} disabled={editScheduleDays.length === 0 || saving} className="bg-accent hover:bg-orange-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs disabled:opacity-50">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button onClick={() => setEditingSchedule(null)} className="text-gray-400 hover:text-white text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              /* View schedule */
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">
                      {schedule.days_of_week.map((d) => DAY_NAMES[d]).join(", ")}
                    </span>
                    <span className="text-gray-400 text-sm">@ {formatTime12h(schedule.time_of_day.slice(0, 5))}</span>
                    {!schedule.active && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">Paused</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-gray-500 text-xs">{schedule.duration_minutes} min</span>
                    {schedule.location && <span className="text-gray-500 text-xs">📍 {schedule.location}</span>}
                    {schedule.session_type && <span className="text-gray-500 text-xs">{schedule.session_type}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggleSchedule(schedule.id, schedule.active)} title={schedule.active ? "Pause" : "Resume"} className={`p-1.5 rounded-lg transition-colors ${schedule.active ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                    {schedule.active ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </button>
                  <button onClick={() => startEditingSchedule(schedule)} title="Edit" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => handleDeleteSchedule(schedule.id)} title="Delete" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add schedule form */}
        {showAddSchedule && (
          <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4 space-y-3">
            <h5 className="text-white text-sm font-medium">New Recurring Pattern</h5>
            <div>
              <label className="text-gray-400 text-xs block mb-2">Days & Times *</label>
              {renderDayPicker(scheduleDays, setScheduleDays, scheduleDayTimes, setScheduleDayTimes)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Start Date *</label>
                <input type="date" value={scheduleStartDate} onChange={(e) => setScheduleStartDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Duration</label>
                <select value={scheduleDuration} onChange={(e) => setScheduleDuration(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
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
                <input type="text" value={scheduleLocation} onChange={(e) => setScheduleLocation(e.target.value)} placeholder="e.g. Main Gym" className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Session Type</label>
                <input type="text" value={scheduleType} onChange={(e) => setScheduleType(e.target.value)} placeholder="e.g. Strength" className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
              </div>
            </div>
            <p className="text-gray-500 text-xs">Sessions will be auto-generated starting from the start date to fill your remaining session balance ({sessionsRemaining ?? 0} sessions).</p>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreateSchedule} disabled={scheduleDays.length === 0 || !scheduleStartDate || saving} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                {saving ? "Creating..." : "Create Schedule"}
              </button>
              <button onClick={() => { setShowAddSchedule(false); setScheduleDays([]); setScheduleDayTimes({}); setScheduleStartDate(""); }} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ============ ADD SESSION FORM ============ */}
      {showAddSession && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
          <h4 className="text-white text-sm font-medium">New One-Off Session</h4>
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

      {/* ============ SESSION SUMMARY ============ */}
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

      {/* ============ FILTERS ============ */}
      <div className="flex gap-1">
        {(["upcoming", "past", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-white bg-white/5"}`}>
            {f === "upcoming" ? `Upcoming (${sessions.filter(s => new Date(s.scheduled_at) >= now && s.status === "scheduled").length})` : f === "past" ? "History" : "All"}
          </button>
        ))}
      </div>

      {/* ============ SESSIONS LIST ============ */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-8 bg-primary/20 border border-white/5 rounded-xl">
          <p className="text-gray-400 text-sm">
            {filter === "upcoming" ? "No upcoming sessions." : filter === "past" ? "No session history." : "No sessions found."}
          </p>
          {filter === "upcoming" && (
            <p className="text-gray-500 text-xs mt-1">Set up a recurring schedule above, publish a week with in-person days, or add a session manually.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map((session) => (
            <div key={session.id} className={`bg-primary/30 border border-white/5 rounded-xl p-4 ${editingSession === session.id || reschedulingSession === session.id ? "ring-1 ring-accent/50" : ""}`}>
              {editingSession === session.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <p className="text-gray-400 text-xs">Editing: {formatDateTime(session.scheduled_at)}</p>
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
              ) : reschedulingSession === session.id ? (
                /* Reschedule mode */
                <div className="space-y-3">
                  <p className="text-gray-400 text-xs">Rescheduling: {formatDateTime(session.scheduled_at)} → new date/time:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">New Date *</label>
                      <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">New Time *</label>
                      <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs">This only moves this one session. The recurring pattern is not affected.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleReschedule(session.id)} disabled={!rescheduleDate || !rescheduleTime || saving} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs disabled:opacity-50">
                      {saving ? "Moving..." : "Reschedule"}
                    </button>
                    <button onClick={() => setReschedulingSession(null)} className="text-gray-400 hover:text-white text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{formatDateTime(session.scheduled_at)}</p>
                        {session.recurring_schedule_id && <span className="text-xs text-blue-400/60">🔄</span>}
                      </div>
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
                        <button onClick={() => startRescheduling(session)} title="Reschedule" className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <button onClick={() => startEditing(session)} title="Edit details" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSession(session.id)} title="Delete" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                    {session.status !== "scheduled" && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdateStatus(session.id, "scheduled")} title="Revert to Scheduled" className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSession(session.id)} title="Delete" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
