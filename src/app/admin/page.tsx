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
  const [activeView, setActiveView] = useState<"clients" | "workouts" | "logs">("clients");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  // Same workout data the client sees — shared source of truth
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
            { id: "w1-tue", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "Speed", title: "Descending 1200s", miles: 8, description: "Kickapoo Track - 3 mi WU | Descending 1200s | 1 mi CD", paceTarget: "Reps from 8:30 down to 7:40", location: "Kickapoo Track", coachNotes: "Rep 1: 400@8:30, 400@8:20, 400@8:10, Recovery. Rep 2: 400@8:20, 400@8:10, 400@8:00, Recovery. Rep 3: 400@8:10, 400@8:00, 400@7:50, Recovery. Rep 4: 400@8:00, 400@7:50, 400@7:40 or faster, Recovery.", completed: false },
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
          coachMessage: "This week will be more specificity training on hills — Tuesday will be location specific. Jeff will be here to guide you through it.",
          workouts: [
            { id: "w2-mon", day: "Monday", date: "Jun 2", type: "strength", trainingType: "CT", title: "Bike / Strength", miles: null, description: "Bike and strength work.", completed: true, log: { rpe: "6", stress: "", notes: "Felt good", energy: "7", motivation: "8", sleep: "7", strength: "7", recovery: "6", mood: "8", hunger: "7" } },
            { id: "w2-tue", day: "Tuesday", date: "Jun 3", type: "run", trainingType: "Speed", title: "HILLS - Technique Day", miles: 7, description: "2 WU | 1 down | 1 up | 1 down | 1 up | 1 CD", paceTarget: "Downhill close to race pace", location: "Location specific hills", coachNotes: "Technique day. Jeff will coach you on keeping head up, not leaning too far forward, allowing gravity to help you down.", completed: true, log: { rpe: "8", stress: "", notes: "Jeff was great help", energy: "8", motivation: "9", sleep: "7", strength: "7", recovery: "7", mood: "9", hunger: "6", actualMiles: "7.2", actualPace: "8:45" } },
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
    day: "Monday",
    date: "",
    type: "run" as "run" | "cross" | "strength" | "rest",
    trainingType: "Speed",
    title: "",
    miles: null as number | null,
    description: "",
    paceTarget: "",
    location: "",
    coachNotes: "",
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

      <div className="border-b border-white/10 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {[{ key: "clients", label: "Clients" }, { key: "workouts", label: "Create Workouts" }, { key: "logs", label: "View Logs" }].map((tab) => (
            <button key={tab.key} onClick={() => setActiveView(tab.key as "clients" | "workouts" | "logs")} className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors ${activeView === tab.key ? "text-accent border-b-2 border-accent" : "text-gray-400 hover:text-white"}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* CLIENTS VIEW */}
        {activeView === "clients" && (
          <>
            <h2 className="font-heading text-2xl uppercase text-white">Your Clients</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {clients.map((client) => {
                const allWk = client.weeks.flatMap(w => w.workouts);
                const doneWk = allWk.filter(w => w.completed);
                const miles = doneWk.reduce((s, w) => s + (Number(w.log?.actualMiles) || w.miles || 0), 0);
                return (
                  <div key={client.id} className="bg-secondary/50 border border-white/10 rounded-2xl p-6 hover:border-accent/30 transition-all cursor-pointer" onClick={() => { setSelectedClient(client.id); setSelectedWeekIndex(0); setActiveView("logs"); }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-accent font-bold">{client.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{client.name}</p>
                        <p className="text-gray-400 text-xs">{client.goal}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">Completed:</span><span className="text-white">{doneWk.length}/{allWk.length} workouts</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Miles:</span><span className="text-white">{miles.toFixed(1)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Paid:</span><span className="text-green-400">${client.paid} / ${client.owed}</span></div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5">
                      <div className="w-full bg-primary/50 rounded-full h-2">
                        <div className="bg-accent h-2 rounded-full" style={{ width: `${allWk.length > 0 ? (doneWk.length / allWk.length) * 100 : 0}%` }} />
                      </div>
                      <p className="text-gray-500 text-xs mt-1 text-right">{allWk.length > 0 ? Math.round((doneWk.length / allWk.length) * 100) : 0}% complete</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* CREATE WORKOUTS */}
        {activeView === "workouts" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl uppercase text-white">Create Workouts</h2>
              <div className="flex items-center gap-3">
                <select value={selectedClient || ""} onChange={(e) => setSelectedClient(e.target.value || null)} className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                  <option value="">Select Client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setShowAddWorkout(!showAddWorkout)} className="bg-accent hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">+ New Workout</button>
              </div>
            </div>

            {showAddWorkout && (
              <div className="bg-secondary/50 border border-accent/30 rounded-2xl p-6">
                <h3 className="font-heading text-lg uppercase text-accent mb-4">New Workout</h3>
                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Day</label>
                    <select value={newWorkout.day} onChange={(e) => setNewWorkout({ ...newWorkout, day: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Date</label>
                    <input type="text" value={newWorkout.date} onChange={(e) => setNewWorkout({ ...newWorkout, date: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Jun 10" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Workout Type</label>
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
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div><label className="text-gray-400 text-xs block mb-1">Title</label><input type="text" value={newWorkout.title} onChange={(e) => setNewWorkout({ ...newWorkout, title: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Descending 1200s" /></div>
                  <div><label className="text-gray-400 text-xs block mb-1">Miles</label><input type="number" value={newWorkout.miles || ""} onChange={(e) => setNewWorkout({ ...newWorkout, miles: e.target.value ? Number(e.target.value) : null })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 8" /></div>
                  <div><label className="text-gray-400 text-xs block mb-1">Pace Target</label><input type="text" value={newWorkout.paceTarget} onChange={(e) => setNewWorkout({ ...newWorkout, paceTarget: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 7:30s" /></div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div><label className="text-gray-400 text-xs block mb-1">Location</label><input type="text" value={newWorkout.location} onChange={(e) => setNewWorkout({ ...newWorkout, location: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Kickapoo Track" /></div>
                  <div><label className="text-gray-400 text-xs block mb-1">Description</label><input type="text" value={newWorkout.description} onChange={(e) => setNewWorkout({ ...newWorkout, description: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 1 mi WU | 8x800/400 rest | 1 mi CD" /></div>
                </div>
                <div className="mb-4"><label className="text-gray-400 text-xs block mb-1">Coach Notes</label><textarea value={newWorkout.coachNotes} onChange={(e) => setNewWorkout({ ...newWorkout, coachNotes: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={4} placeholder="Detailed pace breakdown, technique cues, motivation..." /></div>
                <div className="flex gap-3">
                  <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Save Workout</button>
                  <button onClick={() => setShowAddWorkout(false)} className="border border-white/10 text-gray-400 hover:text-white py-2 px-6 rounded-lg transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* Show selected client's current week */}
            {selectedClientData && (
              <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                <h3 className="font-heading text-lg uppercase text-white mb-2">{selectedClientData.name} &mdash; {selectedClientData.weeks[0]?.label}</h3>
                <p className="text-gray-400 text-sm mb-4">{selectedClientData.weeks[0]?.dateRange} &mdash; {selectedClientData.weeks[0]?.focus}</p>
                <div className="space-y-3">
                  {selectedClientData.weeks[0]?.workouts.map((w) => (
                    <div key={w.id} className="flex items-center justify-between bg-primary/30 border border-white/5 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${w.completed ? "bg-green-500" : "bg-gray-500"}`} />
                        <span className="text-white text-sm font-medium">{w.day}</span>
                        <span className="text-gray-400 text-sm">{w.title}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(w.trainingType)}`}>{w.trainingType}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {w.miles && <span className="text-white text-sm">{w.miles} mi</span>}
                        <button className="text-gray-400 hover:text-accent text-xs">Edit</button>
                        <button className="text-gray-400 hover:text-red-400 text-xs">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW LOGS — Shows same data client sees, with their inputs */}
        {activeView === "logs" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl uppercase text-white">
                {selectedClientData ? `${selectedClientData.name}` : "Client Logs"}
              </h2>
              <select value={selectedClient || ""} onChange={(e) => { setSelectedClient(e.target.value || null); setSelectedWeekIndex(0); }} className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                <option value="">Select Client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.goal}</option>)}
              </select>
            </div>

            {selectedClientData && (
              <>
                {/* Client Overview */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-accent">{completedWorkouts.length}</p><p className="text-gray-400 text-xs">Completed</p></div>
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-white">{totalMiles.toFixed(1)}</p><p className="text-gray-400 text-xs">Miles</p></div>
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-gold">{loggedWorkouts.filter(w => w.log?.rpe).length > 0 ? (loggedWorkouts.filter(w => w.log?.rpe).reduce((s, w) => s + Number(w.log!.rpe), 0) / loggedWorkouts.filter(w => w.log?.rpe).length).toFixed(1) : "—"}</p><p className="text-gray-400 text-xs">Avg RPE</p></div>
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-green-400">{allClientWorkouts.length > 0 ? Math.round((completedWorkouts.length / allClientWorkouts.length) * 100) : 0}%</p><p className="text-gray-400 text-xs">Completion</p></div>
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-green-400">${selectedClientData.paid}</p><p className="text-gray-400 text-xs">/ ${selectedClientData.owed}</p></div>
                </div>

                {/* Week Navigation */}
                {selectedClientWeeks.length > 0 && (
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
                )}

                {/* Workouts with logs */}
                <div className="space-y-4">
                  {selectedWeek?.workouts.map((workout) => (
                    <div key={workout.id} className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`w-3 h-3 rounded-full ${workout.completed ? "bg-green-500" : "bg-gray-500"}`} />
                          <span className="text-white font-heading uppercase">{workout.day}</span>
                          <span className="text-gray-500 text-sm">{workout.date}</span>
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(workout.type)}`}>{workout.type}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(workout.trainingType)}`}>{workout.trainingType}</span>
                          {workout.completed && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Done</span>}
                        </div>
                        {workout.miles && <span className="text-white font-heading text-xl">{workout.miles} mi</span>}
                      </div>
                      <h4 className="text-white font-bold mb-1">{workout.title}</h4>
                      <p className="text-gray-400 text-sm mb-2">{workout.description}</p>
                      {workout.paceTarget && <p className="text-accent text-sm">Target: {workout.paceTarget}</p>}

                      {/* Client's Log */}
                      {workout.log ? (
                        <div className="mt-4 bg-primary/30 border border-white/5 rounded-xl p-4">
                          <p className="text-accent text-xs font-heading uppercase mb-3">Client Log</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                            {workout.log.rpe && <div><span className="text-gray-400">RPE: </span><span className="text-white font-medium">{workout.log.rpe}/10</span></div>}
                            {workout.log.actualMiles && <div><span className="text-gray-400">Miles: </span><span className="text-white">{workout.log.actualMiles}</span></div>}
                            {workout.log.actualPace && <div><span className="text-gray-400">Pace: </span><span className="text-white">{workout.log.actualPace}</span></div>}
                            {workout.log.stress && <div><span className="text-gray-400">Stress: </span><span className="text-white">{workout.log.stress}</span></div>}
                          </div>
                          {workout.log.notes && <p className="text-gray-300 text-sm mb-3"><span className="text-gray-400">Notes: </span>{workout.log.notes}</p>}
                          <div className="grid grid-cols-7 gap-2 text-center text-xs border-t border-white/5 pt-3">
                            {[{ k: "energy", l: "Energy" }, { k: "motivation", l: "Motiv" }, { k: "sleep", l: "Sleep" }, { k: "strength", l: "Str" }, { k: "recovery", l: "Recov" }, { k: "mood", l: "Mood" }, { k: "hunger", l: "Hunger" }].map((f) => (
                              <div key={f.k}><p className="text-gray-500 mb-1">{f.l}</p><p className="text-white font-medium">{(workout.log as Record<string, string>)[f.k] || "—"}</p></div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 bg-primary/20 border border-white/5 rounded-xl p-3">
                          <p className="text-gray-500 text-xs italic">No log submitted yet</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {!selectedClient && (
              <div className="text-center py-16"><p className="text-gray-500 text-lg">Select a client to view their training and logs</p></div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
