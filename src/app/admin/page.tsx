"use client";

import { useState } from "react";
import Image from "next/image";

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

type WorkoutDay = {
  id: string;
  day: string;
  date: string;
  type: "run" | "cross" | "strength" | "rest";
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

type WeekData = {
  weekId: string;
  label: string;
  dateRange: string;
  focus: string;
  coachMessage: string;
  workouts: WorkoutDay[];
};

type Client = {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  planDuration: string;
  owed: number;
  paid: number;
  weeks: WeekData[];
};

export default function AdminPage() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<"plan" | "logs" | "create">("plan");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [showAddWorkout, setShowAddWorkout] = useState(false);

  const [clients] = useState<Client[]>([
    {
      id: "c1",
      name: "Sarah M.",
      goal: "War Eagle 50K",
      startDate: "May 5, 2026",
      planDuration: "July 26",
      owed: 525,
      paid: 175,
      weeks: [
        {
          weekId: "week-current",
          label: "This Week",
          dateRange: "Jun 9 - Jun 15",
          focus: "Descending 1200s & Race Pace",
          coachMessage: "Training is loaded. The two workouts are Tuesday and Thursday. The Descending 1200s workout will get sent to your watch. The important piece is to not start out too fast — the point is to get 10 seconds faster at each 400.",
          workouts: [
            { id: "w1-mon", day: "Monday", date: "Jun 9", type: "cross", trainingType: "OT", title: "Orange Theory", miles: null, description: "OT class", completed: false },
            { id: "w1-tue", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "Speed", title: "Descending 1200s", miles: 8, description: "3 mi WU | Descending 1200s | 1 mi CD", paceTarget: "Reps from 8:30 down to 7:40", location: "Kickapoo Track", coachNotes: "Rep 1: 400@8:30, 400@8:20, 400@8:10, Recovery. Rep 2: 400@8:20, 400@8:10, 400@8:00, Recovery. Rep 3: 400@8:10, 400@8:00, 400@7:50, Recovery. Rep 4: 400@8:00, 400@7:50, 400@7:40 or faster, Recovery.", completed: false },
            { id: "w1-wed", day: "Wednesday", date: "Jun 11", type: "run", trainingType: "LR", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: false },
            { id: "w1-thu", day: "Thursday", date: "Jun 12", type: "run", trainingType: "Tempo", title: "Race Pace", miles: 10, description: "2 mi WU | 2@8:40 | 2@8:20 | 2@8:40 | 1 CD", paceTarget: "8:20-8:40/mi", coachNotes: "2mi warm up, 7mi at close to race pace at 8:50, 1mi cool down.", completed: false },
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
          coachMessage: "This week will be more specificity training on hills — Tuesday will be location specific.",
          workouts: [
            { id: "w2-mon", day: "Monday", date: "Jun 2", type: "strength", trainingType: "CT", title: "Bike / Strength", miles: null, description: "Bike and strength work.", completed: true, log: { rpe: "6", stress: "", notes: "Felt good", energy: "7", motivation: "8", sleep: "7", strength: "7", recovery: "6", mood: "8", hunger: "7" } },
            { id: "w2-tue", day: "Tuesday", date: "Jun 3", type: "run", trainingType: "Speed", title: "HILLS - Technique Day", miles: 7, description: "2 WU | 1 down | 1 up | 1 down | 1 up | 1 CD", paceTarget: "Downhill close to race pace", location: "Location specific hills", coachNotes: "Technique day. Jeff will coach keeping head up, not leaning too far forward, allowing gravity to help.", completed: true, log: { rpe: "8", stress: "", notes: "Jeff was great help", energy: "8", motivation: "9", sleep: "7", strength: "7", recovery: "7", mood: "9", hunger: "6", actualMiles: "7.2", actualPace: "8:45" } },
            { id: "w2-wed", day: "Wednesday", date: "Jun 4", type: "run", trainingType: "LR", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: true, log: { rpe: "4", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "6", recovery: "7", mood: "7", hunger: "8" } },
            { id: "w2-thu", day: "Thursday", date: "Jun 5", type: "run", trainingType: "Speed", title: "Strides", miles: 7, description: "7 mi w/strides", completed: true, log: { rpe: "7", stress: "", notes: "Legs heavy from hills", energy: "6", motivation: "7", sleep: "6", strength: "6", recovery: "5", mood: "7", hunger: "7" } },
            { id: "w2-fri", day: "Friday", date: "Jun 6", type: "strength", trainingType: "CT", title: "Bike / Strength", miles: null, description: "Bike and strength work.", completed: true, log: { rpe: "5", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "7", recovery: "7", mood: "8", hunger: "7" } },
            { id: "w2-sat", day: "Saturday", date: "Jun 7", type: "run", trainingType: "Tempo", title: "Race Pace Workout", miles: 12, description: "5 WU | 5 mi @ 9:15 (2 min rest) | 2 CD", paceTarget: "9:15/mi", completed: true, log: { rpe: "9", stress: "Travel Day", notes: "War Eagle!", energy: "8", motivation: "9", sleep: "7", strength: "8", recovery: "6", mood: "9", hunger: "8", actualMiles: "12.1", actualPace: "9:12" } },
            { id: "w2-sun", day: "Sunday", date: "Jun 8", type: "rest", trainingType: "Rest", title: "Complete Rest", miles: null, description: "Complete rest day.", completed: true, log: { rpe: "", stress: "", notes: "Great week overall", energy: "8", motivation: "8", sleep: "9", strength: "7", recovery: "8", mood: "9", hunger: "7" } },
          ],
        },
      ],
    },
    {
      id: "c2",
      name: "Mike T.",
      goal: "Sub-4 Marathon",
      startDate: "Apr 1, 2026",
      planDuration: "Oct 12",
      owed: 400,
      paid: 400,
      weeks: [
        {
          weekId: "week-current",
          label: "This Week",
          dateRange: "Jun 9 - Jun 15",
          focus: "Tempo & Long Run",
          coachMessage: "Big week ahead. Tuesday tempo is key — stay disciplined on pace.",
          workouts: [
            { id: "m1-mon", day: "Monday", date: "Jun 9", type: "run", trainingType: "LR", title: "Easy Recovery", miles: 5, description: "5 mi easy", completed: true, log: { rpe: "3", stress: "", notes: "Felt great", energy: "9", motivation: "9", sleep: "8", strength: "8", recovery: "8", mood: "9", hunger: "7" } },
            { id: "m1-tue", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "Tempo", title: "Tempo Run", miles: 10, description: "2 WU | 6@7:15 | 2 CD", paceTarget: "7:15/mi", location: "Greenway Trail", completed: true, log: { rpe: "7", stress: "", notes: "Felt strong", energy: "9", motivation: "9", sleep: "8", strength: "8", recovery: "7", mood: "8", hunger: "7", actualMiles: "10.0", actualPace: "7:18" } },
            { id: "m1-wed", day: "Wednesday", date: "Jun 11", type: "run", trainingType: "LR", title: "Easy Run", miles: 6, description: "6 mi easy", completed: false },
            { id: "m1-sat", day: "Saturday", date: "Jun 14", type: "run", trainingType: "LR", title: "Long Run", miles: 20, description: "20 mi at marathon effort", completed: false },
          ],
        },
      ],
    },
    {
      id: "c3",
      name: "Jessica R.",
      goal: "First 5K",
      startDate: "Jun 1, 2026",
      planDuration: "Aug 15",
      owed: 200,
      paid: 100,
      weeks: [
        {
          weekId: "week-current",
          label: "This Week",
          dateRange: "Jun 9 - Jun 15",
          focus: "Building Base",
          coachMessage: "Great progress! Keep the run/walk intervals consistent. No pressure on pace.",
          workouts: [
            { id: "j1-mon", day: "Monday", date: "Jun 9", type: "run", trainingType: "LR", title: "Walk/Run Intervals", miles: 2.5, description: "Run 2 min / Walk 1 min x 10", completed: true, log: { rpe: "6", stress: "", notes: "Getting easier!", energy: "7", motivation: "8", sleep: "7", strength: "6", recovery: "7", mood: "8", hunger: "7", actualMiles: "2.5", actualPace: "12:30" } },
            { id: "j1-wed", day: "Wednesday", date: "Jun 11", type: "run", trainingType: "LR", title: "Walk/Run Intervals", miles: 2.5, description: "Run 2 min / Walk 1 min x 10", completed: false },
            { id: "j1-fri", day: "Friday", date: "Jun 13", type: "cross", trainingType: "CT", title: "Cross Training", miles: null, description: "30 min bike or swim", completed: false },
            { id: "j1-sat", day: "Saturday", date: "Jun 14", type: "run", trainingType: "LR", title: "Long Walk/Run", miles: 3, description: "Run 3 min / Walk 1 min x 10", completed: false },
          ],
        },
      ],
    },
  ]);

  const [newWorkout, setNewWorkout] = useState({
    day: "Monday", date: "", type: "run" as "run" | "cross" | "strength" | "rest",
    trainingType: "Speed", title: "", miles: null as number | null,
    description: "", paceTarget: "", location: "", coachNotes: "",
  });

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const selectedClientWeeks = selectedClientData?.weeks || [];
  const selectedWeek = selectedClientWeeks[selectedWeekIndex];
  const allClientWorkouts = selectedClientWeeks.flatMap((w) => w.workouts);
  const completedWorkouts = allClientWorkouts.filter((w) => w.completed);
  const loggedWorkouts = allClientWorkouts.filter((w) => w.log);
  const totalMiles = loggedWorkouts.reduce((s, w) => s + (Number(w.log?.actualMiles) || w.miles || 0), 0);

  const getTypeBadge = (type: string) => {
    switch (type) { case "run": return "bg-accent/20 text-accent"; case "cross": return "bg-gold/20 text-gold"; case "strength": return "bg-purple-500/20 text-purple-400"; case "rest": return "bg-green-500/20 text-green-400"; default: return "bg-gray-500/20 text-gray-400"; }
  };
  const getTrainingTypeBadge = (tt: string) => {
    switch (tt) { case "Speed": return "bg-red-500/20 text-red-400 border-red-500/30"; case "Tempo": return "bg-orange-500/20 text-orange-400 border-orange-500/30"; case "LR": return "bg-blue-500/20 text-blue-400 border-blue-500/30"; case "HR": return "bg-pink-500/20 text-pink-400 border-pink-500/30"; case "CT": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; case "OT": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"; }
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="bg-secondary/50 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/IMG_5861.PNG" alt="Pistol Performance Coaching" width={50} height={50} />
            <div>
              <h1 className="font-heading text-xl uppercase text-white">Coach Admin</h1>
              <p className="text-gray-400 text-sm">Pistol Performance Coaching</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gold text-sm font-heading uppercase">Crystal</span>
            <a href="/" className="text-gray-400 hover:text-accent text-sm transition-colors">Logout</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Client List — Always at the top */}
        <div className="mb-8">
          <h2 className="font-heading text-lg uppercase text-gray-400 mb-4">Clients</h2>
          <div className="flex flex-wrap gap-3">
            {clients.map((client) => {
              const allWk = client.weeks.flatMap(w => w.workouts);
              const doneWk = allWk.filter(w => w.completed);
              const isSelected = selectedClient === client.id;
              return (
                <button
                  key={client.id}
                  onClick={() => { setSelectedClient(isSelected ? null : client.id); setSelectedWeekIndex(0); setClientTab("plan"); }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-accent/10 border-accent text-white"
                      : "bg-secondary/50 border-white/10 text-gray-300 hover:border-white/30"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isSelected ? "bg-accent text-white" : "bg-white/10 text-gray-400"}`}>
                    {client.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{client.name}</p>
                    <p className="text-xs text-gray-500">{doneWk.length}/{allWk.length} done</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Client Panel — Expands below */}
        {selectedClientData && (
          <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
            {/* Client Header */}
            <div className="px-6 py-5 border-b border-white/10 bg-secondary/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-2xl uppercase text-white">{selectedClientData.name}</h2>
                  <p className="text-gray-400 text-sm">{selectedClientData.goal} &mdash; Started {selectedClientData.startDate}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center"><p className="text-accent font-heading text-xl">{completedWorkouts.length}/{allClientWorkouts.length}</p><p className="text-gray-500 text-xs">Completed</p></div>
                  <div className="text-center"><p className="text-white font-heading text-xl">{totalMiles.toFixed(0)}</p><p className="text-gray-500 text-xs">Miles</p></div>
                  <div className="text-center"><p className="text-green-400 font-heading text-xl">${selectedClientData.paid}</p><p className="text-gray-500 text-xs">/ ${selectedClientData.owed}</p></div>
                </div>
              </div>

              {/* Sub-tabs within client */}
              <div className="flex gap-1 mt-4">
                {[{ key: "plan", label: "Training Plan" }, { key: "logs", label: "Client Logs" }, { key: "create", label: "Add Workout" }].map((tab) => (
                  <button key={tab.key} onClick={() => setClientTab(tab.key as "plan" | "logs" | "create")} className={`px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-colors ${clientTab === tab.key ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>{tab.label}</button>
                ))}
              </div>
            </div>

            {/* Client Content */}
            <div className="p-6 space-y-6">

              {/* TRAINING PLAN — What the client sees */}
              {clientTab === "plan" && (
                <>
                  {/* Week Nav */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedWeekIndex(Math.min(selectedWeekIndex + 1, selectedClientWeeks.length - 1))} disabled={selectedWeekIndex >= selectedClientWeeks.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="text-center">
                      <p className="font-heading text-lg uppercase text-white">{selectedWeek?.label}</p>
                      <p className="text-gray-400 text-xs">{selectedWeek?.dateRange} &mdash; {selectedWeek?.focus}</p>
                    </div>
                    <button onClick={() => setSelectedWeekIndex(Math.max(selectedWeekIndex - 1, 0))} disabled={selectedWeekIndex <= 0} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  {/* Coach Message */}
                  {selectedWeek?.coachMessage && (
                    <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                      <p className="text-gold text-xs font-heading uppercase mb-1">Your Message to {selectedClientData.name.split(" ")[0]}</p>
                      <p className="text-gray-300 text-sm">{selectedWeek.coachMessage}</p>
                    </div>
                  )}

                  {/* Workouts */}
                  <div className="space-y-3">
                    {selectedWeek?.workouts.map((w) => (
                      <div key={w.id} className="flex items-center gap-4 bg-primary/30 border border-white/5 rounded-xl p-4">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${w.completed ? "bg-green-500" : "bg-gray-600"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium text-sm">{w.day}</span>
                            <span className="text-gray-500 text-xs">{w.date}</span>
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(w.type)}`}>{w.type}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(w.trainingType)}`}>{w.trainingType}</span>
                          </div>
                          <p className="text-gray-300 text-sm mt-0.5">{w.title} {w.description && `— ${w.description}`}</p>
                          {w.paceTarget && <p className="text-accent text-xs mt-0.5">{w.paceTarget}</p>}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {w.miles && <span className="text-white font-heading text-lg">{w.miles}<span className="text-gray-500 text-xs ml-0.5">mi</span></span>}
                          <button className="text-gray-400 hover:text-accent text-xs">Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-right">
                    <span className="text-gray-400 text-sm">Weekly Total: </span>
                    <span className="text-white font-heading text-lg">{selectedWeek?.workouts.reduce((s, w) => s + (w.miles || 0), 0)} miles</span>
                  </div>
                </>
              )}

              {/* CLIENT LOGS — What they submitted */}
              {clientTab === "logs" && (
                <>
                  {/* Week Nav */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedWeekIndex(Math.min(selectedWeekIndex + 1, selectedClientWeeks.length - 1))} disabled={selectedWeekIndex >= selectedClientWeeks.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="text-center">
                      <p className="font-heading text-lg uppercase text-white">{selectedWeek?.label}</p>
                      <p className="text-gray-400 text-xs">{selectedWeek?.dateRange}</p>
                    </div>
                    <button onClick={() => setSelectedWeekIndex(Math.max(selectedWeekIndex - 1, 0))} disabled={selectedWeekIndex <= 0} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {selectedWeek?.workouts.map((workout) => (
                      <div key={workout.id} className="bg-primary/30 border border-white/5 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`w-2.5 h-2.5 rounded-full ${workout.completed ? "bg-green-500" : "bg-gray-600"}`} />
                            <span className="text-white font-medium text-sm">{workout.day}, {workout.date}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(workout.trainingType)}`}>{workout.trainingType}</span>
                            <span className="text-gray-400 text-sm">{workout.title}</span>
                          </div>
                          {workout.completed ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Done</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Not done</span>
                          )}
                        </div>

                        {workout.log ? (
                          <div className="mt-3 pl-5 border-l-2 border-accent/30">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-2">
                              {workout.log.rpe && <div><span className="text-gray-500 text-xs">RPE</span><p className="text-white font-medium">{workout.log.rpe}/10</p></div>}
                              {workout.log.actualMiles && <div><span className="text-gray-500 text-xs">Miles</span><p className="text-white">{workout.log.actualMiles}</p></div>}
                              {workout.log.actualPace && <div><span className="text-gray-500 text-xs">Pace</span><p className="text-white">{workout.log.actualPace}</p></div>}
                              {workout.log.stress && <div><span className="text-gray-500 text-xs">Stress</span><p className="text-white">{workout.log.stress}</p></div>}
                              {workout.log.notes && <div className="md:col-span-2"><span className="text-gray-500 text-xs">Notes</span><p className="text-gray-300">{workout.log.notes}</p></div>}
                            </div>
                            {(workout.log.energy || workout.log.sleep) && (
                              <div className="grid grid-cols-7 gap-2 text-center text-xs mt-3 pt-3 border-t border-white/5">
                                {[{ k: "energy", l: "Engy" }, { k: "motivation", l: "Motv" }, { k: "sleep", l: "Slp" }, { k: "strength", l: "Str" }, { k: "recovery", l: "Rec" }, { k: "mood", l: "Mood" }, { k: "hunger", l: "Hngr" }].map((f) => (
                                  <div key={f.k}><p className="text-gray-600">{f.l}</p><p className="text-white">{(workout.log as Record<string, string>)[f.k] || "—"}</p></div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs mt-2 pl-5 italic">No log submitted</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ADD WORKOUT */}
              {clientTab === "create" && (
                <>
                  {!showAddWorkout ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 mb-4">Add a new workout to {selectedClientData.name.split(" ")[0]}&apos;s plan</p>
                      <button onClick={() => setShowAddWorkout(true)} className="bg-accent hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-colors">+ New Workout</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Day</label>
                          <select value={newWorkout.day} onChange={(e) => setNewWorkout({ ...newWorkout, day: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => <option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Date</label>
                          <input type="text" value={newWorkout.date} onChange={(e) => setNewWorkout({ ...newWorkout, date: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Jun 16" />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Type</label>
                          <select value={newWorkout.type} onChange={(e) => setNewWorkout({ ...newWorkout, type: e.target.value as "run" | "cross" | "strength" | "rest" })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                            <option value="run">Run</option><option value="cross">Cross Training</option><option value="strength">Strength</option><option value="rest">Rest</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Training Type</label>
                          <select value={newWorkout.trainingType} onChange={(e) => setNewWorkout({ ...newWorkout, trainingType: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                            <option value="Speed">Speed</option><option value="HR">Heart Rate (HR)</option><option value="LR">Long Run (LR)</option><option value="Tempo">Tempo</option><option value="CT">Cross Training (CT)</option><option value="OT">Orange Theory (OT)</option><option value="Rest">Rest</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div><label className="text-gray-400 text-xs block mb-1">Title</label><input type="text" value={newWorkout.title} onChange={(e) => setNewWorkout({ ...newWorkout, title: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Descending 1200s" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Miles</label><input type="number" value={newWorkout.miles || ""} onChange={(e) => setNewWorkout({ ...newWorkout, miles: e.target.value ? Number(e.target.value) : null })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 8" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Pace Target</label><input type="text" value={newWorkout.paceTarget} onChange={(e) => setNewWorkout({ ...newWorkout, paceTarget: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 7:30/mi" /></div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><label className="text-gray-400 text-xs block mb-1">Location</label><input type="text" value={newWorkout.location} onChange={(e) => setNewWorkout({ ...newWorkout, location: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Kickapoo Track" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Description</label><input type="text" value={newWorkout.description} onChange={(e) => setNewWorkout({ ...newWorkout, description: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 1 mi WU | 8x800 | 1 mi CD" /></div>
                      </div>
                      <div><label className="text-gray-400 text-xs block mb-1">Coach Notes</label><textarea value={newWorkout.coachNotes} onChange={(e) => setNewWorkout({ ...newWorkout, coachNotes: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={3} placeholder="Detailed instructions, pacing, motivation..." /></div>
                      <div className="flex gap-3">
                        <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Save Workout</button>
                        <button onClick={() => setShowAddWorkout(false)} className="border border-white/10 text-gray-400 hover:text-white py-2 px-6 rounded-lg transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedClient && (
          <div className="text-center py-16 bg-secondary/20 border border-white/5 rounded-2xl">
            <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <p className="text-gray-500 text-lg">Select a client above to manage their training</p>
          </div>
        )}
      </main>
    </div>
  );
}
