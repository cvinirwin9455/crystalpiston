"use client";

import { useState } from "react";
import Image from "next/image";

type Client = {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  planDuration: string;
  owed: number;
  paid: number;
};

type WorkoutEntry = {
  id: string;
  day: string;
  date: string;
  type: "run" | "cross" | "strength" | "rest";
  trainingType: string;
  title: string;
  miles: number | null;
  description: string;
  paceTarget: string;
  location: string;
  coachNotes: string;
};

type ClientLog = {
  workoutId: string;
  workoutTitle: string;
  completed: boolean;
  rpe: string;
  actualMiles: string;
  actualPace: string;
  stress: string;
  notes: string;
  energy: string;
  motivation: string;
  sleep: string;
  strength: string;
  recovery: string;
  mood: string;
  hunger: string;
};

export default function AdminPage() {
  const [activeView, setActiveView] = useState<"clients" | "workouts" | "logs">("clients");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showAddWorkout, setShowAddWorkout] = useState(false);

  const [clients] = useState<Client[]>([
    { id: "c1", name: "Sarah M.", goal: "War Eagle 50K", startDate: "May 5, 2026", planDuration: "July 26", owed: 525, paid: 175 },
    { id: "c2", name: "Mike T.", goal: "Sub-4 Marathon", startDate: "Apr 1, 2026", planDuration: "Oct 12", owed: 400, paid: 400 },
    { id: "c3", name: "Jessica R.", goal: "First 5K", startDate: "Jun 1, 2026", planDuration: "Aug 15", owed: 200, paid: 100 },
  ]);

  const [clientLogs] = useState<Record<string, ClientLog[]>>({
    c1: [
      { workoutId: "w2-tue", workoutTitle: "HILLS - Technique Day", completed: true, rpe: "8", actualMiles: "7.2", actualPace: "8:45", stress: "", notes: "Jeff was great help", energy: "8", motivation: "9", sleep: "7", strength: "7", recovery: "7", mood: "9", hunger: "6" },
      { workoutId: "w2-wed", workoutTitle: "Easy Run", completed: true, rpe: "4", actualMiles: "5.0", actualPace: "10:00", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "6", recovery: "7", mood: "7", hunger: "8" },
      { workoutId: "w2-thu", workoutTitle: "Strides", completed: true, rpe: "7", actualMiles: "7.1", actualPace: "9:15", stress: "", notes: "Legs heavy from hills", energy: "6", motivation: "7", sleep: "6", strength: "6", recovery: "5", mood: "7", hunger: "7" },
      { workoutId: "w2-sat", workoutTitle: "Race Pace Workout", completed: true, rpe: "9", actualMiles: "12.1", actualPace: "9:12", stress: "Travel Day", notes: "War Eagle!", energy: "8", motivation: "9", sleep: "7", strength: "8", recovery: "6", mood: "9", hunger: "8" },
    ],
    c2: [
      { workoutId: "w1-tue", workoutTitle: "Tempo Run", completed: true, rpe: "7", actualMiles: "8.0", actualPace: "7:45", stress: "", notes: "Felt strong", energy: "9", motivation: "9", sleep: "8", strength: "8", recovery: "7", mood: "8", hunger: "7" },
    ],
    c3: [
      { workoutId: "w1-mon", workoutTitle: "Walk/Run Intervals", completed: true, rpe: "6", actualMiles: "2.5", actualPace: "12:30", stress: "", notes: "Getting easier!", energy: "7", motivation: "8", sleep: "7", strength: "6", recovery: "7", mood: "8", hunger: "7" },
    ],
  });

  const [newWorkout, setNewWorkout] = useState<WorkoutEntry>({
    id: "",
    day: "Monday",
    date: "",
    type: "run",
    trainingType: "Speed",
    title: "",
    miles: null,
    description: "",
    paceTarget: "",
    location: "",
    coachNotes: "",
  });

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const selectedClientLogs = selectedClient ? clientLogs[selectedClient] || [] : [];

  return (
    <div className="min-h-screen bg-primary">
      {/* Admin Header */}
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

      {/* Admin Tabs */}
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
              {clients.map((client) => (
                <div key={client.id} className="bg-secondary/50 border border-white/10 rounded-2xl p-6 hover:border-accent/30 transition-all cursor-pointer" onClick={() => { setSelectedClient(client.id); setActiveView("logs"); }}>
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
                    <div className="flex justify-between"><span className="text-gray-400">Start:</span><span className="text-white">{client.startDate}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Duration:</span><span className="text-white">{client.planDuration}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Paid:</span><span className="text-green-400">${client.paid} / ${client.owed}</span></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <div className="w-full bg-primary/50 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(client.paid / client.owed) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CREATE WORKOUTS VIEW */}
        {activeView === "workouts" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl uppercase text-white">Create Workouts</h2>
              <div className="flex items-center gap-3">
                <select className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                  <option>Select Client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setShowAddWorkout(!showAddWorkout)} className="bg-accent hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">
                  + New Workout
                </button>
              </div>
            </div>

            {/* New Workout Form */}
            {showAddWorkout && (
              <div className="bg-secondary/50 border border-accent/30 rounded-2xl p-6">
                <h3 className="font-heading text-lg uppercase text-accent mb-4">New Workout</h3>
                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Day</label>
                    <select value={newWorkout.day} onChange={(e) => setNewWorkout({ ...newWorkout, day: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Date</label>
                    <input type="text" value={newWorkout.date} onChange={(e) => setNewWorkout({ ...newWorkout, date: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Jun 10" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Workout Type</label>
                    <select value={newWorkout.type} onChange={(e) => setNewWorkout({ ...newWorkout, type: e.target.value as "run" | "cross" | "strength" | "rest" })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                      <option value="run">Run</option>
                      <option value="cross">Cross Training</option>
                      <option value="strength">Strength</option>
                      <option value="rest">Rest</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Training Type</label>
                    <select value={newWorkout.trainingType} onChange={(e) => setNewWorkout({ ...newWorkout, trainingType: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                      <option value="Speed">Speed</option>
                      <option value="HR">Heart Rate (HR)</option>
                      <option value="LR">Long Run (LR)</option>
                      <option value="Tempo">Tempo</option>
                      <option value="CT">Cross Training (CT)</option>
                      <option value="OT">Orange Theory (OT)</option>
                      <option value="Rest">Rest</option>
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Title</label>
                    <input type="text" value={newWorkout.title} onChange={(e) => setNewWorkout({ ...newWorkout, title: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Descending 1200s" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Miles</label>
                    <input type="number" value={newWorkout.miles || ""} onChange={(e) => setNewWorkout({ ...newWorkout, miles: e.target.value ? Number(e.target.value) : null })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 8" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Pace Target</label>
                    <input type="text" value={newWorkout.paceTarget} onChange={(e) => setNewWorkout({ ...newWorkout, paceTarget: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 7:30s" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Location</label>
                    <input type="text" value={newWorkout.location} onChange={(e) => setNewWorkout({ ...newWorkout, location: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Kickapoo Track" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Description (breakdown)</label>
                    <input type="text" value={newWorkout.description} onChange={(e) => setNewWorkout({ ...newWorkout, description: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. 1 mi WU | 8x800/400 rest | 1 mi CD" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-gray-400 text-xs block mb-1">Coach Notes (detailed instructions for athlete)</label>
                  <textarea value={newWorkout.coachNotes} onChange={(e) => setNewWorkout({ ...newWorkout, coachNotes: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={4} placeholder="Detailed pace breakdown, technique cues, motivation..." />
                </div>
                <div className="flex gap-3">
                  <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Save Workout</button>
                  <button onClick={() => setShowAddWorkout(false)} className="border border-white/10 text-gray-400 hover:text-white py-2 px-6 rounded-lg transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* Week Template Preview */}
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h3 className="font-heading text-lg uppercase text-white mb-4">Week Preview: Jun 9 - Jun 15</h3>
              <div className="space-y-3">
                {["Monday - OT", "Tuesday - Descending 1200s (8 mi, Speed)", "Wednesday - Easy Run (5 mi, LR)", "Thursday - Race Pace (10 mi, Tempo)", "Friday - OT", "Saturday - Long Run (17 mi, LR)", "Sunday - Easy Recovery (7 mi, LR)"].map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-primary/30 border border-white/5 rounded-xl p-3">
                    <p className="text-white text-sm">{item}</p>
                    <div className="flex gap-2">
                      <button className="text-gray-400 hover:text-accent text-xs">Edit</button>
                      <button className="text-gray-400 hover:text-red-400 text-xs">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* VIEW LOGS */}
        {activeView === "logs" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl uppercase text-white">
                {selectedClientData ? `${selectedClientData.name}'s Logs` : "Client Logs"}
              </h2>
              <select value={selectedClient || ""} onChange={(e) => setSelectedClient(e.target.value || null)} className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                <option value="">Select Client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {selectedClientData && (
              <>
                {/* Client Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center">
                    <p className="font-heading text-2xl text-accent">{selectedClientLogs.filter(l => l.completed).length}</p>
                    <p className="text-gray-400 text-xs">Completed</p>
                  </div>
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center">
                    <p className="font-heading text-2xl text-white">
                      {selectedClientLogs.reduce((s, l) => s + (Number(l.actualMiles) || 0), 0).toFixed(1)}
                    </p>
                    <p className="text-gray-400 text-xs">Miles Logged</p>
                  </div>
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center">
                    <p className="font-heading text-2xl text-gold">
                      {selectedClientLogs.filter(l => l.rpe).length > 0 ? (selectedClientLogs.filter(l => l.rpe).reduce((s, l) => s + Number(l.rpe), 0) / selectedClientLogs.filter(l => l.rpe).length).toFixed(1) : "—"}
                    </p>
                    <p className="text-gray-400 text-xs">Avg RPE</p>
                  </div>
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center">
                    <p className="font-heading text-2xl text-green-400">${selectedClientData.paid}</p>
                    <p className="text-gray-400 text-xs">Paid / ${selectedClientData.owed}</p>
                  </div>
                </div>

                {/* Individual Logs */}
                <div className="space-y-4">
                  {selectedClientLogs.map((log, i) => (
                    <div key={i} className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${log.completed ? "bg-green-500" : "bg-red-500"}`} />
                          <h4 className="text-white font-medium">{log.workoutTitle}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${log.completed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                            {log.completed ? "Completed" : "Missed"}
                          </span>
                        </div>
                        {log.rpe && <span className="text-accent font-heading">RPE: {log.rpe}</span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                        {log.actualMiles && <div><span className="text-gray-400">Miles: </span><span className="text-white">{log.actualMiles}</span></div>}
                        {log.actualPace && <div><span className="text-gray-400">Pace: </span><span className="text-white">{log.actualPace}</span></div>}
                        {log.stress && <div><span className="text-gray-400">Stress: </span><span className="text-white">{log.stress}</span></div>}
                        {log.notes && <div className="md:col-span-2"><span className="text-gray-400">Notes: </span><span className="text-white">{log.notes}</span></div>}
                      </div>
                      {(log.energy || log.motivation || log.sleep) && (
                        <div className="border-t border-white/5 pt-3 mt-3">
                          <div className="grid grid-cols-7 gap-2 text-center text-xs">
                            {[{ k: "energy", l: "Energy" }, { k: "motivation", l: "Motiv" }, { k: "sleep", l: "Sleep" }, { k: "strength", l: "Str" }, { k: "recovery", l: "Recov" }, { k: "mood", l: "Mood" }, { k: "hunger", l: "Hunger" }].map((f) => (
                              <div key={f.k}>
                                <p className="text-gray-500 mb-1">{f.l}</p>
                                <p className="text-white font-medium">{(log as Record<string, string>)[f.k] || "—"}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedClientLogs.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No logs from this client yet.</p>
                  )}
                </div>
              </>
            )}

            {!selectedClient && (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">Select a client to view their logs</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
