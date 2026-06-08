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

type CoachMessage = {
  id: string;
  date: string;
  message: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  gender: "female" | "male";
  goal: string;
  startDate: string;
  planDuration: string;
  owed: number;
  paid: number;
  status: "active" | "archived";
  weeks: WeekData[];
  messages: CoachMessage[];
};

type NewClientForm = {
  name: string;
  email: string;
  password: string;
  gender: "female" | "male";
  goal: string;
  startDate: string;
  planDuration: string;
  owed: string;
};

export default function AdminPage() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<"plan" | "create" | "messages" | "account">("plan");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [clientFilter, setClientFilter] = useState<"active" | "archived" | "all">("active");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newClientForm, setNewClientForm] = useState<NewClientForm>({
    name: "", email: "", password: "", gender: "female", goal: "", startDate: "", planDuration: "", owed: "",
  });

  // Week picker state
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date(2026, 5)); // June 2026
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getWeeksInMonth = (month: Date) => {
    const weeks: Date[][] = [];
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    let current = getMonday(firstDay);
    while (current <= lastDay || weeks.length < 5) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
      if (current > lastDay && weeks.length >= 4) break;
    }
    return weeks;
  };

  const selectWeek = (monday: Date) => {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    setSelectedWeekStart(monday);
    setWeekPlan({ ...weekPlan, dateRange: `${formatDate(monday)} - ${formatDate(sunday)}` });
    setShowWeekPicker(false);
  };

  // Week planner state (Mon-Sun quick create)
  const [weekPlan, setWeekPlan] = useState({
    dateRange: "",
    focus: "",
    coachMessage: "",
    days: [
      { day: "Monday", type: "run" as string, trainingType: "LR", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Tuesday", type: "run" as string, trainingType: "Speed", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Wednesday", type: "run" as string, trainingType: "LR", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Thursday", type: "run" as string, trainingType: "Tempo", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Friday", type: "cross" as string, trainingType: "CT", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Saturday", type: "run" as string, trainingType: "LR", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Sunday", type: "rest" as string, trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
    ],
  });

  const updateDayPlan = (index: number, field: string, value: string) => {
    const updated = [...weekPlan.days];
    (updated[index] as Record<string, string>)[field] = value;
    setWeekPlan({ ...weekPlan, days: updated });
  };

  const [clients, setClients] = useState<Client[]>([
    {
      id: "c1", name: "Sarah M.", email: "sarah@email.com", gender: "female", goal: "War Eagle 50K", startDate: "May 5, 2026", planDuration: "July 26", owed: 525, paid: 175, status: "active",
      messages: [
        { id: "m1", date: "Jun 9, 2026", message: "Training is loaded. The two workouts are Tuesday and Thursday. The Descending 1200s workout will get sent to your watch. The important piece is to not start out too fast — the point is to get 10 seconds faster at each 400. Recovery can be as slow as you need to jog, but try not to walk unless it's for a couple of breaths." },
        { id: "m2", date: "Jun 2, 2026", message: "I'm giving you this week of training a week ahead, because I will be gone. But Jeff will be here to guide you through it. This week will be more specificity training on hills. Hope you have a great week in Colorado! Great job at War Eagle!" },
        { id: "m3", date: "May 26, 2026", message: "Easy taper week. Trust the training. You're ready for War Eagle. Keep the legs fresh and the mind calm." },
      ],
      weeks: [
        {
          weekId: "week-current", label: "This Week", dateRange: "Jun 9 - Jun 15", focus: "Descending 1200s & Race Pace",
          coachMessage: "Training is loaded. The two workouts are Tuesday and Thursday.",
          workouts: [
            { id: "w1-mon", day: "Monday", date: "Jun 9", type: "cross", trainingType: "OT", title: "Orange Theory", miles: null, description: "OT class", completed: false },
            { id: "w1-tue", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "Speed", title: "Descending 1200s", miles: 8, description: "3 mi WU | Descending 1200s | 1 mi CD", paceTarget: "Reps from 8:30 down to 7:40", location: "Kickapoo Track", coachNotes: "Rep 1: 400@8:30, 400@8:20, 400@8:10, Recovery. Rep 2: 400@8:20, 400@8:10, 400@8:00, Recovery. Rep 3: 400@8:10, 400@8:00, 400@7:50, Recovery. Rep 4: 400@8:00, 400@7:50, 400@7:40 or faster.", completed: false },
            { id: "w1-wed", day: "Wednesday", date: "Jun 11", type: "run", trainingType: "LR", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: false },
            { id: "w1-thu", day: "Thursday", date: "Jun 12", type: "run", trainingType: "Tempo", title: "Race Pace", miles: 10, description: "2 mi WU | 2@8:40 | 2@8:20 | 2@8:40 | 1 CD", paceTarget: "8:20-8:40/mi", coachNotes: "2mi warm up, 7mi at close to race pace at 8:50, 1mi cool down.", completed: false },
            { id: "w1-fri", day: "Friday", date: "Jun 13", type: "cross", trainingType: "OT", title: "Orange Theory", miles: null, description: "OT class", completed: false },
            { id: "w1-sat", day: "Saturday", date: "Jun 14", type: "run", trainingType: "LR", title: "Long Run", miles: 17, description: "17 mi default pace", completed: false },
            { id: "w1-sun", day: "Sunday", date: "Jun 15", type: "run", trainingType: "LR", title: "Easy Recovery", miles: 7, description: "7 easy recovery", completed: false },
          ],
        },
        {
          weekId: "week-prev", label: "Last Week", dateRange: "Jun 2 - Jun 8", focus: "Hills & Specificity",
          coachMessage: "This week will be more specificity training on hills.",
          workouts: [
            { id: "w2-mon", day: "Monday", date: "Jun 2", type: "strength", trainingType: "CT", title: "Bike / Strength", miles: null, description: "Bike and strength work.", completed: true, log: { rpe: "6", stress: "", notes: "Felt good", energy: "7", motivation: "8", sleep: "7", strength: "7", recovery: "6", mood: "8", hunger: "7" } },
            { id: "w2-tue", day: "Tuesday", date: "Jun 3", type: "run", trainingType: "Speed", title: "HILLS - Technique Day", miles: 7, description: "2 WU | 1 down | 1 up | 1 down | 1 up | 1 CD", paceTarget: "Downhill close to race pace", location: "Location specific hills", coachNotes: "Technique day. Jeff will coach keeping head up, allowing gravity to help.", completed: true, log: { rpe: "8", stress: "", notes: "Jeff was great help", energy: "8", motivation: "9", sleep: "7", strength: "7", recovery: "7", mood: "9", hunger: "6", actualMiles: "7.2", actualPace: "8:45", onPeriod: "yes" } },
            { id: "w2-wed", day: "Wednesday", date: "Jun 4", type: "run", trainingType: "LR", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: true, log: { rpe: "4", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "6", recovery: "7", mood: "7", hunger: "8", onPeriod: "yes" } },
            { id: "w2-thu", day: "Thursday", date: "Jun 5", type: "run", trainingType: "Speed", title: "Strides", miles: 7, description: "7 mi w/strides", completed: true, log: { rpe: "7", stress: "", notes: "Legs heavy from hills", energy: "6", motivation: "7", sleep: "6", strength: "6", recovery: "5", mood: "7", hunger: "7" } },
            { id: "w2-fri", day: "Friday", date: "Jun 6", type: "strength", trainingType: "CT", title: "Bike / Strength", miles: null, description: "Bike and strength work.", completed: true, log: { rpe: "5", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "7", recovery: "7", mood: "8", hunger: "7" } },
            { id: "w2-sat", day: "Saturday", date: "Jun 7", type: "run", trainingType: "Tempo", title: "Race Pace Workout", miles: 12, description: "5 WU | 5 mi @ 9:15 (2 min rest) | 2 CD", paceTarget: "9:15/mi", completed: true, log: { rpe: "9", stress: "Travel Day", notes: "War Eagle!", energy: "8", motivation: "9", sleep: "7", strength: "8", recovery: "6", mood: "9", hunger: "8", actualMiles: "12.1", actualPace: "9:12" } },
            { id: "w2-sun", day: "Sunday", date: "Jun 8", type: "rest", trainingType: "Rest", title: "Complete Rest", miles: null, description: "Complete rest day.", completed: true, log: { rpe: "", stress: "", notes: "Great week overall", energy: "8", motivation: "8", sleep: "9", strength: "7", recovery: "8", mood: "9", hunger: "7" } },
          ],
        },
      ],
    },
    {
      id: "c2", name: "Mike T.", email: "mike@email.com", gender: "male", goal: "Sub-4 Marathon", startDate: "Apr 1, 2026", planDuration: "Oct 12", owed: 400, paid: 400, status: "active",
      messages: [
        { id: "m1", date: "Jun 9, 2026", message: "Big week ahead. Tuesday tempo is key — stay disciplined on pace. You're looking strong." },
      ],
      weeks: [
        {
          weekId: "week-current", label: "This Week", dateRange: "Jun 9 - Jun 15", focus: "Tempo & Long Run",
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
      id: "c3", name: "Jessica R.", email: "jessica@email.com", gender: "female", goal: "First 5K", startDate: "Jun 1, 2026", planDuration: "Aug 15", owed: 200, paid: 100, status: "active",
      messages: [
        { id: "m1", date: "Jun 9, 2026", message: "Great progress! Keep the run/walk intervals consistent. No pressure on pace — just get the time on your feet." },
      ],
      weeks: [
        {
          weekId: "week-current", label: "This Week", dateRange: "Jun 9 - Jun 15", focus: "Building Base",
          coachMessage: "Great progress! Keep the run/walk intervals consistent.",
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

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const selectedClientWeeks = selectedClientData?.weeks || [];
  const selectedWeek = selectedClientWeeks[selectedWeekIndex];
  const allClientWorkouts = selectedClientWeeks.flatMap((w) => w.workouts);
  const completedWorkouts = allClientWorkouts.filter((w) => w.completed);
  const totalMiles = allClientWorkouts.filter(w => w.log).reduce((s, w) => s + (Number(w.log?.actualMiles) || w.miles || 0), 0);
  const clientMessages = selectedClientData?.messages || [];

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
            <div><h1 className="font-heading text-xl uppercase text-white">Coach Admin</h1><p className="text-gray-400 text-sm">Pistol Performance Coaching</p></div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gold text-sm font-heading uppercase">Crystal</span>
            <a href="/" className="text-gray-400 hover:text-accent text-sm transition-colors">Logout</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Client Selector - scalable for 50-100+ clients */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="font-heading text-lg uppercase text-gray-400">Clients</h2>
              <div className="flex gap-1">
                {[{ key: "active", label: "Active" }, { key: "archived", label: "Archived" }, { key: "all", label: "All" }].map((f) => (
                  <button key={f.key} onClick={() => setClientFilter(f.key as "active" | "archived" | "all")} className={`px-3 py-1 rounded-full text-xs transition-colors ${clientFilter === f.key ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>{f.label}</button>
                ))}
              </div>
              <input type="text" placeholder="Search clients..." className="bg-primary/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-accent w-48" />
            </div>
            <button onClick={() => setShowCreateClient(!showCreateClient)} className="bg-accent hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">+ New Client</button>
          </div>

          {/* Create Client Form */}
          {showCreateClient && (
            <div className="bg-secondary/50 border border-accent/30 rounded-2xl p-6 mb-6">
              <h3 className="font-heading text-lg uppercase text-accent mb-4">Create New Client Account</h3>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div><label className="text-gray-400 text-xs block mb-1">Full Name</label><input type="text" value={newClientForm.name} onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Sarah Miller" /></div>
                <div><label className="text-gray-400 text-xs block mb-1">Email (login)</label><input type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="client@email.com" /></div>
                <div><label className="text-gray-400 text-xs block mb-1">Temporary Password</label><input type="text" value={newClientForm.password} onChange={(e) => setNewClientForm({ ...newClientForm, password: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="They can change later" /></div>
                <div><label className="text-gray-400 text-xs block mb-1">Gender</label><select value={newClientForm.gender} onChange={(e) => setNewClientForm({ ...newClientForm, gender: e.target.value as "female" | "male" })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="female">Female</option><option value="male">Male</option></select></div>
              </div>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div><label className="text-gray-400 text-xs block mb-1">Goal</label><input type="text" value={newClientForm.goal} onChange={(e) => setNewClientForm({ ...newClientForm, goal: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. First 5K" /></div>
                <div><label className="text-gray-400 text-xs block mb-1">Start Date</label><input type="text" value={newClientForm.startDate} onChange={(e) => setNewClientForm({ ...newClientForm, startDate: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Jun 15, 2026" /></div>
                <div><label className="text-gray-400 text-xs block mb-1">Plan End Date</label><input type="text" value={newClientForm.planDuration} onChange={(e) => setNewClientForm({ ...newClientForm, planDuration: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Aug 30" /></div>
                <div><label className="text-gray-400 text-xs block mb-1">Amount Owed ($)</label><input type="text" value={newClientForm.owed} onChange={(e) => setNewClientForm({ ...newClientForm, owed: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="300" /></div>
              </div>
              <div className="flex gap-3">
                <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Create Account</button>
                <button onClick={() => setShowCreateClient(false)} className="border border-white/10 text-gray-400 hover:text-white py-2 px-6 rounded-lg transition-colors">Cancel</button>
              </div>
              <p className="text-gray-500 text-xs mt-3">Client will be able to login with their email and password at /login</p>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto border border-white/5 rounded-xl">
            <div className="divide-y divide-white/5">
              {clients.filter((c) => clientFilter === "all" || c.status === clientFilter).map((client) => {
                const allWk = client.weeks.flatMap(w => w.workouts);
                const doneWk = allWk.filter(w => w.completed);
                const isSelected = selectedClient === client.id;
                return (
                  <button key={client.id} onClick={() => { setSelectedClient(isSelected ? null : client.id); setSelectedWeekIndex(0); setClientTab("plan"); setMessageIndex(0); setShowDeleteConfirm(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isSelected ? "bg-accent/10" : "hover:bg-white/5"} ${client.status === "archived" ? "opacity-50" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSelected ? "bg-accent text-white" : "bg-white/10 text-gray-400"}`}>{client.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{client.name} {client.status === "archived" && <span className="text-gray-600">(archived)</span>}</p>
                      <p className="text-gray-500 text-xs truncate">{client.goal}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white text-xs">{doneWk.length}/{allWk.length}</p>
                      <p className="text-gray-500 text-xs">${client.paid}/${client.owed}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Client Panel */}
        {selectedClientData && (
          <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
            {/* Client Header */}
            <div className="px-6 py-5 border-b border-white/10 bg-secondary/50">
              <div className="flex items-center justify-between flex-wrap gap-4">
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
              <div className="flex gap-1 mt-4">
                {[{ key: "plan", label: "Training & Logs" }, { key: "create", label: "Create Week" }, { key: "messages", label: "Messages" }, { key: "account", label: "Manage Account" }].map((tab) => (
                  <button key={tab.key} onClick={() => setClientTab(tab.key as "plan" | "create" | "messages" | "account")} className={`px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-colors ${clientTab === tab.key ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>{tab.label}</button>
                ))}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* TRAINING & LOGS (combined) */}
              {clientTab === "plan" && (
                <>
                  {/* Week Nav */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedWeekIndex(Math.min(selectedWeekIndex + 1, selectedClientWeeks.length - 1))} disabled={selectedWeekIndex >= selectedClientWeeks.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                    <div className="text-center"><p className="font-heading text-lg uppercase text-white">{selectedWeek?.label}</p><p className="text-gray-400 text-xs">{selectedWeek?.dateRange} &mdash; {selectedWeek?.focus}</p></div>
                    <button onClick={() => setSelectedWeekIndex(Math.max(selectedWeekIndex - 1, 0))} disabled={selectedWeekIndex <= 0} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                  </div>

                  {/* Weekly Coach Message (what client sees at top) */}
                  <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gold text-xs font-heading uppercase">Weekly Message (shown to client at top of their plan)</p>
                      <button className="text-gray-400 hover:text-gold text-xs">Edit</button>
                    </div>
                    {selectedWeek?.coachMessage ? (
                      <p className="text-gray-300 text-sm leading-relaxed">{selectedWeek.coachMessage}</p>
                    ) : (
                      <p className="text-gray-600 text-sm italic">No weekly message set. Add one in Create Week.</p>
                    )}
                  </div>

                  {/* Workouts with inline logs */}
                  <div className="space-y-3">
                    {selectedWeek?.workouts.map((w) => (
                      <div key={w.id} className="bg-primary/30 border border-white/5 rounded-xl p-4">
                        {/* Workout row */}
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${w.completed ? "bg-green-500" : "bg-gray-600"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium text-sm">{w.day}</span>
                              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(w.type)}`}>{w.type}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(w.trainingType)}`}>{w.trainingType}</span>
                              {w.completed && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Done</span>}
                            </div>
                            <p className="text-gray-300 text-sm mt-0.5">{w.title} {w.description && `— ${w.description}`}</p>
                            {w.paceTarget && <p className="text-accent text-xs mt-0.5">{w.paceTarget}</p>}
                          </div>
                          <div className="flex-shrink-0">
                            {w.miles && <span className="text-white font-heading text-lg">{w.miles}<span className="text-gray-500 text-xs ml-0.5">mi</span></span>}
                          </div>
                        </div>

                        {/* Client log inline */}
                        {w.log && (
                          <div className="mt-3 ml-7 pl-4 border-l-2 border-accent/30">
                            <div className="flex flex-wrap gap-4 text-xs">
                              {w.log.rpe && <span><span className="text-gray-500">RPE:</span> <span className="text-white">{w.log.rpe}/10</span></span>}
                              {w.log.actualMiles && <span><span className="text-gray-500">Miles:</span> <span className="text-white">{w.log.actualMiles}</span></span>}
                              {w.log.actualPace && <span><span className="text-gray-500">Pace:</span> <span className="text-white">{w.log.actualPace}</span></span>}
                              {w.log.stress && <span><span className="text-gray-500">Stress:</span> <span className="text-white">{w.log.stress}</span></span>}
                              {(w.log as Record<string, string>).onPeriod === "yes" && <span className="text-pink-400 font-medium">On Period</span>}
                            </div>
                            {w.log.notes && <p className="text-gray-400 text-xs mt-1"><span className="text-gray-500">Notes:</span> {w.log.notes}</p>}
                            <div className="flex gap-3 mt-2 text-xs text-gray-500">
                              {w.log.energy && <span>E:{w.log.energy}</span>}
                              {w.log.motivation && <span>M:{w.log.motivation}</span>}
                              {w.log.sleep && <span>S:{w.log.sleep}</span>}
                              {w.log.strength && <span>Str:{w.log.strength}</span>}
                              {w.log.recovery && <span>R:{w.log.recovery}</span>}
                              {w.log.mood && <span>Md:{w.log.mood}</span>}
                              {w.log.hunger && <span>H:{w.log.hunger}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-right"><span className="text-gray-400 text-sm">Week Total: </span><span className="text-white font-heading text-lg">{selectedWeek?.workouts.reduce((s, w) => s + (w.miles || 0), 0)} miles</span></div>
                </>
              )}

              {/* CREATE WEEK — Mon to Sun planner */}
              {clientTab === "create" && (
                <>
                  <h3 className="font-heading text-lg uppercase text-white">Create Week Plan</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="relative">
                      <label className="text-gray-400 text-xs block mb-1">Week Date Range</label>
                      <button onClick={() => setShowWeekPicker(!showWeekPicker)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-left text-sm focus:outline-none focus:border-accent hover:border-white/30 transition-colors flex items-center justify-between">
                        <span className={weekPlan.dateRange ? "text-white" : "text-gray-500"}>{weekPlan.dateRange || "Select a week..."}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </button>
                      {showWeekPicker && (
                        <div className="absolute top-full left-0 mt-2 z-50 bg-secondary border border-white/10 rounded-xl p-4 shadow-2xl w-80">
                          {/* Month nav */}
                          <div className="flex items-center justify-between mb-3">
                            <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1))} className="text-gray-400 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                            <span className="text-white text-sm font-medium">{pickerMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                            <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1))} className="text-gray-400 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                          </div>
                          {/* Day headers */}
                          <div className="grid grid-cols-7 gap-1 mb-1">
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                              <div key={d} className="text-center text-gray-500 text-xs py-1">{d}</div>
                            ))}
                          </div>
                          {/* Weeks */}
                          {getWeeksInMonth(pickerMonth).map((week, wi) => {
                            const monday = week[0];
                            const isSelected = selectedWeekStart && monday.getTime() === selectedWeekStart.getTime();
                            return (
                              <button key={wi} onClick={() => selectWeek(monday)} className={`w-full grid grid-cols-7 gap-1 rounded-lg py-1 transition-colors ${isSelected ? "bg-accent/20" : "hover:bg-white/5"}`}>
                                {week.map((day, di) => (
                                  <div key={di} className={`text-center text-xs py-1 rounded ${day.getMonth() === pickerMonth.getMonth() ? (isSelected ? "text-accent font-bold" : "text-white") : "text-gray-600"}`}>
                                    {day.getDate()}
                                  </div>
                                ))}
                              </button>
                            );
                          })}
                          <p className="text-gray-500 text-xs mt-2 text-center">Click a row to select that Monday–Sunday</p>
                        </div>
                      )}
                    </div>
                    <div><label className="text-gray-400 text-xs block mb-1">Week Focus</label><input type="text" value={weekPlan.focus} onChange={(e) => setWeekPlan({ ...weekPlan, focus: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Speed & Long Run" /></div>
                  </div>
                  <div className="mb-6">
                    <label className="text-gold text-xs font-heading uppercase block mb-1">Weekly Message to Client</label>
                    <textarea value={weekPlan.coachMessage} onChange={(e) => setWeekPlan({ ...weekPlan, coachMessage: e.target.value })} className="w-full bg-primary/50 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold resize-none" rows={3} placeholder="This message appears at the top of the client's training plan for the week. Use it to explain the week's focus, give motivation, or any important notes..." />
                    <p className="text-gray-600 text-xs mt-1">This shows at the top of the client&apos;s training view for this week</p>
                  </div>

                  {/* Mon-Sun rows */}
                  <div className="space-y-3">
                    {weekPlan.days.map((day, i) => (
                      <div key={`${day.day}-${i}`} className={`bg-primary/30 border border-white/5 rounded-xl p-4 ${day.type === "rest" ? "opacity-70" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-white font-heading text-sm uppercase w-24">{day.day}</span>
                          <select value={day.type} onChange={(e) => { updateDayPlan(i, "type", e.target.value); if (e.target.value === "rest") { updateDayPlan(i, "trainingType", "Rest"); updateDayPlan(i, "miles", ""); updateDayPlan(i, "description", ""); updateDayPlan(i, "paceTarget", ""); updateDayPlan(i, "location", ""); updateDayPlan(i, "title", ""); } else { if (day.title === "Complete Rest") updateDayPlan(i, "title", ""); updateDayPlan(i, "trainingType", ""); } }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                            <option value="" disabled>Workout Type</option><option value="run">Run</option><option value="cross">Cross Training</option><option value="rest">Rest</option>
                          </select>
                          {day.type === "rest" && <span className="text-green-400 text-xs font-medium">Rest Day</span>}
                          {day.type === "run" && (
                            <>
                              <select value={day.trainingType} onChange={(e) => updateDayPlan(i, "trainingType", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                                <option value="" disabled>Select Run Type</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals (Run/Walk)</option><option value="LongRun">Long Run</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery Run</option><option value="SpeedRoad">Speed Workout - Road</option><option value="SpeedTrack">Speed Workout - Track</option><option value="Tempo">Tempo Runs</option><option value="Threshold">Threshold Runs</option><option value="TimeTrial">Time Trial</option>
                              </select>
                              <div className="flex items-center gap-1">
                                <input type="text" value={day.miles} onChange={(e) => updateDayPlan(i, "miles", e.target.value)} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent" placeholder="Dist" />
                                <button type="button" onClick={() => updateDayPlan(i, "distanceUnit", (day as Record<string, string>).distanceUnit === "km" ? "mi" : "km")} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold transition-colors hover:border-accent">
                                  <span className={(day as Record<string, string>).distanceUnit === "km" ? "text-accent" : "text-white"}>
                                    {(day as Record<string, string>).distanceUnit === "km" ? "KM" : "MI"}
                                  </span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        {/* Run fields */}
                        {day.type === "run" && (
                          <>
                            <div className="grid md:grid-cols-3 gap-2 mt-3">
                              <input type="text" value={day.title} onChange={(e) => updateDayPlan(i, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title (e.g. Tempo Run)" />
                              <input type="text" value={day.description} onChange={(e) => updateDayPlan(i, "description", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Description (e.g. 2 WU | 6@7:15 | 2 CD)" />
                              <input type="text" value={day.paceTarget} onChange={(e) => updateDayPlan(i, "paceTarget", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Pace target" />
                            </div>
                            <div className="grid md:grid-cols-2 gap-2 mt-2">
                              <input type="text" value={day.location} onChange={(e) => updateDayPlan(i, "location", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" />
                              <input type="text" value={day.coachNotes} onChange={(e) => updateDayPlan(i, "coachNotes", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes" />
                            </div>
                            <div className="mt-2">
                              <button type="button" className="text-accent text-xs hover:underline">+ Add another workout to {day.day}</button>
                            </div>
                          </>
                        )}
                        {/* Cross Training - freeform text */}
                        {day.type === "cross" && (
                          <>
                            <div className="grid md:grid-cols-2 gap-2 mt-3">
                              <input type="text" value={day.title} onChange={(e) => updateDayPlan(i, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title (e.g. Orange Theory, Bike/Strength)" />
                              <input type="text" value={day.location} onChange={(e) => updateDayPlan(i, "location", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location (optional)" />
                            </div>
                            <div className="mt-2">
                              <textarea value={day.description} onChange={(e) => updateDayPlan(i, "description", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:border-accent resize-none" rows={3} placeholder="Full workout details (e.g. 30 min bike, upper body strength circuit, OT class, kickboxing...)" />
                            </div>
                            <div className="mt-2">
                              <input type="text" value={day.coachNotes} onChange={(e) => updateDayPlan(i, "coachNotes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes" />
                            </div>
                            <div className="mt-2">
                              <button type="button" className="text-accent text-xs hover:underline">+ Add another workout to {day.day}</button>
                            </div>
                          </>
                        )}
                        {/* Rest - only coach notes */}
                        {day.type === "rest" && (
                          <div className="mt-2">
                            <input type="text" value={day.coachNotes} onChange={(e) => updateDayPlan(i, "coachNotes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes (optional, e.g. 'Full rest, no activity')" />
                          </div>
                        )}
                        {/* Demo: additional workout added to Monday */}
                        {day.day === "Monday" && day.type === "run" && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-accent text-xs font-heading uppercase">Additional Workout</span>
                              <button type="button" className="text-red-400 text-xs hover:underline flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete this workout
                              </button>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <select defaultValue="cross" className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                                <option value="" disabled>Select Workout Type</option><option value="run">Run</option><option value="cross">Cross Training</option>
                              </select>
                            </div>
                            <div className="grid md:grid-cols-2 gap-2">
                              <input type="text" className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title" defaultValue="Strength Circuit" />
                              <input type="text" className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" />
                            </div>
                            <textarea className="w-full mt-2 bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Full workout details..." defaultValue="Upper body: 3x12 pushups, 3x10 rows, 3x15 shoulder press. Core: 3x30s plank, 3x20 russian twists" />
                            <input type="text" className="w-full mt-2 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes" defaultValue="Do this after your run, take 10 min rest between" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Save Week</button>
                    <button className="border border-white/10 text-gray-400 hover:text-white py-2 px-6 rounded-lg transition-colors">Clear All</button>
                  </div>
                </>
              )}

              {/* MESSAGES */}
              {clientTab === "messages" && (
                <>
                  {/* Send new message */}
                  <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-gold text-xs font-heading uppercase">Send Message to {selectedClientData.name.split(" ")[0]}</p>
                      {!showMessageForm && <button onClick={() => setShowMessageForm(true)} className="text-accent text-xs hover:underline">+ New Message</button>}
                    </div>
                    {showMessageForm ? (
                      <div className="space-y-3">
                        <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={4} placeholder="Write your weekly message, workout notes, motivation..." />
                        <div className="flex gap-3">
                          <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">Send</button>
                          <button onClick={() => { setShowMessageForm(false); setNewMessage(""); }} className="text-gray-400 hover:text-white text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm italic">Click &quot;+ New Message&quot; to send a message</p>
                    )}
                  </div>

                  {/* Message history with navigation */}
                  {clientMessages.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading text-sm uppercase text-gray-400">Message History</h4>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setMessageIndex(Math.max(0, messageIndex - 1))} disabled={messageIndex <= 0} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                          <span className="text-gray-500 text-xs">{messageIndex + 1} of {clientMessages.length}</span>
                          <button onClick={() => setMessageIndex(Math.min(clientMessages.length - 1, messageIndex + 1))} disabled={messageIndex >= clientMessages.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                        </div>
                      </div>
                      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
                        <p className="text-gray-500 text-xs mb-2">{clientMessages[messageIndex]?.date}</p>
                        <p className="text-gray-300 text-sm leading-relaxed">{clientMessages[messageIndex]?.message}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* MANAGE ACCOUNT */}
              {clientTab === "account" && (
                <>
                  <h3 className="font-heading text-lg uppercase text-white mb-4">Manage Account</h3>

                  {/* Edit Client Info */}
                  <div className="bg-primary/30 border border-white/5 rounded-xl p-5 mb-6">
                    <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Client Details</h4>
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div><label className="text-gray-500 text-xs block mb-1">Name</label><input type="text" defaultValue={selectedClientData.name} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Email</label><input type="email" defaultValue={selectedClientData.email} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Reset Password</label><input type="text" className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="New password" /></div>
                    </div>
                    <div className="grid md:grid-cols-4 gap-4 mb-4">
                      <div><label className="text-gray-500 text-xs block mb-1">Goal</label><input type="text" defaultValue={selectedClientData.goal} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Start Date</label><input type="text" defaultValue={selectedClientData.startDate} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Plan End</label><input type="text" defaultValue={selectedClientData.planDuration} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Status</label><p className={`text-sm font-medium mt-1 ${selectedClientData.status === "active" ? "text-green-400" : "text-gray-500"}`}>{selectedClientData.status === "active" ? "Active" : "Archived"}</p></div>
                    </div>
                    <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors">Save Changes</button>
                  </div>

                  {/* Payment Management */}
                  <div className="bg-primary/30 border border-white/5 rounded-xl p-5 mb-6">
                    <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Payment</h4>
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div><label className="text-gray-500 text-xs block mb-1">Total Owed</label><input type="number" defaultValue={selectedClientData.owed} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Total Paid</label><input type="number" defaultValue={selectedClientData.paid} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Balance</label><p className="text-white text-sm font-medium mt-1">${(selectedClientData.owed - selectedClientData.paid).toFixed(2)}</p></div>
                    </div>
                    <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors">Update Payment</button>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-primary/30 border border-red-500/20 rounded-xl p-5">
                    <h4 className="text-red-400 text-xs font-heading uppercase mb-4">Account Actions</h4>
                    <div className="flex flex-wrap gap-3">
                      {selectedClientData.status === "active" ? (
                        <button onClick={() => { const updated = clients.map(c => c.id === selectedClient ? { ...c, status: "archived" as const } : c); setClients(updated); }} className="border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 font-bold py-2 px-6 rounded-lg text-sm transition-colors">Archive Account</button>
                      ) : (
                        <button onClick={() => { const updated = clients.map(c => c.id === selectedClient ? { ...c, status: "active" as const } : c); setClients(updated); }} className="border border-green-500/30 text-green-400 hover:bg-green-500/10 font-bold py-2 px-6 rounded-lg text-sm transition-colors">Reactivate Account</button>
                      )}
                      {!showDeleteConfirm ? (
                        <button onClick={() => setShowDeleteConfirm(true)} className="border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold py-2 px-6 rounded-lg text-sm transition-colors">Delete Account</button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-red-400 text-sm">Are you sure? This cannot be undone.</span>
                          <button onClick={() => { setClients(clients.filter(c => c.id !== selectedClient)); setSelectedClient(null); setShowDeleteConfirm(false); }} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">Yes, Delete</button>
                          <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 hover:text-white text-sm">Cancel</button>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-xs mt-3">Archiving hides the client from your active list but keeps their data. Deleting permanently removes everything.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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
