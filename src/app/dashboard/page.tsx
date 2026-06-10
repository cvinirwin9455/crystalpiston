"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type WorkoutLog = { rpe: string; stress: string; notes: string; energy: string; motivation: string; sleep: string; strength: string; recovery: string; mood: string; hunger: string; actualMiles?: string; actualPace?: string; onPeriod?: string; duration?: string; };
type WorkoutDay = { id: string; day: string; date: string; type: "run" | "cross" | "rest"; trainingType: string; title: string; miles: number | null; description: string; paceTarget?: string; location?: string; coachNotes?: string; completed: boolean; status?: "complete" | "partial" | "skipped"; skipReason?: string; log?: WorkoutLog; };
type WeekData = { weekId: string; label: string; dateRange: string; focus: string; coachMessage: string; workouts: WorkoutDay[]; };

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"training" | "messages" | "account">("training");
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread message count
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages/unread');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };
    fetchUnread();
    // Poll every 30 seconds for new messages
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);
  const [showMessageForm, setShowMessageForm] = useState(false);

  const [statsFilter, setStatsFilter] = useState<"thisWeek" | "allTime">("thisWeek");

  const [clientMessages, setClientMessages] = useState<{id: string; date: string; from: string; message: string}[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch messages from API
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/messages');
        if (res.ok) {
          const data = await res.json();
          setClientMessages(data);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };
    fetchMessages();
    // Poll every 30 seconds for new messages
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      if (res.ok) {
        const data = await res.json();
        setClientMessages(prev => [...prev, {
          id: data.messageId,
          date: new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          from: 'client',
          message: newMessage.trim(),
        }]);
        setNewMessage("");
        setShowMessageForm(false);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const [clientInfo, setClientInfo] = useState<{goal: string; planEnd: string; startDate: string; owed: number; paid: number; status: string} | null>(null);
  const [allPlans, setAllPlans] = useState<{goal: string; startDate: string; planEnd: string; owed: number; paid: number; status: string}[]>([]);

  // Fetch client's own plan info
  useEffect(() => {
    const fetchPlanInfo = async () => {
      try {
        const res = await fetch('/api/my-plans');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setClientInfo(data.activePlan || null);
            setAllPlans(data.allPlans || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch plan info:', err);
      }
    };
    fetchPlanInfo();
  }, []);

  const [weeks, setWeeks] = useState<WeekData[]>([]); // All published weeks from API
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, +1 = next week
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [minOffset, setMinOffset] = useState(0); // furthest back we can go
  const [maxOffset, setMaxOffset] = useState(0); // furthest forward we can go

  // Helper: get the Monday of a week offset from current week
  const getMondayForOffset = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const targetMonday = new Date(thisMonday);
    targetMonday.setDate(thisMonday.getDate() + (offset * 7));
    return targetMonday;
  };

  // Helper: format a date range for a given offset
  const getWeekLabel = (offset: number) => {
    const monday = getMondayForOffset(offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)} - ${fmt(sunday)}`;
  };

  // Helper: find the published plan for a given week offset (or null)
  const getWeekPlan = (offset: number): WeekData | null => {
    const monday = getMondayForOffset(offset);
    const mondayStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return weeks.find(w => w.dateRange.startsWith(mondayStr)) || null;
  };

  // Fetch published weeks from API
  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const res = await fetch('/api/my-weeks');
        if (res.ok) {
          const data = await res.json();
          const mapped: WeekData[] = data.map((w: any) => ({
            weekId: w.weekId,
            label: w.dateRange,
            dateRange: w.dateRange,
            focus: w.focus || '',
            coachMessage: w.coachMessage || '',
            workouts: (w.workouts || []).map((wo: any) => ({
              id: wo.id,
              day: wo.day || '',
              date: '',
              type: wo.type || 'run',
              trainingType: wo.trainingType || '',
              title: wo.title || '',
              miles: wo.miles,
              description: wo.description || '',
              paceTarget: wo.paceTarget || '',
              location: wo.location || '',
              coachNotes: wo.coachNotes || '',
              completed: wo.completed || false,
              status: wo.status || undefined,
              skipReason: wo.skipReason || undefined,
              log: wo.log || undefined,
            })),
          }));
          setWeeks(mapped);
          
          // Calculate navigation bounds based on published plans
          const today = new Date();
          const dayOfWeek = today.getDay();
          const thisMonday = new Date(today);
          thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          thisMonday.setHours(0, 0, 0, 0);

          let earliest = 0;
          let latest = 0;
          
          for (const w of mapped) {
            const startStr = w.dateRange.split(' - ')[0];
            const weekMonday = new Date(startStr + ', ' + new Date().getFullYear());
            weekMonday.setHours(0, 0, 0, 0);
            const diffDays = Math.round((weekMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24));
            const offset = Math.round(diffDays / 7);
            if (offset < earliest) earliest = offset;
            if (offset > latest) latest = offset;
          }
          
          setMinOffset(earliest);
          setMaxOffset(latest);
        }
      } catch (err) {
        console.error('Failed to fetch weeks:', err);
      } finally {
        setLoadingWeeks(false);
      }
    };
    fetchWeeks();
  }, []);

  const currentWeek = getWeekPlan(weekOffset);
  const weeklyTotal = currentWeek ? currentWeek.workouts.reduce((sum, day) => sum + (day.miles || 0), 0) : 0;
  const completedCount = currentWeek ? currentWeek.workouts.filter((w) => w.completed).length : 0;
  const allWorkouts = weeks.flatMap((w) => w.workouts);

  const statsWorkouts = statsFilter === "thisWeek" ? (currentWeek?.workouts || []) : allWorkouts;
  const statsCompleted = statsWorkouts.filter(w => w.completed);
  const statsMiles = statsCompleted.reduce((s, w) => s + (Number(w.log?.actualMiles) || w.miles || 0), 0);
  const statsAvgRpe = () => { const withRpe = statsCompleted.filter(w => w.log?.rpe); if (withRpe.length === 0) return "—"; return (withRpe.reduce((a, w) => a + Number(w.log!.rpe), 0) / withRpe.length).toFixed(1); };

  const [showSkipDialog, setShowSkipDialog] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipType, setSkipType] = useState<"skipped" | "partial">("skipped");

  const [savingLog, setSavingLog] = useState(false);

  const toggleCompleted = async (workoutId: string) => {
    if (!currentWeek) return;
    const workout = currentWeek.workouts.find(w => w.id === workoutId);
    if (!workout) return;

    setSavingLog(true);
    try {
      const res = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          status: 'complete',
          rpe: workout.log?.rpe || null,
          actualMiles: workout.log?.actualMiles || null,
          actualPace: workout.log?.actualPace || null,
          stress: workout.log?.stress || null,
          notes: workout.log?.notes || null,
          onPeriod: workout.log?.onPeriod || null,
          duration: workout.log?.duration || null,
          energy: workout.log?.energy || null,
          motivation: workout.log?.motivation || null,
          sleep: workout.log?.sleep || null,
          strength: workout.log?.strength || null,
          recovery: workout.log?.recovery || null,
          mood: workout.log?.mood || null,
          hunger: workout.log?.hunger || null,
        }),
      });
      if (res.ok) {
        const updated = [...weeks];
        const week = updated.find(w => w.weekId === currentWeek.weekId);
        const wo = week?.workouts.find(w => w.id === workoutId);
        if (wo) { wo.completed = true; wo.status = "complete"; }
        setWeeks(updated);
      }
    } catch (err) {
      console.error('Failed to save workout log:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const markSkipped = async (workoutId: string) => {
    if (!currentWeek) return;
    setSavingLog(true);
    try {
      const res = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          status: skipType,
          skipReason: skipReason || null,
        }),
      });
      if (res.ok) {
        const updated = [...weeks];
        const week = updated.find(w => w.weekId === currentWeek.weekId);
        const wo = week?.workouts.find(w => w.id === workoutId);
        if (wo) { wo.completed = true; wo.status = skipType; wo.skipReason = skipReason; }
        setWeeks(updated);
      }
    } catch (err) {
      console.error('Failed to save skip log:', err);
    } finally {
      setSavingLog(false);
      setShowSkipDialog(null);
      setSkipReason("");
    }
  };
  const updateWorkoutLog = (workoutId: string, field: string, value: string) => { if (!currentWeek) return; const updated = [...weeks]; const week = updated.find(w => w.weekId === currentWeek.weekId); const workout = week?.workouts.find((w) => w.id === workoutId); if (workout) { if (!workout.log) { workout.log = { rpe: "", stress: "", notes: "", energy: "", motivation: "", sleep: "", strength: "", recovery: "", mood: "", hunger: "" }; } (workout.log as Record<string, string>)[field] = value; setWeeks(updated); } };

  const getTypeLabel = (type: string) => { switch (type) { case "run": return "Run"; case "cross": return "Cross Training"; case "rest": return "Rest"; default: return type; } };
  const getTrainingTypeLabel = (tt: string) => { switch (tt) { case "SpeedRoad": return "Speed Workout - Road"; case "SpeedTrack": return "Speed Workout - Track"; case "Tempo": return "Tempo Runs"; case "Threshold": return "Threshold Runs"; case "LongRun": return "Long Run"; case "Easy": return "Easy Run"; case "Recovery": return "Recovery Run"; case "Hills": return "Hill Repeats"; case "Intervals": return "Intervals (Run/Walk)"; case "RacePace": return "Race Pace"; case "ClosePace": return "Close to Race Pace"; case "TimeTrial": return "Time Trial"; case "CrossTraining": return "Cross Training"; case "OrangeTheory": return "Cross Training"; case "Rest": return "Rest"; default: return tt; } };
  const getTypeColor = (type: string) => { switch (type) { case "run": return "border-accent/50 bg-accent/5"; case "cross": return "border-gold/50 bg-gold/5"; case "rest": return "border-green-500/50 bg-green-500/5"; default: return "border-white/10"; } };
  const getTypeBadge = (type: string) => { switch (type) { case "run": return "bg-accent/20 text-accent"; case "cross": return "bg-gold/20 text-gold"; case "rest": return "bg-green-500/20 text-green-400"; default: return "bg-gray-500/20 text-gray-400"; } };
  const getTrainingTypeBadge = (tt: string) => { switch (tt) { case "SpeedRoad": case "SpeedTrack": return "bg-red-500/20 text-red-400 border-red-500/30"; case "Tempo": case "Threshold": return "bg-orange-500/20 text-orange-400 border-orange-500/30"; case "LongRun": case "Easy": case "Recovery": return "bg-blue-500/20 text-blue-400 border-blue-500/30"; case "Hills": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; case "RacePace": case "ClosePace": return "bg-green-500/20 text-green-300 border-green-500/30"; case "Intervals": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"; case "TimeTrial": return "bg-red-500/20 text-red-300 border-red-500/30"; case "CrossTraining": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"; } };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="bg-secondary/50 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/IMG_5861.PNG" alt="Pistol Performance Coaching" width={50} height={50} />
            <div><h1 className="font-heading text-xl uppercase text-white">My Training</h1><p className="text-gray-400 text-sm">Pistol Performance Coaching</p></div>
          </div>
          <a href="/auth/signout" className="text-gray-400 hover:text-accent text-sm transition-colors">Logout</a>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {[{ key: "training", label: "Training" }, { key: "messages", label: "Messages" }, { key: "account", label: "Account" }].map((tab) => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key as typeof activeTab); if (tab.key === "messages") setUnreadCount(0); }} className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors relative ${activeTab === tab.key ? "text-accent border-b-2 border-accent" : "text-gray-400 hover:text-white"}`}>
              {tab.label}
              {tab.key === "messages" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* TRAINING TAB (merged with dashboard stats) */}
        {activeTab === "training" && (
          <>
            {/* Loading state */}
            {loadingWeeks && (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading your training...</p>
              </div>
            )}
            {!loadingWeeks && (<>
            {/* Current week badge */}
            {weekOffset === 0 && (
              <div className="text-center">
                <span className="inline-block bg-accent/10 border border-accent/30 rounded-lg py-1.5 px-4 text-accent font-heading text-xs uppercase">Current Week</span>
              </div>
            )}
            {weekOffset !== 0 && (
              <div className="text-center">
                <button onClick={() => setWeekOffset(0)} className="text-accent text-xs hover:underline">← Go to current week</button>
              </div>
            )}

            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <button onClick={() => setWeekOffset(weekOffset - 1)} disabled={weekOffset <= minOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
              <div className="text-center">
                <h2 className="font-heading text-2xl uppercase text-white">{getWeekLabel(weekOffset)}</h2>
                {currentWeek && <p className="text-gray-400 text-sm">{currentWeek.focus}{currentWeek.focus && ' — '}<span className="text-white font-medium">{weeklyTotal} miles</span></p>}
              </div>
              <button onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= maxOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>

            {/* No plan for this week */}
            {!currentWeek && (
              <div className="text-center py-8 bg-secondary/30 border border-white/10 rounded-xl">
                <p className="text-gray-400">No training plan published for this week.</p>
                {weekOffset === 0 && <p className="text-gray-500 text-sm mt-1">Check back soon or message Crystal.</p>}
              </div>
            )}

            {/* Has a plan — show stats + workouts */}
            {currentWeek && (<>
            <div className="bg-secondary/30 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm uppercase text-gray-400">Stats</h3>
                <div className="flex gap-1">
                  <button onClick={() => setStatsFilter("thisWeek")} className={`px-3 py-1 rounded text-xs ${statsFilter === "thisWeek" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>This Week</button>
                  <button onClick={() => setStatsFilter("allTime")} className={`px-3 py-1 rounded text-xs ${statsFilter === "allTime" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>All Time</button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center"><p className="font-heading text-xl text-accent">{statsMiles.toFixed(0)}</p><p className="text-gray-500 text-xs">Miles</p></div>
                <div className="text-center"><p className="font-heading text-xl text-white">{statsCompleted.length}/{statsWorkouts.length}</p><p className="text-gray-500 text-xs">Completed</p></div>
                <div className="text-center"><p className="font-heading text-xl text-gold">{statsAvgRpe()}</p><p className="text-gray-500 text-xs">Avg Effort</p></div>
                <div className="text-center"><p className="font-heading text-xl text-green-400">{statsWorkouts.length > 0 ? Math.round((statsCompleted.length / statsWorkouts.length) * 100) : 0}%</p><p className="text-gray-500 text-xs">Completion</p></div>
              </div>
            </div>

            {/* Coach Message */}
            {currentWeek.coachMessage && (
              <div className="bg-secondary/50 border border-gold/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
                  <div><p className="text-gold text-xs font-heading uppercase mb-1">Message from Crystal</p><p className="text-gray-300 text-sm leading-relaxed">{currentWeek.coachMessage}</p></div>
                </div>
              </div>
            )}

            {/* Workout Cards */}
            <div className="space-y-4">
              {currentWeek.workouts.map((workout) => (
                <div key={workout.id} className={`border rounded-2xl overflow-hidden transition-all ${getTypeColor(workout.type)} ${workout.completed ? "opacity-80" : ""}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Completion Status Indicator */}
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${workout.status === "complete" ? "bg-green-500 border-green-500" : workout.status === "partial" ? "bg-yellow-500 border-yellow-500" : workout.status === "skipped" ? "bg-red-500 border-red-500" : "border-gray-500"}`}>
                          {workout.status === "complete" && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          {workout.status === "partial" && <span className="text-white text-xs font-bold">½</span>}
                          {workout.status === "skipped" && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-white font-heading uppercase text-sm">{workout.day}</span>
                            <span className="text-gray-500 text-xs">{workout.date}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getTypeBadge(workout.type)}`}>{getTypeLabel(workout.type)}</span>
                            {workout.type === "run" && workout.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(workout.trainingType)}`}>{getTrainingTypeLabel(workout.trainingType)}</span>}
                          </div>
                          <h3 className={`font-bold mb-0.5 ${workout.completed ? "text-gray-400 line-through" : "text-white"}`}>{workout.title}</h3>
                          <p className="text-gray-400 text-sm">{workout.description}</p>
                          {workout.paceTarget && <p className="text-accent text-xs mt-1">Target: {workout.paceTarget}</p>}
                          {workout.location && <p className="text-gray-500 text-xs mt-0.5">{workout.location}</p>}
                          {workout.coachNotes && <div className="mt-2 bg-primary/50 border border-white/5 rounded-lg p-3"><p className="text-gold text-xs font-heading uppercase mb-1">Coach Notes</p><p className="text-gray-300 text-xs leading-relaxed">{workout.coachNotes}</p></div>}
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        {workout.miles && <div><p className="font-heading text-xl text-white">{workout.miles}</p><p className="text-gray-500 text-xs">miles</p></div>}
                      </div>
                    </div>
                    {/* Log toggle */}
                    {!workout.completed && weekOffset === 0 && expandedWorkout !== workout.id && showSkipDialog !== workout.id && (
                      <div className="mt-3 ml-9 flex items-center gap-2 flex-wrap">
                        <button onClick={() => setExpandedWorkout(workout.id)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          I Did This
                        </button>
                        <button onClick={() => { setShowSkipDialog(workout.id); setSkipType("partial"); }} className="border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 font-bold py-2 px-4 rounded-lg text-xs transition-colors">Partially Done</button>
                        <button onClick={() => { setShowSkipDialog(workout.id); setSkipType("skipped"); }} className="border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold py-2 px-4 rounded-lg text-xs transition-colors">I Skipped This</button>
                      </div>
                    )}
                    {expandedWorkout === workout.id && !workout.completed && (
                      <div className="mt-2 ml-9"><button onClick={() => setExpandedWorkout(null)} className="text-gray-400 hover:text-white text-xs">Cancel</button></div>
                    )}
                    {workout.status === "skipped" && workout.skipReason && (
                      <div className="mt-2 ml-9 bg-red-500/10 border border-red-500/20 rounded-lg p-2"><p className="text-red-400 text-xs"><span className="font-medium">Skipped:</span> {workout.skipReason}</p></div>
                    )}
                    {workout.status === "partial" && workout.skipReason && (
                      <div className="mt-2 ml-9 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2"><p className="text-yellow-400 text-xs"><span className="font-medium">Partially completed:</span> {workout.skipReason}</p></div>
                    )}
                    {workout.status === "complete" && workout.log && (
                      <div className="mt-3 ml-9 pl-4 border-l-2 border-green-500/30">
                        <div className="flex flex-wrap gap-3 text-xs">
                          {workout.log.rpe && <span><span className="text-gray-500">Effort:</span> <span className="text-white">{workout.log.rpe}/10</span></span>}
                          {workout.log.actualMiles && <span><span className="text-gray-500">Miles:</span> <span className="text-white">{workout.log.actualMiles}</span></span>}
                          {workout.log.actualPace && <span><span className="text-gray-500">Pace:</span> <span className="text-white">{workout.log.actualPace}</span></span>}
                          {workout.log.duration && <span><span className="text-gray-500">Duration:</span> <span className="text-white">{workout.log.duration}</span></span>}
                          {workout.log.stress && <span><span className="text-gray-500">Stress:</span> <span className="text-white">{workout.log.stress}</span></span>}
                          {workout.log.onPeriod === "yes" && <span className="text-pink-400 font-medium">On Period</span>}
                        </div>
                        {workout.log.notes && <p className="text-gray-400 text-xs mt-1">{workout.log.notes}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {workout.log.energy && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Energy: {workout.log.energy}</span>}
                          {workout.log.motivation && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Motivation: {workout.log.motivation}</span>}
                          {workout.log.sleep && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Sleep: {workout.log.sleep}</span>}
                          {workout.log.recovery && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Recovery: {workout.log.recovery}</span>}
                          {workout.log.mood && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Mood: {workout.log.mood}</span>}
                          {workout.log.hunger && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Appetite: {workout.log.hunger}</span>}
                          {workout.log.strength && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Body: {workout.log.strength}</span>}
                        </div>
                      </div>
                    )}

                    {/* Skip/Partial Dialog - direct, no toggle needed */}
                    {showSkipDialog === workout.id && (
                      <div className="mt-3 ml-9 bg-secondary/50 border border-white/10 rounded-xl p-4">
                        <p className={`text-sm font-medium mb-3 ${skipType === "skipped" ? "text-red-400" : "text-yellow-400"}`}>
                          {skipType === "skipped" ? "Why did you skip this workout?" : "What part did you complete?"}
                        </p>
                        <div className="mb-3">
                          <textarea value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={2} placeholder={skipType === "skipped" ? "e.g. Sick, injury, schedule conflict, too tired..." : "e.g. Did 4 miles instead of 7 — knee started hurting at mile 4"} />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => markSkipped(workout.id)} disabled={!skipReason || savingLog} className={`text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors ${!skipReason || savingLog ? "bg-gray-600 cursor-not-allowed" : skipType === "skipped" ? "bg-red-600 hover:bg-red-700" : "bg-yellow-600 hover:bg-yellow-700"}`}>{savingLog ? "Saving..." : skipType === "skipped" ? "Mark as Skipped" : "Mark as Partial"}</button>
                          <button onClick={() => { setShowSkipDialog(null); setSkipReason(""); }} className="text-gray-400 text-xs">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Log Form */}
                  {expandedWorkout === workout.id && (
                    <div className="border-t border-white/10 bg-primary/30 p-5">
                      <h4 className="font-heading text-sm uppercase text-accent mb-4">Your Workout Log</h4>

                      {/* RUN-specific fields */}
                      {workout.type === "run" && (
                        <>
                          <div className="bg-primary/50 border border-white/5 rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 mb-0.5"><span className="text-sm">💪</span><label className="text-gray-300 text-xs font-medium">How hard did this workout feel?</label></div>
                            <p className="text-gray-600 text-xs mb-2">1 = barely broke a sweat, 10 = gave everything I had</p>
                            <div className="flex items-center gap-3"><input type="range" min="1" max="10" value={workout.log?.rpe || ""} onChange={(e) => updateWorkoutLog(workout.id, "rpe", e.target.value)} className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" /><span className="text-white text-lg font-bold w-6 text-center">{workout.log?.rpe || "—"}</span></div>
                            <div className="flex justify-between mt-0.5"><span className="text-gray-600 text-xs">Barely felt it</span><span className="text-gray-600 text-xs">All-out effort</span></div>
                          </div>
                          <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <div><label className="text-gray-400 text-xs block mb-1">Actual Miles</label><input type="text" value={workout.log?.actualMiles || ""} onChange={(e) => updateWorkoutLog(workout.id, "actualMiles", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 7.2" /></div>
                            <div><label className="text-gray-400 text-xs block mb-1">Average Pace</label><input type="text" value={workout.log?.actualPace || ""} onChange={(e) => updateWorkoutLog(workout.id, "actualPace", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 8:45/mi" /></div>
                            <div><label className="text-gray-400 text-xs block mb-1">Stress Factors</label><input type="text" value={workout.log?.stress || ""} onChange={(e) => updateWorkoutLog(workout.id, "stress", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Travel, work, etc." /></div>
                          </div>
                        </>
                      )}

                      {/* CROSS TRAINING fields */}
                      {workout.type === "cross" && (
                        <>
                          <div className="bg-primary/50 border border-white/5 rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 mb-0.5"><span className="text-sm">💪</span><label className="text-gray-300 text-xs font-medium">How hard did this workout feel?</label></div>
                            <p className="text-gray-600 text-xs mb-2">1 = barely broke a sweat, 10 = gave everything I had</p>
                            <div className="flex items-center gap-3"><input type="range" min="1" max="10" value={workout.log?.rpe || ""} onChange={(e) => updateWorkoutLog(workout.id, "rpe", e.target.value)} className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" /><span className="text-white text-lg font-bold w-6 text-center">{workout.log?.rpe || "—"}</span></div>
                            <div className="flex justify-between mt-0.5"><span className="text-gray-600 text-xs">Barely felt it</span><span className="text-gray-600 text-xs">All-out effort</span></div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div><label className="text-gray-400 text-xs block mb-1">Duration</label><input type="text" value={workout.log?.duration || ""} onChange={(e) => updateWorkoutLog(workout.id, "duration", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 45 min" /></div>
                            <div><label className="text-gray-400 text-xs block mb-1">Stress Factors</label><input type="text" value={workout.log?.stress || ""} onChange={(e) => updateWorkoutLog(workout.id, "stress", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Travel, work, etc." /></div>
                          </div>
                        </>
                      )}

                      {/* REST fields */}
                      {workout.type === "rest" && (
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div><label className="text-gray-400 text-xs block mb-1">Stress Factors</label><input type="text" value={workout.log?.stress || ""} onChange={(e) => updateWorkoutLog(workout.id, "stress", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Travel, work, etc." /></div>
                          <div><label className="text-gray-400 text-xs block mb-1">Did you fully rest?</label><input type="text" value={workout.log?.notes || ""} onChange={(e) => updateWorkoutLog(workout.id, "notes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Yes, light walk, etc." /></div>
                        </div>
                      )}

                      {/* Notes (all types) */}
                      {workout.type !== "rest" && (
                        <div className="mb-4"><label className="text-gray-400 text-xs block mb-1">Notes</label><input type="text" value={workout.log?.notes || ""} onChange={(e) => updateWorkoutLog(workout.id, "notes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="How did it feel? Anything notable?" /></div>
                      )}

                      {/* Period tracking (female clients only) */}
                      <div className="mb-4 flex items-center gap-3">
                        <button onClick={() => updateWorkoutLog(workout.id, "onPeriod", (workout.log as Record<string, string> | undefined)?.onPeriod === "yes" ? "no" : "yes")} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${(workout.log as Record<string, string> | undefined)?.onPeriod === "yes" ? "bg-pink-500 border-pink-500" : "border-gray-500 hover:border-pink-400"}`}>{(workout.log as Record<string, string> | undefined)?.onPeriod === "yes" && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</button>
                        <span className="text-gray-400 text-xs">On period today</span>
                      </div>

                      {/* Body Check - Intuitive slider-style labels */}
                      <div className="border-t border-white/5 pt-4">
                        <p className="text-gold text-xs font-heading uppercase mb-1">How are you feeling today?</p>
                        <p className="text-gray-600 text-xs mb-3">Rate each from 1 (very poor) to 10 (excellent)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { key: "energy", label: "Energy Level", emoji: "⚡" },
                            { key: "motivation", label: "Motivation", emoji: "🔥" },
                            { key: "sleep", label: "Sleep Quality", emoji: "😴" },
                            { key: "recovery", label: "Recovery", emoji: "💪" },
                            { key: "mood", label: "Mood", emoji: "😊" },
                            { key: "hunger", label: "Appetite", emoji: "🍽" },
                            { key: "strength", label: "Body Feels", emoji: "🏃" },
                          ].map((field) => (
                            <div key={field.key} className="bg-primary/50 border border-white/5 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm">{field.emoji}</span>
                                <label className="text-gray-300 text-xs">{field.label}</label>
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="range" min="1" max="10" value={(workout.log as Record<string, string> | undefined)?.[field.key] || ""} onChange={(e) => updateWorkoutLog(workout.id, field.key, e.target.value)} className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                                <span className="text-white text-sm font-bold w-5 text-center">{(workout.log as Record<string, string> | undefined)?.[field.key] || "—"}</span>
                              </div>
                              <div className="flex justify-between mt-0.5"><span className="text-gray-600 text-xs">Poor</span><span className="text-gray-600 text-xs">Great</span></div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Save & Close */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                        <button onClick={() => setExpandedWorkout(null)} className="text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                        <button onClick={async () => { await toggleCompleted(workout.id); setExpandedWorkout(null); }} disabled={savingLog} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-8 rounded-lg text-sm transition-colors disabled:opacity-50">{savingLog ? "Saving..." : "Complete & Save"}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

          </>)}
          </>)}
          </>
        )}

        {/* MESSAGES TAB - Chat Style */}
        {activeTab === "messages" && (
          <div className="flex flex-col h-[calc(100vh-200px)] bg-secondary/20 border border-white/10 rounded-2xl overflow-hidden">
            {/* Chat Header */}
            <div className="px-5 py-3 border-b border-white/10 bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center"><span className="text-gold text-xs font-bold">C</span></div>
                <div><p className="text-white text-sm font-medium">Crystal</p><p className="text-gray-500 text-xs">Coach</p></div>
              </div>
            </div>

            {/* Messages Area - scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {clientMessages.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm">No messages yet.</p>
                  <p className="text-xs mt-1">Send Crystal a message below!</p>
                </div>
              )}
              {clientMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${msg.from === "client" ? "bg-accent rounded-2xl rounded-br-md" : "bg-secondary/80 border border-white/10 rounded-2xl rounded-bl-md"} px-4 py-2.5`}>
                    <p className={`text-sm ${msg.from === "client" ? "text-white" : "text-gray-200"}`}>{msg.message}</p>
                    <p className={`text-xs mt-1 ${msg.from === "client" ? "text-white/60" : "text-gray-500"}`}>{msg.date}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area - fixed at bottom */}
            <div className="px-4 py-3 border-t border-white/10 bg-secondary/50">
              <div className="flex items-end gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  className="flex-1 bg-primary/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent resize-none max-h-32"
                  rows={1}
                  placeholder="Type a message..."
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-accent hover:bg-red-700 text-white p-2.5 rounded-xl disabled:opacity-30 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT TAB */}
        {activeTab === "account" && (
          <div className="space-y-6">
            {/* Current Plan & Payment */}
            {clientInfo ? (
              <>
                <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                  <h2 className="font-heading text-xl uppercase text-accent mb-4">Your Plan</h2>
                  <div className="space-y-3 text-sm">
                    {clientInfo.goal && <div className="flex justify-between"><span className="text-gray-400">Goal:</span><span className="text-white font-medium">{clientInfo.goal}</span></div>}
                    {clientInfo.startDate && <div className="flex justify-between"><span className="text-gray-400">Start Date:</span><span className="text-white">{new Date(clientInfo.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
                    {clientInfo.planEnd && <div className="flex justify-between"><span className="text-gray-400">Plan End:</span><span className="text-white">{new Date(clientInfo.planEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
                  </div>
                </div>

                <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                  <h2 className="font-heading text-xl uppercase text-accent mb-4">Payment Status</h2>
                  {(clientInfo.owed - clientInfo.paid) > 0 ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-1"><svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><p className="text-red-400 text-sm font-medium">Balance Due</p></div>
                      <p className="text-gray-400 text-xs">You have an outstanding balance. Contact Crystal to arrange payment.</p>
                    </div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><p className="text-green-400 text-sm font-medium">All Paid Up!</p></div>
                    </div>
                  )}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Plan Cost:</span><span className="text-white">${clientInfo.owed.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Paid So Far:</span><span className="text-green-400">${clientInfo.paid.toFixed(2)}</span></div>
                    {(clientInfo.owed - clientInfo.paid) > 0 && <div className="flex justify-between border-t border-white/10 pt-3"><span className="text-gray-400">Remaining:</span><span className="text-red-400 font-bold">${(clientInfo.owed - clientInfo.paid).toFixed(2)}</span></div>}
                  </div>
                  <div className="w-full bg-primary/50 rounded-full h-2 mt-4"><div className={`h-2 rounded-full ${(clientInfo.owed - clientInfo.paid) > 0 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${clientInfo.owed > 0 ? Math.min(100, (clientInfo.paid / clientInfo.owed) * 100) : 100}%` }} /></div>
                  <p className="text-gray-600 text-xs mt-1 text-right">{clientInfo.owed > 0 ? Math.round((clientInfo.paid / clientInfo.owed) * 100) : 100}% paid</p>
                </div>
              </>
            ) : (
              <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6 text-center">
                <p className="text-gray-500">No active plan. Contact Crystal for details.</p>
              </div>
            )}

            {/* Plan History */}
            {allPlans.filter(p => p.status !== "active").length > 0 && (
              <details className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                <summary className="font-heading text-sm uppercase text-gray-400 cursor-pointer hover:text-white">
                  Plan History ({allPlans.filter(p => p.status !== "active").length})
                </summary>
                <div className="mt-4 space-y-4">
                  {allPlans.filter(p => p.status !== "active").map((plan, i) => (
                    <div key={i} className="border border-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {plan.goal && <span className="text-white text-sm font-medium">{plan.goal}</span>}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{plan.status}</span>
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs mb-2">
                        {new Date(plan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(plan.planEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Cost: ${plan.owed.toFixed(2)}</span>
                        <span className={`font-medium ${(plan.owed - plan.paid) > 0 ? "text-red-400" : "text-green-400"}`}>
                          {(plan.owed - plan.paid) > 0 ? `$${(plan.owed - plan.paid).toFixed(2)} due` : "Paid in full"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
