"use client";

import { useState } from "react";
import Image from "next/image";

type WorkoutDay = {
  id: string;
  day: string;
  date: string;
  type: "run" | "cross" | "rest";
  trainingType: string;
  title: string;
  miles: number | null;
  description: string;
  paceTarget?: string;
  location?: string;
  coachNotes?: string;
  completed: boolean;
  log?: WorkoutLog;
};

type WorkoutLog = {
  rpe: string;
  stress: string;
  notes: string;
  energy: string;
  motivation: string;
  sleep: string;
  strength: string;
  recovery: string;
  mood: string;
  hunger: string;
  actualMiles?: string;
  actualPace?: string;
};

type WeekData = {
  weekId: string;
  label: string;
  dateRange: string;
  focus: string;
  coachMessage: string;
  workouts: WorkoutDay[];
};

type FilterOptions = {
  type: "all" | "run" | "cross" | "rest";
  completed: "all" | "yes" | "no";
  timeRange: "all" | "thisWeek" | "lastWeek" | "lastMonth";
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"training" | "stats" | "messages" | "account">("training");
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [newMessage, setNewMessage] = useState("");
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageViewIndex, setMessageViewIndex] = useState(0);

  const [clientMessages] = useState([
    { id: "m1", date: "Jun 9, 2026", from: "crystal", message: "Training is loaded. The two workouts are Tuesday and Thursday. The Descending 1200s workout will get sent to your watch. The important piece is to not start out too fast — the point is to get 10 seconds faster at each 400." },
    { id: "m2", date: "Jun 8, 2026", from: "client", message: "War Eagle was great! Felt strong the whole time. Ready for a big week!" },
    { id: "m3", date: "Jun 2, 2026", from: "crystal", message: "I'm giving you this week of training a week ahead, because I will be gone. But Jeff will be here to guide you through it. This week will be more specificity training on hills. Hope you have a great week in Colorado!" },
    { id: "m4", date: "Jun 1, 2026", from: "client", message: "Feeling good heading into War Eagle. Should I do anything different the day before?" },
    { id: "m5", date: "May 26, 2026", from: "crystal", message: "Easy taper week. Trust the training. You're ready for War Eagle. Keep the legs fresh and the mind calm." },
  ]);
  const [filters, setFilters] = useState<FilterOptions>({ type: "all", completed: "all", timeRange: "all" });

  const [clientInfo] = useState({
    name: "Client Name",
    goal: "War Eagle 50K",
    planDuration: "July 26",
    startDate: "May 5, 2026",
    owed: 525.0,
    paid: 175.0,
    balance: 0.0,
  });

  const [weeks, setWeeks] = useState<WeekData[]>([
    {
      weekId: "week-current",
      label: "This Week",
      dateRange: "Jun 9 - Jun 15",
      focus: "Descending 1200s & Race Pace",
      coachMessage: "Training is loaded. The two workouts are Tuesday and Thursday. The Descending 1200s workout will get sent to your watch. The important piece is to not start out too fast — the point is to get 10 seconds faster at each 400. Recovery can be as slow as you need to jog, but try to not walk unless it's for a couple of breaths, then get the lactic acid moving again.",
      workouts: [
        { id: "w1-mon", day: "Monday", date: "Jun 9", type: "cross", trainingType: "OT", title: "Orange Theory", miles: null, description: "OT class", completed: false },
        { id: "w1-tue", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "Speed", title: "Descending 1200s", miles: 8, description: "Kickapoo Track - 3 mi WU | Descending 1200s | 1 mi CD", paceTarget: "Reps from 8:30 down to 7:40", location: "Kickapoo Track", coachNotes: "Rep 1: 400@8:30, 400@8:20, 400@8:10, Recovery. Rep 2: 400@8:20, 400@8:10, 400@8:00, Recovery. Rep 3: 400@8:10, 400@8:00, 400@7:50, Recovery. Rep 4: 400@8:00, 400@7:50, 400@7:40 or faster, Recovery. I hope you enjoy this workout — it was one of my favorite ones. Do it on a track if possible.", completed: false },
        { id: "w1-wed", day: "Wednesday", date: "Jun 11", type: "run", trainingType: "LR", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: false },
        { id: "w1-thu", day: "Thursday", date: "Jun 12", type: "run", trainingType: "Tempo", title: "Race Pace", miles: 10, description: "2 mi WU | 2@8:40 | 2@8:20 | 2@8:40 | 1 CD", paceTarget: "8:20-8:40/mi", coachNotes: "Pretty cut and dry — 2mi warm up, 7mi at close to race pace at 8:50, 1mi cool down.", completed: false },
        { id: "w1-fri", day: "Friday", date: "Jun 13", type: "cross", trainingType: "OT", title: "Orange Theory", miles: null, description: "OT class", completed: false },
        { id: "w1-sat", day: "Saturday", date: "Jun 14", type: "run", trainingType: "LR", title: "Long Run", miles: 17, description: "17 mi default pace", completed: false },
        { id: "w1-sun", day: "Sunday", date: "Jun 15", type: "run", trainingType: "LR", title: "Easy Recovery", miles: 7, description: "7 easy recovery", completed: false },
      ],
    },
    {
      weekId: "week-prev",
      label: "Last Week",
      dateRange: "Jun 2 - Jun 8",
      focus: "Hills & Specificity",
      coachMessage: "This week will be more specificity training on hills — Tuesday will be location specific. Jeff will be here to guide you through it.",
      workouts: [
        { id: "w2-mon", day: "Monday", date: "Jun 2", type: "cross", trainingType: "CT", title: "Bike / Strength", miles: null, description: "Cross training day. Bike and strength work.", completed: true, log: { rpe: "6", stress: "", notes: "Felt good", energy: "7", motivation: "8", sleep: "7", strength: "7", recovery: "6", mood: "8", hunger: "7" } },
        { id: "w2-tue", day: "Tuesday", date: "Jun 3", type: "run", trainingType: "Speed", title: "HILLS - Technique Day", miles: 7, description: "2 WU | 1 down | 1 up | 1 down | 1 up | 1 CD", paceTarget: "Downhill close to race pace", location: "Location specific hills", coachNotes: "This first training day is for technique. Jeff will run the downs with you to help coach you on keeping head up, not leaning too far forward, but yet allowing gravity to help you down, without falling.", completed: true, log: { rpe: "8", stress: "", notes: "Jeff was great help", energy: "8", motivation: "9", sleep: "7", strength: "7", recovery: "7", mood: "9", hunger: "6", actualMiles: "7.2", actualPace: "8:45" } },
        { id: "w2-wed", day: "Wednesday", date: "Jun 4", type: "run", trainingType: "LR", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: true, log: { rpe: "4", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "6", recovery: "7", mood: "7", hunger: "8" } },
        { id: "w2-thu", day: "Thursday", date: "Jun 5", type: "run", trainingType: "Speed", title: "Strides", miles: 7, description: "7 mi w/strides", completed: true, log: { rpe: "7", stress: "", notes: "Legs felt heavy from hills", energy: "6", motivation: "7", sleep: "6", strength: "6", recovery: "5", mood: "7", hunger: "7" } },
        { id: "w2-fri", day: "Friday", date: "Jun 6", type: "cross", trainingType: "CT", title: "Bike / Strength", miles: null, description: "Cross training day. Bike and strength work.", completed: true, log: { rpe: "5", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "7", recovery: "7", mood: "8", hunger: "7" } },
        { id: "w2-sat", day: "Saturday", date: "Jun 7", type: "run", trainingType: "Tempo", title: "Race Pace Workout", miles: 12, description: "5 WU | 5 mi @ 9:15 (2 min rest between miles) | 2 CD", paceTarget: "9:15/mi race pace", coachNotes: "12 mi total workout at race pace.", completed: true, log: { rpe: "9", stress: "Travel Day", notes: "War Eagle! Fun easy run.", energy: "8", motivation: "9", sleep: "7", strength: "8", recovery: "6", mood: "9", hunger: "8", actualMiles: "12.1", actualPace: "9:12" } },
        { id: "w2-sun", day: "Sunday", date: "Jun 8", type: "rest", trainingType: "Rest", title: "Complete Rest", miles: null, description: "Complete rest day.", completed: true, log: { rpe: "", stress: "", notes: "Great week overall", energy: "8", motivation: "8", sleep: "9", strength: "7", recovery: "8", mood: "9", hunger: "7" } },
      ],
    },
  ]);

  const currentWeek = weeks[currentWeekIndex];
  const weeklyTotal = currentWeek.workouts.reduce((sum, day) => sum + (day.miles || 0), 0);
  const completedCount = currentWeek.workouts.filter((w) => w.completed).length;

  const toggleCompleted = (workoutId: string) => {
    const updatedWeeks = [...weeks];
    const workout = updatedWeeks[currentWeekIndex].workouts.find((w) => w.id === workoutId);
    if (workout) { workout.completed = !workout.completed; setWeeks(updatedWeeks); }
  };

  const updateWorkoutLog = (workoutId: string, field: string, value: string) => {
    const updatedWeeks = [...weeks];
    const workout = updatedWeeks[currentWeekIndex].workouts.find((w) => w.id === workoutId);
    if (workout) {
      if (!workout.log) { workout.log = { rpe: "", stress: "", notes: "", energy: "", motivation: "", sleep: "", strength: "", recovery: "", mood: "", hunger: "" }; }
      (workout.log as Record<string, string>)[field] = value;
      setWeeks(updatedWeeks);
    }
  };

  const allWorkouts = weeks.flatMap((w) => w.workouts);
  const completedWorkouts = allWorkouts.filter((w) => w.completed);
  const totalMilesCompleted = completedWorkouts.reduce((sum, w) => sum + (w.miles || 0), 0);
  const runWorkouts = completedWorkouts.filter((w) => w.type === "run");
  const crossWorkouts = completedWorkouts.filter((w) => w.type === "cross");

  const getFilteredWorkouts = () => {
    let filtered = allWorkouts;
    if (filters.type !== "all") filtered = filtered.filter((w) => w.type === filters.type);
    if (filters.completed === "yes") filtered = filtered.filter((w) => w.completed);
    else if (filters.completed === "no") filtered = filtered.filter((w) => !w.completed);
    if (filters.timeRange === "thisWeek") filtered = filtered.filter((w) => weeks[0].workouts.includes(w));
    else if (filters.timeRange === "lastWeek") filtered = filtered.filter((w) => weeks[1]?.workouts.includes(w));
    return filtered;
  };

  const avgRpe = () => {
    const withRpe = completedWorkouts.filter((w) => w.log?.rpe);
    if (withRpe.length === 0) return "—";
    return (withRpe.reduce((acc, w) => acc + Number(w.log!.rpe), 0) / withRpe.length).toFixed(1);
  };

  const getTypeColor = (type: string) => {
    switch (type) { case "run": return "border-accent/50 bg-accent/5"; case "cross": return "border-gold/50 bg-gold/5"; case "rest": return "border-green-500/50 bg-green-500/5"; default: return "border-white/10"; }
  };
  const getTypeBadge = (type: string) => {
    switch (type) { case "run": return "bg-accent/20 text-accent"; case "cross": return "bg-gold/20 text-gold"; case "rest": return "bg-green-500/20 text-green-400"; default: return "bg-gray-500/20 text-gray-400"; }
  };
  const getTypeLabel = (type: string) => {
    switch (type) { case "run": return "Run"; case "cross": return "Cross Training"; case "rest": return "Rest"; default: return type; }
  };
  const getTrainingTypeLabel = (tt: string) => {
    switch (tt) { case "Speed": return "Speed Workout"; case "SpeedRoad": return "Speed - Road"; case "SpeedTrack": return "Speed - Track"; case "Tempo": return "Tempo"; case "LR": return "Long Run"; case "LongRun": return "Long Run"; case "Easy": return "Easy Run"; case "Recovery": return "Recovery Run"; case "HR": return "Heart Rate"; case "Hills": return "Hill Repeats"; case "Intervals": return "Intervals"; case "RacePace": return "Race Pace"; case "ClosePace": return "Close to Race Pace"; case "Threshold": return "Threshold"; case "TimeTrial": return "Time Trial"; case "CT": return "Cross Training"; case "OT": return "Orange Theory"; default: return tt; }
  };
  const getTrainingTypeBadge = (tt: string) => {
    switch (tt) { case "Speed": case "SpeedRoad": case "SpeedTrack": return "bg-red-500/20 text-red-400 border-red-500/30"; case "Tempo": case "Threshold": return "bg-orange-500/20 text-orange-400 border-orange-500/30"; case "LR": case "LongRun": case "Easy": case "Recovery": return "bg-blue-500/20 text-blue-400 border-blue-500/30"; case "HR": return "bg-pink-500/20 text-pink-400 border-pink-500/30"; case "CT": case "OT": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; case "Hills": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; case "RacePace": case "ClosePace": return "bg-green-500/20 text-green-300 border-green-500/30"; case "Intervals": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"; case "TimeTrial": return "bg-red-500/20 text-red-300 border-red-500/30"; default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"; }
  };

  return (
    <div className="min-h-screen bg-primary">
      <header className="bg-secondary/50 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/IMG_5861.PNG" alt="Pistol Performance Coaching" width={50} height={50} />
            <div>
              <h1 className="font-heading text-xl uppercase text-white">Training Dashboard</h1>
              <p className="text-gray-400 text-sm">Pistol Performance Coaching</p>
            </div>
          </div>
          <a href="/" className="text-gray-400 hover:text-accent text-sm transition-colors">Logout</a>
        </div>
      </header>

      <div className="border-b border-white/10 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {[{ key: "training", label: "Training" }, { key: "stats", label: "Dashboard" }, { key: "messages", label: "Messages" }, { key: "account", label: "Account" }].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as "training" | "stats" | "messages" | "account")} className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors ${activeTab === tab.key ? "text-accent border-b-2 border-accent" : "text-gray-400 hover:text-white"}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {activeTab === "training" && (
          <>
            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <button onClick={() => setCurrentWeekIndex(Math.min(currentWeekIndex + 1, weeks.length - 1))} disabled={currentWeekIndex >= weeks.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="text-center">
                <h2 className="font-heading text-2xl uppercase text-white">{currentWeek.label}</h2>
                <p className="text-gray-400 text-sm">{currentWeek.dateRange} &mdash; {currentWeek.focus}</p>
              </div>
              <button onClick={() => setCurrentWeekIndex(Math.max(currentWeekIndex - 1, 0))} disabled={currentWeekIndex <= 0} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* Weekly Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center">
                <p className="font-heading text-2xl text-accent">{weeklyTotal}</p>
                <p className="text-gray-400 text-xs">Total Miles</p>
              </div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center">
                <p className="font-heading text-2xl text-white">{completedCount}/{currentWeek.workouts.length}</p>
                <p className="text-gray-400 text-xs">Completed</p>
              </div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center">
                <p className="font-heading text-2xl text-gold">{currentWeek.workouts.filter(w => w.type === "run").length}</p>
                <p className="text-gray-400 text-xs">Run Days</p>
              </div>
            </div>

            {/* Coach Message */}
            {currentWeek.coachMessage && (
              <div className="bg-secondary/50 border border-gold/30 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <div>
                    <p className="text-gold font-heading uppercase text-sm mb-1">Message from Crystal</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{currentWeek.coachMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Workout Cards */}
            <div className="space-y-4">
              {currentWeek.workouts.map((workout) => (
                <div key={workout.id} className={`border rounded-2xl overflow-hidden transition-all duration-300 ${getTypeColor(workout.type)} ${workout.completed ? "opacity-80" : ""}`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <button onClick={() => toggleCompleted(workout.id)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${workout.completed ? "bg-green-500 border-green-500" : "border-gray-500 hover:border-green-500"}`}>
                          {workout.completed && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-white font-heading text-lg uppercase">{workout.day}</span>
                            <span className="text-gray-500 text-sm">{workout.date}</span>
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(workout.type)}`}>{getTypeLabel(workout.type)}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(workout.trainingType)}`}>{getTrainingTypeLabel(workout.trainingType)}</span>
                            {workout.completed && <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Done</span>}
                          </div>
                          <h3 className={`font-bold text-lg mb-1 ${workout.completed ? "text-gray-300 line-through" : "text-white"}`}>{workout.title}</h3>
                          <p className="text-gray-300 text-sm">{workout.description}</p>
                          {workout.paceTarget && (
                            <div className="mt-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              <span className="text-accent text-sm font-medium">{workout.paceTarget}</span>
                            </div>
                          )}
                          {workout.location && (
                            <div className="mt-1 flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              <span className="text-gray-400 text-sm">{workout.location}</span>
                            </div>
                          )}
                          {workout.coachNotes && (
                            <div className="mt-3 bg-primary/50 border border-white/5 rounded-xl p-3">
                              <p className="text-gold text-xs font-heading uppercase mb-1">Coach Notes</p>
                              <p className="text-gray-300 text-sm leading-relaxed">{workout.coachNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0 flex flex-col items-end gap-2">
                        {workout.miles ? (<div><p className="font-heading text-2xl text-white">{workout.miles}</p><p className="text-gray-500 text-xs">miles</p></div>) : (
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                            {workout.type === "rest" ? <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            : <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                          </div>
                        )}
                        <button onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)} className="text-xs text-gray-400 hover:text-accent transition-colors">
                          {expandedWorkout === workout.id ? "Close Log" : "Log Workout"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {expandedWorkout === workout.id && (
                    <div className="border-t border-white/10 bg-primary/30 p-6">
                      <h4 className="font-heading text-sm uppercase text-accent mb-4">Your Log</h4>
                      <div className="grid md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">RPE (1-10)</label>
                          <input type="number" min="1" max="10" value={workout.log?.rpe || ""} onChange={(e) => updateWorkoutLog(workout.id, "rpe", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="1-10" />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Actual Miles</label>
                          <input type="text" value={workout.log?.actualMiles || ""} onChange={(e) => updateWorkoutLog(workout.id, "actualMiles", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 7.2" />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Actual Pace</label>
                          <input type="text" value={workout.log?.actualPace || ""} onChange={(e) => updateWorkoutLog(workout.id, "actualPace", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 8:45" />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Stress</label>
                          <input type="text" value={workout.log?.stress || ""} onChange={(e) => updateWorkoutLog(workout.id, "stress", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Travel, Work..." />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="text-gray-400 text-xs block mb-1">Notes</label>
                        <input type="text" value={workout.log?.notes || ""} onChange={(e) => updateWorkoutLog(workout.id, "notes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="How did it feel?" />
                      </div>
                      {/* Period tracking - only shown for female clients */}
                      <div className="mb-4 flex items-center gap-3">
                        <button
                          onClick={() => updateWorkoutLog(workout.id, "onPeriod", (workout.log as Record<string, string> | undefined)?.onPeriod === "yes" ? "no" : "yes")}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${(workout.log as Record<string, string> | undefined)?.onPeriod === "yes" ? "bg-pink-500 border-pink-500" : "border-gray-500 hover:border-pink-400"}`}
                        >
                          {(workout.log as Record<string, string> | undefined)?.onPeriod === "yes" && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </button>
                        <span className="text-gray-400 text-xs">On period today</span>
                      </div>
                      <div className="border-t border-white/5 pt-4">
                        <p className="text-gold text-xs font-heading uppercase mb-3">Body Check (1-10)</p>
                        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                          {[{ key: "energy", label: "Energy" }, { key: "motivation", label: "Motivation" }, { key: "sleep", label: "Sleep" }, { key: "strength", label: "Strength" }, { key: "recovery", label: "Recovery" }, { key: "mood", label: "Mood" }, { key: "hunger", label: "Hunger" }].map((field) => (
                            <div key={field.key}>
                              <label className="text-gray-500 text-xs block mb-1 text-center">{field.label}</label>
                              <input type="number" min="1" max="10" value={(workout.log as Record<string, string> | undefined)?.[field.key] || ""} onChange={(e) => updateWorkoutLog(workout.id, field.key, e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-accent" placeholder="—" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "stats" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-5 text-center"><p className="font-heading text-3xl text-accent">{totalMilesCompleted}</p><p className="text-gray-400 text-xs mt-1">Total Miles</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-5 text-center"><p className="font-heading text-3xl text-white">{completedWorkouts.length}</p><p className="text-gray-400 text-xs mt-1">Workouts Done</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-5 text-center"><p className="font-heading text-3xl text-gold">{avgRpe()}</p><p className="text-gray-400 text-xs mt-1">Avg RPE</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-5 text-center"><p className="font-heading text-3xl text-green-400">{allWorkouts.length > 0 ? Math.round((completedWorkouts.length / allWorkouts.length) * 100) : 0}%</p><p className="text-gray-400 text-xs mt-1">Completion Rate</p></div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-secondary/50 border border-accent/20 rounded-xl p-5"><p className="text-accent font-heading uppercase text-sm mb-2">Running</p><p className="text-white text-2xl font-heading">{runWorkouts.length} runs</p><p className="text-gray-400 text-sm">{runWorkouts.reduce((s, w) => s + (w.miles || 0), 0)} miles total</p></div>
              <div className="bg-secondary/50 border border-gold/20 rounded-xl p-5"><p className="text-gold font-heading uppercase text-sm mb-2">Cross Training</p><p className="text-white text-2xl font-heading">{crossWorkouts.length} sessions</p><p className="text-gray-400 text-sm">OT, Bike, etc.</p></div>
              <div className="bg-secondary/50 border border-green-500/20 rounded-xl p-5"><p className="text-green-400 font-heading uppercase text-sm mb-2">Rest Days</p><p className="text-white text-2xl font-heading">{completedWorkouts.filter(w => w.type === "rest").length} days</p><p className="text-gray-400 text-sm">Recovery matters</p></div>
            </div>
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h3 className="font-heading text-lg uppercase text-white mb-4">Workout History</h3>
              <div className="flex flex-wrap gap-3 mb-6">
                <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as FilterOptions["type"] })} className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="all">All Types</option><option value="run">Running</option><option value="cross">Cross Training</option><option value="rest">Rest</option></select>trength">Strength</option><option value="rest">Rest</option></select>
                <select value={filters.completed} onChange={(e) => setFilters({ ...filters, completed: e.target.value as FilterOptions["completed"] })} className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="all">All Status</option><option value="yes">Completed</option><option value="no">Not Completed</option></select>
                <select value={filters.timeRange} onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as FilterOptions["timeRange"] })} className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="all">All Time</option><option value="thisWeek">This Week</option><option value="lastWeek">Last Week</option></select>
              </div>
              <div className="space-y-3">
                {getFilteredWorkouts().map((workout) => (
                  <div key={workout.id} className="flex items-center justify-between bg-primary/30 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${workout.completed ? "bg-green-500" : "bg-gray-500"}`} />
                      <div><p className="text-white text-sm font-medium">{workout.title}</p><p className="text-gray-400 text-xs">{workout.day}, {workout.date}</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(workout.trainingType)}`}>{getTrainingTypeLabel(workout.trainingType)}</span>
                      {workout.miles && <span className="text-white text-sm font-heading">{workout.miles} mi</span>}
                      {workout.log?.rpe && <span className="text-gray-400 text-xs">RPE: {workout.log.rpe}</span>}
                    </div>
                  </div>
                ))}
                {getFilteredWorkouts().length === 0 && <p className="text-gray-500 text-sm text-center py-8">No workouts match your filters.</p>}
              </div>
            </div>
          </>
        )}

        {activeTab === "messages" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading text-2xl uppercase text-white">Messages</h2>
                <p className="text-gray-400 text-sm">Chat with Crystal</p>
              </div>
              {!showMessageForm && (
                <button onClick={() => setShowMessageForm(true)} className="bg-accent hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">+ New Message</button>
              )}
            </div>

            {/* Send Message */}
            {showMessageForm && (
              <div className="bg-secondary/50 border border-accent/30 rounded-2xl p-6 mb-6">
                <p className="text-accent text-xs font-heading uppercase mb-3">Send Message to Crystal</p>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-accent resize-none"
                  rows={4}
                  placeholder="Ask a question, share an update, let Crystal know how you're feeling..."
                />
                <div className="flex gap-3 mt-3">
                  <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors">Send</button>
                  <button onClick={() => { setShowMessageForm(false); setNewMessage(""); }} className="text-gray-400 hover:text-white text-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Message Thread */}
            <div className="space-y-4">
              {clientMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 ${msg.from === "client" ? "bg-accent/10 border border-accent/30" : "bg-secondary/50 border border-gold/20"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-heading uppercase ${msg.from === "client" ? "text-accent" : "text-gold"}`}>
                        {msg.from === "client" ? "You" : "Crystal"}
                      </span>
                      <span className="text-gray-500 text-xs">{msg.date}</span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "account" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h2 className="font-heading text-xl uppercase text-accent mb-4">Your Plan</h2>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-400">Name:</span><span className="text-white font-medium">{clientInfo.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Goal:</span><span className="text-white font-medium">{clientInfo.goal}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Plan Duration:</span><span className="text-white">{clientInfo.planDuration}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Start Date:</span><span className="text-white">{clientInfo.startDate}</span></div>
              </div>
            </div>
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h2 className="font-heading text-xl uppercase text-accent mb-4">Payment</h2>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-400">Owed:</span><span className="text-white font-medium">${clientInfo.owed.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Paid:</span><span className="text-green-400 font-medium">${clientInfo.paid.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-white/10 pt-3"><span className="text-gray-400">Balance:</span><span className="text-white font-bold">${clientInfo.balance.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
