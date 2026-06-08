"use client";

import { useState } from "react";
import Image from "next/image";

type WorkoutLog = { rpe: string; stress: string; notes: string; energy: string; motivation: string; sleep: string; strength: string; recovery: string; mood: string; hunger: string; actualMiles?: string; actualPace?: string; onPeriod?: string; duration?: string; };
type WorkoutDay = { id: string; day: string; date: string; type: "run" | "cross" | "rest"; trainingType: string; title: string; miles: number | null; description: string; paceTarget?: string; location?: string; coachNotes?: string; completed: boolean; log?: WorkoutLog; };
type WeekData = { weekId: string; label: string; dateRange: string; focus: string; coachMessage: string; workouts: WorkoutDay[]; };

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"training" | "messages" | "account">("training");
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [newMessage, setNewMessage] = useState("");
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageViewIndex, setMessageViewIndex] = useState(0);
  const [statsFilter, setStatsFilter] = useState<"thisWeek" | "allTime">("thisWeek");

  const [clientMessages] = useState([
    { id: "m1", date: "Jun 9, 2026", from: "crystal", message: "Training is loaded. The two workouts are Tuesday and Thursday. The Descending 1200s workout will get sent to your watch." },
    { id: "m2", date: "Jun 8, 2026", from: "client", message: "War Eagle was great! Felt strong the whole time. Ready for a big week!" },
    { id: "m3", date: "Jun 2, 2026", from: "crystal", message: "Jeff will be here to guide you through hills week. Great job at War Eagle!" },
    { id: "m4", date: "Jun 1, 2026", from: "client", message: "Feeling good heading into War Eagle. Should I do anything different the day before?" },
  ]);

  const [clientInfo] = useState({ name: "Sarah M.", goal: "War Eagle 50K", planDuration: "July 26, 2026", startDate: "May 5, 2026", owed: 525.0, paid: 175.0, balance: 350.0 });

  const [weeks, setWeeks] = useState<WeekData[]>([
    {
      weekId: "week-current", label: "This Week", dateRange: "Jun 9 - Jun 15", focus: "Descending 1200s & Race Pace",
      coachMessage: "Training is loaded. Tuesday and Thursday are the key workouts. Don't start too fast on the 1200s — the point is to get 10 seconds faster each rep.",
      workouts: [
        { id: "w1-mon", day: "Monday", date: "Jun 9", type: "cross", trainingType: "CrossTraining", title: "Gym Session", miles: null, description: "Cross training class", completed: false },
        { id: "w1-tue", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "SpeedTrack", title: "Descending 1200s", miles: 8, description: "3 mi WU | Descending 1200s | 1 mi CD", paceTarget: "Reps from 8:30 down to 7:40", location: "Kickapoo Track", coachNotes: "Rep 1: 400@8:30, 400@8:20, 400@8:10, Recovery Jog. Each rep starts 10s faster.", completed: false },
        { id: "w1-wed", day: "Wednesday", date: "Jun 11", type: "run", trainingType: "Easy", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: false },
        { id: "w1-thu", day: "Thursday", date: "Jun 12", type: "run", trainingType: "ClosePace", title: "Close to Race Pace", miles: 10, description: "2 mi WU | 7mi @ 8:50 | 1 CD", paceTarget: "8:50/mi", completed: false },
        { id: "w1-fri", day: "Friday", date: "Jun 13", type: "cross", trainingType: "CrossTraining", title: "Gym Session", miles: null, description: "Cross training class", completed: false },
        { id: "w1-sat", day: "Saturday", date: "Jun 14", type: "run", trainingType: "LongRun", title: "Long Run", miles: 17, description: "17 mi default pace", completed: false },
        { id: "w1-sun", day: "Sunday", date: "Jun 15", type: "run", trainingType: "Recovery", title: "Recovery Run", miles: 7, description: "7 easy recovery", completed: false },
      ],
    },
    {
      weekId: "week-prev", label: "Last Week", dateRange: "Jun 2 - Jun 8", focus: "Hills & Specificity",
      coachMessage: "Specificity training on hills. Jeff will guide you on technique.",
      workouts: [
        { id: "w2-mon", day: "Monday", date: "Jun 2", type: "cross", trainingType: "CrossTraining", title: "Bike / Strength", miles: null, description: "30 min bike, upper body strength circuit", completed: true, log: { rpe: "6", stress: "", notes: "Felt good", energy: "7", motivation: "8", sleep: "7", strength: "7", recovery: "6", mood: "8", hunger: "7", duration: "45 min" } },
        { id: "w2-tue", day: "Tuesday", date: "Jun 3", type: "run", trainingType: "Hills", title: "HILLS - Technique Day", miles: 7, description: "2 WU | 1 down | 1 up | 1 down | 1 up | 1 CD", paceTarget: "Downhill close to race pace", location: "Hills", completed: true, log: { rpe: "8", stress: "", notes: "Jeff was great help", energy: "8", motivation: "9", sleep: "7", strength: "7", recovery: "7", mood: "9", hunger: "6", actualMiles: "7.2", actualPace: "8:45", onPeriod: "yes" } },
        { id: "w2-wed", day: "Wednesday", date: "Jun 4", type: "run", trainingType: "Easy", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: true, log: { rpe: "4", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "6", recovery: "7", mood: "7", hunger: "8", onPeriod: "yes" } },
        { id: "w2-thu", day: "Thursday", date: "Jun 5", type: "run", trainingType: "SpeedRoad", title: "Strides", miles: 7, description: "7 mi w/strides", completed: true, log: { rpe: "7", stress: "", notes: "Legs heavy from hills", energy: "6", motivation: "7", sleep: "6", strength: "6", recovery: "5", mood: "7", hunger: "7" } },
        { id: "w2-fri", day: "Friday", date: "Jun 6", type: "cross", trainingType: "CrossTraining", title: "Bike / Strength", miles: null, description: "Bike and upper body.", completed: true, log: { rpe: "5", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "7", recovery: "7", mood: "8", hunger: "7", duration: "40 min" } },
        { id: "w2-sat", day: "Saturday", date: "Jun 7", type: "run", trainingType: "RacePace", title: "Race Pace Workout", miles: 12, description: "5 WU | 5@9:15 (2 min rest) | 2 CD", paceTarget: "9:15/mi", completed: true, log: { rpe: "9", stress: "Travel Day", notes: "War Eagle!", energy: "8", motivation: "9", sleep: "7", strength: "8", recovery: "6", mood: "9", hunger: "8", actualMiles: "12.1", actualPace: "9:12" } },
        { id: "w2-sun", day: "Sunday", date: "Jun 8", type: "rest", trainingType: "Rest", title: "Complete Rest", miles: null, description: "Rest day.", completed: true, log: { rpe: "", stress: "", notes: "Great week", energy: "8", motivation: "8", sleep: "9", strength: "7", recovery: "8", mood: "9", hunger: "7" } },
      ],
    },
  ]);

  const currentWeek = weeks[currentWeekIndex];
  const weeklyTotal = currentWeek.workouts.reduce((sum, day) => sum + (day.miles || 0), 0);
  const completedCount = currentWeek.workouts.filter((w) => w.completed).length;
  const allWorkouts = weeks.flatMap((w) => w.workouts);
  const allCompleted = allWorkouts.filter((w) => w.completed);
  const statsWorkouts = statsFilter === "thisWeek" ? currentWeek.workouts : allWorkouts;
  const statsCompleted = statsWorkouts.filter(w => w.completed);
  const statsMiles = statsCompleted.reduce((s, w) => s + (Number(w.log?.actualMiles) || w.miles || 0), 0);
  const statsAvgRpe = () => { const withRpe = statsCompleted.filter(w => w.log?.rpe); if (withRpe.length === 0) return "—"; return (withRpe.reduce((a, w) => a + Number(w.log!.rpe), 0) / withRpe.length).toFixed(1); };

  const toggleCompleted = (workoutId: string) => { const updated = [...weeks]; const workout = updated[currentWeekIndex].workouts.find((w) => w.id === workoutId); if (workout) { workout.completed = !workout.completed; setWeeks(updated); } };
  const updateWorkoutLog = (workoutId: string, field: string, value: string) => { const updated = [...weeks]; const workout = updated[currentWeekIndex].workouts.find((w) => w.id === workoutId); if (workout) { if (!workout.log) { workout.log = { rpe: "", stress: "", notes: "", energy: "", motivation: "", sleep: "", strength: "", recovery: "", mood: "", hunger: "" }; } (workout.log as Record<string, string>)[field] = value; setWeeks(updated); } };

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
          <a href="/" className="text-gray-400 hover:text-accent text-sm transition-colors">Logout</a>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {[{ key: "training", label: "Training" }, { key: "messages", label: "Messages" }, { key: "account", label: "Account" }].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors ${activeTab === tab.key ? "text-accent border-b-2 border-accent" : "text-gray-400 hover:text-white"}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* TRAINING TAB (merged with dashboard stats) */}
        {activeTab === "training" && (
          <>
            {/* Stats Summary (collapsible, filter toggles) */}
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

            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <button onClick={() => setCurrentWeekIndex(Math.min(currentWeekIndex + 1, weeks.length - 1))} disabled={currentWeekIndex >= weeks.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
              <div className="text-center"><h2 className="font-heading text-2xl uppercase text-white">{currentWeek.label}</h2><p className="text-gray-400 text-sm">{currentWeek.dateRange} &mdash; {currentWeek.focus}</p></div>
              <button onClick={() => setCurrentWeekIndex(Math.max(currentWeekIndex - 1, 0))} disabled={currentWeekIndex <= 0} className="text-gray-400 hover:text-white disabled:opacity-30"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
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
                        {/* Completion */}
                        <button onClick={() => toggleCompleted(workout.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${workout.completed ? "bg-green-500 border-green-500" : "border-gray-500 hover:border-green-500"}`}>
                          {workout.completed && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </button>
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
                    <div className="mt-3 ml-9"><button onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)} className="text-xs text-gray-400 hover:text-accent transition-colors">{expandedWorkout === workout.id ? "Close Log" : "Log This Workout"}</button></div>
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
                            <div className="flex items-center gap-3"><input type="range" min="1" max="10" value={workout.log?.rpe || "5"} onChange={(e) => updateWorkoutLog(workout.id, "rpe", e.target.value)} className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" /><span className="text-white text-lg font-bold w-6 text-center">{workout.log?.rpe || "—"}</span></div>
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
                            <div className="flex items-center gap-3"><input type="range" min="1" max="10" value={workout.log?.rpe || "5"} onChange={(e) => updateWorkoutLog(workout.id, "rpe", e.target.value)} className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" /><span className="text-white text-lg font-bold w-6 text-center">{workout.log?.rpe || "—"}</span></div>
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
                                <input type="range" min="1" max="10" value={(workout.log as Record<string, string> | undefined)?.[field.key] || "5"} onChange={(e) => updateWorkoutLog(workout.id, field.key, e.target.value)} className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
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
                        <button onClick={() => { toggleCompleted(workout.id); setExpandedWorkout(null); }} className="bg-accent hover:bg-red-700 text-white font-bold py-2.5 px-8 rounded-lg text-sm transition-colors">Save Log</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-right"><span className="text-gray-400 text-sm">Week Total: </span><span className="text-white font-heading text-lg">{weeklyTotal} miles</span></div>
          </>
        )}

        {/* MESSAGES TAB */}
        {activeTab === "messages" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-2xl uppercase text-white">Messages</h2>
              {!showMessageForm && <button onClick={() => setShowMessageForm(true)} className="bg-accent hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg">+ New Message</button>}
            </div>
            {showMessageForm && (
              <div className="bg-secondary/50 border border-accent/30 rounded-xl p-5 mb-6">
                <p className="text-accent text-xs font-heading uppercase mb-2">Message Crystal</p>
                <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={3} placeholder="Ask a question, share an update..." />
                <div className="flex gap-3 mt-3"><button className="bg-accent text-white font-bold py-2 px-6 rounded-lg text-sm">Send</button><button onClick={() => { setShowMessageForm(false); setNewMessage(""); }} className="text-gray-400 text-sm">Cancel</button></div>
              </div>
            )}
            <div className="space-y-4">
              {clientMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 ${msg.from === "client" ? "bg-accent/10 border border-accent/30" : "bg-secondary/50 border border-gold/20"}`}>
                    <div className="flex items-center gap-2 mb-1"><span className={`text-xs font-heading uppercase ${msg.from === "client" ? "text-accent" : "text-gold"}`}>{msg.from === "client" ? "You" : "Crystal"}</span><span className="text-gray-500 text-xs">{msg.date}</span></div>
                    <p className="text-gray-300 text-sm">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ACCOUNT TAB */}
        {activeTab === "account" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h2 className="font-heading text-xl uppercase text-accent mb-4">Your Plan</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Name:</span><span className="text-white">{clientInfo.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Goal:</span><span className="text-white">{clientInfo.goal}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Plan Duration:</span><span className="text-white">{clientInfo.planDuration}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Start Date:</span><span className="text-white">{clientInfo.startDate}</span></div>
              </div>
            </div>
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h2 className="font-heading text-xl uppercase text-accent mb-4">Payment</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Owed:</span><span className="text-white">${clientInfo.owed.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Paid:</span><span className="text-green-400">${clientInfo.paid.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-white/10 pt-3"><span className="text-gray-400">Balance:</span><span className="text-white font-bold">${clientInfo.balance.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
