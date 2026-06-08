"use client";

import { useState } from "react";
import Image from "next/image";

type WorkoutLog = { rpe: string; stress: string; notes: string; energy: string; motivation: string; sleep: string; strength: string; recovery: string; mood: string; hunger: string; actualMiles?: string; actualPace?: string; onPeriod?: string; };
type WorkoutDay = { id: string; day: string; date: string; type: "run" | "cross" | "rest"; trainingType: string; title: string; miles: number | null; description: string; paceTarget?: string; location?: string; coachNotes?: string; completed: boolean; log?: WorkoutLog; };
type WeekData = { weekId: string; label: string; dateRange: string; focus: string; coachMessage: string; status: "published" | "draft"; workouts: WorkoutDay[]; };
type CoachMessage = { id: string; date: string; from: string; message: string; };
type Client = { id: string; name: string; email: string; gender: "female" | "male"; goal: string; startDate: string; planDuration: string; owed: number; paid: number; status: "active" | "archived"; weeks: WeekData[]; messages: CoachMessage[]; };

export default function AdminPage() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<"plan" | "create" | "messages" | "drafts" | "account">("plan");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [editingWeek, setEditingWeek] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notifications, setNotifications] = useState({
    workoutCompleted: true,
    workoutSkipped: true,
    workoutPartial: true,
    clientMessage: true,
    dailySummary: false,
  });
  const [clientFilter, setClientFilter] = useState<"active" | "archived" | "all">("active");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date(2026, 5));
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [newClientForm, setNewClientForm] = useState({ name: "", email: "", password: "", gender: "female" as "female" | "male", goal: "", startDate: "", planDuration: "", owed: "" });

  const [weekPlan, setWeekPlan] = useState({
    dateRange: "", focus: "", coachMessage: "",
    days: [
      { day: "Monday", type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Tuesday", type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Wednesday", type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Thursday", type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Friday", type: "cross" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Saturday", type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
      { day: "Sunday", type: "rest" as string, trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" },
    ],
  });
  const updateDayPlan = (index: number, field: string, value: string) => { const updated = [...weekPlan.days]; (updated[index] as Record<string, string>)[field] = value; setWeekPlan({ ...weekPlan, days: updated }); };

  const getMonday = (d: Date) => { const date = new Date(d); const day = date.getDay(); const diff = day === 0 ? -6 : 1 - day; date.setDate(date.getDate() + diff); return date; };
  const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const getWeeksInMonth = (month: Date) => { const weeks: Date[][] = []; const firstDay = new Date(month.getFullYear(), month.getMonth(), 1); const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0); let current = getMonday(firstDay); while (current <= lastDay || weeks.length < 5) { const week: Date[] = []; for (let i = 0; i < 7; i++) { week.push(new Date(current)); current.setDate(current.getDate() + 1); } weeks.push(week); if (current > lastDay && weeks.length >= 4) break; } return weeks; };
  const selectWeek = (monday: Date) => { const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6); setSelectedWeekStart(monday); setWeekPlan({ ...weekPlan, dateRange: `${formatDate(monday)} - ${formatDate(sunday)}` }); setShowWeekPicker(false); };

  const [clients, setClients] = useState<Client[]>([
    { id: "c1", name: "Sarah M.", email: "sarah@email.com", gender: "female", goal: "War Eagle 50K", startDate: "2026-05-05", planDuration: "2026-07-26", owed: 525, paid: 175, status: "active", messages: [{ id: "m1", date: "Jun 9, 2026", message: "Training is loaded. The two workouts are Tuesday and Thursday. The important piece of the Descending 1200s is to not start out too fast." }, { id: "m2", date: "Jun 2, 2026", message: "Jeff will be here to guide you through hills week. Great job at War Eagle!" }], weeks: [
      { weekId: "w-curr", label: "This Week", dateRange: "Jun 9 - Jun 15", focus: "Descending 1200s & Race Pace", status: "published", coachMessage: "Training is loaded. Tuesday and Thursday are the key workouts.", workouts: [
        { id: "w1-mon", day: "Monday", date: "Jun 9", type: "cross", trainingType: "CrossTraining", title: "Gym Session", miles: null, description: "Cross training class", completed: false },
        { id: "w1-tue", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "SpeedTrack", title: "Descending 1200s", miles: 8, description: "3 mi WU | Descending 1200s | 1 mi CD", paceTarget: "Reps from 8:30 down to 7:40", location: "Kickapoo Track", coachNotes: "Rep 1: 400@8:30, 400@8:20, 400@8:10, Recovery. Rep 2-4 descend further.", completed: false },
        { id: "w1-wed", day: "Wednesday", date: "Jun 11", type: "run", trainingType: "Easy", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: false },
        { id: "w1-thu", day: "Thursday", date: "Jun 12", type: "run", trainingType: "ClosePace", title: "Race Pace", miles: 10, description: "2 mi WU | 7mi @ 8:50 | 1 CD", paceTarget: "8:20-8:50/mi", completed: false },
        { id: "w1-fri", day: "Friday", date: "Jun 13", type: "cross", trainingType: "CrossTraining", title: "Gym Session", miles: null, description: "Cross training class", completed: false },
        { id: "w1-sat", day: "Saturday", date: "Jun 14", type: "run", trainingType: "LongRun", title: "Long Run", miles: 17, description: "17 mi default pace", completed: false },
        { id: "w1-sun", day: "Sunday", date: "Jun 15", type: "run", trainingType: "Recovery", title: "Easy Recovery", miles: 7, description: "7 easy recovery", completed: false },
      ]},
      { weekId: "w-prev", label: "Last Week", dateRange: "Jun 2 - Jun 8", focus: "Hills & Specificity", status: "published", coachMessage: "Specificity training on hills. Jeff will guide you.", workouts: [
        { id: "w2-mon", day: "Monday", date: "Jun 2", type: "cross", trainingType: "CrossTraining", title: "Bike / Strength", miles: null, description: "Bike and strength work.", completed: true, log: { rpe: "6", stress: "", notes: "Felt good", energy: "7", motivation: "8", sleep: "7", strength: "7", recovery: "6", mood: "8", hunger: "7" } },
        { id: "w2-tue", day: "Tuesday", date: "Jun 3", type: "run", trainingType: "Hills", title: "HILLS - Technique Day", miles: 7, description: "2 WU | 1 down | 1 up | 1 down | 1 up | 1 CD", paceTarget: "Downhill close to race pace", location: "Hills", completed: true, log: { rpe: "8", stress: "", notes: "Jeff was great help", energy: "8", motivation: "9", sleep: "7", strength: "7", recovery: "7", mood: "9", hunger: "6", actualMiles: "7.2", actualPace: "8:45", onPeriod: "yes" } },
        { id: "w2-wed", day: "Wednesday", date: "Jun 4", type: "run", trainingType: "Easy", title: "Easy Run", miles: 5, description: "5 mi easy", location: "Table Rock Coffee Roasters", completed: true, log: { rpe: "4", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "6", recovery: "7", mood: "7", hunger: "8", onPeriod: "yes" } },
        { id: "w2-thu", day: "Thursday", date: "Jun 5", type: "run", trainingType: "SpeedRoad", title: "Strides", miles: 7, description: "7 mi w/strides", completed: true, log: { rpe: "7", stress: "", notes: "Legs heavy", energy: "6", motivation: "7", sleep: "6", strength: "6", recovery: "5", mood: "7", hunger: "7" } },
        { id: "w2-fri", day: "Friday", date: "Jun 6", type: "cross", trainingType: "CrossTraining", title: "Bike / Strength", miles: null, description: "Bike and strength.", completed: true, log: { rpe: "5", stress: "", notes: "", energy: "7", motivation: "7", sleep: "8", strength: "7", recovery: "7", mood: "8", hunger: "7" } },
        { id: "w2-sat", day: "Saturday", date: "Jun 7", type: "run", trainingType: "RacePace", title: "Race Pace Workout", miles: 12, description: "5 WU | 5@9:15 (2 min rest) | 2 CD", paceTarget: "9:15/mi", completed: true, log: { rpe: "9", stress: "Travel Day", notes: "War Eagle!", energy: "8", motivation: "9", sleep: "7", strength: "8", recovery: "6", mood: "9", hunger: "8", actualMiles: "12.1", actualPace: "9:12" } },
        { id: "w2-sun", day: "Sunday", date: "Jun 8", type: "rest", trainingType: "Rest", title: "Complete Rest", miles: null, description: "Rest day.", completed: true, log: { rpe: "", stress: "", notes: "Great week", energy: "8", motivation: "8", sleep: "9", strength: "7", recovery: "8", mood: "9", hunger: "7" } },
      ]},
      { weekId: "w-draft1", label: "Next Week", dateRange: "Jun 16 - Jun 22", focus: "Tempo & Long Run Build", status: "draft", coachMessage: "Building into the long run. Stay disciplined on tempo day.", workouts: [
        { id: "d1-mon", day: "Monday", date: "Jun 16", type: "cross", trainingType: "CrossTraining", title: "Gym Session", miles: null, description: "Cross training class", completed: false },
        { id: "d1-tue", day: "Tuesday", date: "Jun 17", type: "run", trainingType: "Tempo", title: "Tempo Run", miles: 9, description: "2 WU | 5@8:30 | 2 CD", paceTarget: "8:30/mi", completed: false },
        { id: "d1-wed", day: "Wednesday", date: "Jun 18", type: "run", trainingType: "Easy", title: "Easy Run", miles: 5, description: "5 mi easy", completed: false },
        { id: "d1-thu", day: "Thursday", date: "Jun 19", type: "run", trainingType: "SpeedTrack", title: "Track 800s", miles: 7, description: "1 WU | 6x800/400 | 1 CD", paceTarget: "7:20-7:30", location: "Kickapoo Track", completed: false },
        { id: "d1-fri", day: "Friday", date: "Jun 20", type: "rest", trainingType: "Rest", title: "Rest", miles: null, description: "Complete rest", completed: false },
        { id: "d1-sat", day: "Saturday", date: "Jun 21", type: "run", trainingType: "LongRun", title: "Long Run", miles: 20, description: "20 mi easy effort", completed: false },
        { id: "d1-sun", day: "Sunday", date: "Jun 22", type: "run", trainingType: "Recovery", title: "Recovery", miles: 5, description: "5 mi very easy", completed: false },
      ]},
    ]},
    { id: "c2", name: "Mike T.", email: "mike@email.com", gender: "male", goal: "Sub-4 Marathon", startDate: "2026-04-01", planDuration: "2026-10-12", owed: 400, paid: 400, status: "active", messages: [], weeks: [{ weekId: "mw1", label: "This Week", dateRange: "Jun 9 - Jun 15", focus: "Tempo & Long Run", status: "published", coachMessage: "Big week. Stay disciplined.", workouts: [{ id: "m1", day: "Tuesday", date: "Jun 10", type: "run", trainingType: "Tempo", title: "Tempo Run", miles: 10, description: "2 WU | 6@7:15 | 2 CD", paceTarget: "7:15/mi", completed: true, log: { rpe: "7", stress: "", notes: "Felt strong", energy: "9", motivation: "9", sleep: "8", strength: "8", recovery: "7", mood: "8", hunger: "7", actualMiles: "10.0", actualPace: "7:18" } }] }] },
    { id: "c3", name: "Jessica R.", email: "jessica@email.com", gender: "female", goal: "First 5K", startDate: "2026-06-01", planDuration: "2026-08-15", owed: 200, paid: 100, status: "active", messages: [], weeks: [] },
    { id: "c4", name: "David K.", email: "david@email.com", gender: "male", goal: "Half Marathon PR", startDate: "2026-03-15", planDuration: "2026-09-20", owed: 450, paid: 450, status: "active", messages: [], weeks: [] },
    { id: "c5", name: "Amy L.", email: "amy@email.com", gender: "female", goal: "Trail 50K", startDate: "2026-04-10", planDuration: "2026-11-01", owed: 600, paid: 300, status: "active", messages: [], weeks: [] },
    { id: "c6", name: "Brian W.", email: "brian@email.com", gender: "male", goal: "BQ Marathon", startDate: "2026-01-15", planDuration: "2026-10-15", owed: 500, paid: 500, status: "active", messages: [], weeks: [] },
    { id: "c7", name: "Carla P.", email: "carla@email.com", gender: "female", goal: "100 Miler", startDate: "2026-02-01", planDuration: "2026-12-01", owed: 800, paid: 400, status: "active", messages: [], weeks: [] },
    { id: "c8", name: "Derek H.", email: "derek@email.com", gender: "male", goal: "Couch to 5K", startDate: "2026-05-20", planDuration: "2026-08-20", owed: 150, paid: 75, status: "active", messages: [], weeks: [] },
    { id: "c9", name: "Emily S.", email: "emily@email.com", gender: "female", goal: "Marathon Finish", startDate: "2026-03-01", planDuration: "2026-10-30", owed: 500, paid: 500, status: "active", messages: [], weeks: [] },
    { id: "c10", name: "Frank M.", email: "frank@email.com", gender: "male", goal: "Sub-20 5K", startDate: "2026-04-15", planDuration: "2026-09-01", owed: 300, paid: 300, status: "active", messages: [], weeks: [] },
    { id: "c11", name: "Grace T.", email: "grace@email.com", gender: "female", goal: "Trail Half", startDate: "2026-05-01", planDuration: "2026-10-15", owed: 400, paid: 200, status: "active", messages: [], weeks: [] },
    { id: "c12", name: "Tom R.", email: "tom@email.com", gender: "male", goal: "10K PR", startDate: "2025-11-01", planDuration: "2026-03-01", owed: 300, paid: 300, status: "archived", messages: [], weeks: [] },
    { id: "c13", name: "Lisa N.", email: "lisa@email.com", gender: "female", goal: "First Half Marathon", startDate: "2025-09-15", planDuration: "2026-02-01", owed: 400, paid: 400, status: "archived", messages: [], weeks: [] },
    { id: "c14", name: "Kevin J.", email: "kevin@email.com", gender: "male", goal: "Ultra 50 Mile", startDate: "2025-10-01", planDuration: "2026-04-15", owed: 600, paid: 600, status: "archived", messages: [], weeks: [] },
    { id: "c15", name: "Rachel B.", email: "rachel@email.com", gender: "female", goal: "Postpartum Return", startDate: "2025-12-01", planDuration: "2026-05-01", owed: 350, paid: 350, status: "archived", messages: [], weeks: [] },
  ]);

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const selectedClientWeeks = selectedClientData?.weeks || [];
  const publishedWeeks = selectedClientWeeks.filter(w => w.status === "published");
  const draftWeeks = selectedClientWeeks.filter(w => w.status === "draft");
  const selectedWeek = publishedWeeks[selectedWeekIndex];
  const allClientWorkouts = publishedWeeks.flatMap((w) => w.workouts);
  const completedWorkouts = allClientWorkouts.filter((w) => w.completed);
  const totalMilesCompleted = allClientWorkouts.filter(w => w.log).reduce((s, w) => s + (Number(w.log?.actualMiles) || w.miles || 0), 0);
  const totalMilesProgrammed = allClientWorkouts.reduce((s, w) => s + (w.miles || 0), 0);
  const clientMessages = selectedClientData?.messages || [];
  const filteredClients = clients.filter(c => (clientFilter === "all" || c.status === clientFilter) && c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  const publishWeek = (weekId: string) => { const updated = clients.map(c => { if (c.id === selectedClient) { return { ...c, weeks: c.weeks.map(w => w.weekId === weekId ? { ...w, status: "published" as const } : w) }; } return c; }); setClients(updated); };
  const unpublishWeek = (weekId: string) => { const updated = clients.map(c => { if (c.id === selectedClient) { return { ...c, weeks: c.weeks.map(w => w.weekId === weekId ? { ...w, status: "draft" as const } : w) }; } return c; }); setClients(updated); };

  const getTrainingTypeLabel = (tt: string) => { switch (tt) { case "SpeedRoad": return "Speed Workout - Road"; case "SpeedTrack": return "Speed Workout - Track"; case "Tempo": return "Tempo Runs"; case "Threshold": return "Threshold Runs"; case "LongRun": return "Long Run"; case "Easy": return "Easy Run"; case "Recovery": return "Recovery Run"; case "Hills": return "Hill Repeats"; case "Intervals": return "Intervals (Run/Walk)"; case "RacePace": return "Race Pace"; case "ClosePace": return "Close to Race Pace"; case "TimeTrial": return "Time Trial"; case "CrossTraining": return "Cross Training"; case "OrangeTheory": return "Cross Training"; case "Rest": return "Rest"; default: return tt; } };
  const getTypeBadge = (type: string) => { switch (type) { case "run": return "bg-accent/20 text-accent"; case "cross": return "bg-gold/20 text-gold"; case "rest": return "bg-green-500/20 text-green-400"; default: return "bg-gray-500/20 text-gray-400"; } };
  const getTypeLabel = (type: string) => { switch (type) { case "run": return "Run"; case "cross": return "Cross Training"; case "rest": return "Rest"; default: return type; } };
  const getTrainingTypeBadge = (tt: string) => { switch (tt) { case "SpeedRoad": case "SpeedTrack": return "bg-red-500/20 text-red-400 border-red-500/30"; case "Tempo": case "Threshold": return "bg-orange-500/20 text-orange-400 border-orange-500/30"; case "LongRun": case "Easy": case "Recovery": return "bg-blue-500/20 text-blue-400 border-blue-500/30"; case "Hills": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; case "RacePace": case "ClosePace": return "bg-green-500/20 text-green-300 border-green-500/30"; case "Intervals": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"; case "TimeTrial": return "bg-red-500/20 text-red-300 border-red-500/30"; case "CrossTraining": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"; } };

  return (
    <div className="min-h-screen bg-primary md:flex">
      {/* LEFT SIDEBAR - Client List (full screen on mobile, sidebar on desktop) */}
      <aside className={`${selectedClient ? "hidden md:flex" : "flex"} w-full md:w-72 bg-secondary/50 md:border-r border-white/10 flex-col h-screen md:sticky md:top-0`}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <Image src="/IMG_5861.PNG" alt="Logo" width={36} height={36} />
            <div><p className="text-white font-heading text-sm uppercase">Coach Admin</p><p className="text-gold text-xs">Crystal</p></div>
          </div>
          <input type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients..." className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-accent mb-2" />
          <div className="flex gap-1 mb-2">
            {[{ key: "active", label: "Active" }, { key: "archived", label: "Archived" }, { key: "all", label: "All" }].map((f) => (
              <button key={f.key} onClick={() => setClientFilter(f.key as "active" | "archived" | "all")} className={`px-2 py-1 rounded text-xs transition-colors flex-1 ${clientFilter === f.key ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>{f.label}</button>
            ))}
          </div>
          <button onClick={() => setShowCreateClient(!showCreateClient)} className="w-full bg-accent hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">+ New Client</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredClients.map((client) => {
            const allWk = client.weeks.filter(w => w.status === "published").flatMap(w => w.workouts);
            const doneWk = allWk.filter(w => w.completed);
            const isSelected = selectedClient === client.id;
            return (
              <button key={client.id} onClick={() => { setSelectedClient(client.id); setSelectedWeekIndex(0); setClientTab("plan"); setEditingWeek(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 ${isSelected ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-white/5"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? "bg-accent text-white" : "bg-white/10 text-gray-400"}`}>{client.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{client.name}</p>
                  <p className="text-gray-500 text-xs truncate">{client.goal}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-gray-400 text-xs">{doneWk.length}/{allWk.length}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-white/10 space-y-2">
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(true); }} className="w-full flex items-center gap-2 text-gray-400 hover:text-white text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Notification Settings
          </button>
          <a href="/" className="w-full flex items-center gap-2 text-gray-400 hover:text-accent text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>Logout</a>
        </div>
      </aside>

      {/* MAIN CONTENT (full screen on mobile when client selected) */}
      <main className={`${!selectedClient ? "hidden md:block" : "block"} flex-1 min-h-screen overflow-y-auto`}>
        {/* Mobile Back Button */}
        {selectedClient && (
          <button onClick={() => setSelectedClient(null)} className="md:hidden flex items-center gap-2 px-4 py-3 text-gray-400 hover:text-white border-b border-white/10 w-full bg-secondary/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm">All Clients</span>
          </button>
        )}
        {/* Create Client Modal */}
        {showCreateClient && (
          <div className="p-6 bg-secondary/30 border-b border-white/10">
            <h3 className="font-heading text-lg uppercase text-accent mb-4">Create New Client Account</h3>
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div><label className="text-gray-400 text-xs block mb-1">Full Name</label><input type="text" value={newClientForm.name} onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Sarah Miller" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Email</label><input type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="client@email.com" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Password</label><input type="text" value={newClientForm.password} onChange={(e) => setNewClientForm({ ...newClientForm, password: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Temp password" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Gender</label><select value={newClientForm.gender} onChange={(e) => setNewClientForm({ ...newClientForm, gender: e.target.value as "female" | "male" })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="female">Female</option><option value="male">Male</option></select></div>
            </div>
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div><label className="text-gray-400 text-xs block mb-1">Goal</label><input type="text" value={newClientForm.goal} onChange={(e) => setNewClientForm({ ...newClientForm, goal: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="First 5K" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Start Date</label><input type="date" value={newClientForm.startDate} onChange={(e) => setNewClientForm({ ...newClientForm, startDate: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Plan End</label><input type="date" value={newClientForm.planDuration} onChange={(e) => setNewClientForm({ ...newClientForm, planDuration: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Owed ($)</label><input type="text" value={newClientForm.owed} onChange={(e) => setNewClientForm({ ...newClientForm, owed: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="300" /></div>
            </div>
            <div className="flex gap-3"><button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm">Create Account</button><button onClick={() => setShowCreateClient(false)} className="text-gray-400 hover:text-white text-sm">Cancel</button></div>
          </div>
        )}

        {selectedClientData ? (
          <div className="p-6 space-y-6">
            {/* Client Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-heading text-2xl uppercase text-white">{selectedClientData.name}</h2>
                <p className="text-gray-400 text-sm">{selectedClientData.goal}</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center"><p className="text-accent font-heading text-xl">{completedWorkouts.length}/{allClientWorkouts.length}</p><p className="text-gray-500 text-xs">Done</p></div>
                <div className="text-center"><p className="text-white font-heading text-xl">{totalMilesCompleted.toFixed(0)}<span className="text-gray-500 text-sm">/{totalMilesProgrammed}</span></p><p className="text-gray-500 text-xs">Miles</p></div>
                <div className="text-center"><p className="text-green-400 font-heading text-xl">${selectedClientData.paid}</p><p className="text-gray-500 text-xs">/${selectedClientData.owed}</p></div>
                {draftWeeks.length > 0 && <div className="text-center"><p className="text-yellow-400 font-heading text-xl">{draftWeeks.length}</p><p className="text-gray-500 text-xs">Drafts</p></div>}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 flex-wrap">
              {[{ key: "plan", label: "Training & Logs" }, { key: "create", label: "Create Week" }, { key: "drafts", label: `Drafts (${draftWeeks.length})` }, { key: "messages", label: "Messages" }, { key: "account", label: "Account" }].map((tab) => (
                <button key={tab.key} onClick={() => { setClientTab(tab.key as typeof clientTab); setEditingWeek(false); }} className={`px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-colors ${clientTab === tab.key ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>{tab.label}</button>
              ))}
            </div>

            {/* TRAINING & LOGS */}
            {clientTab === "plan" && publishedWeeks.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <button onClick={() => setSelectedWeekIndex(Math.min(selectedWeekIndex + 1, publishedWeeks.length - 1))} disabled={selectedWeekIndex >= publishedWeeks.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                  <div className="text-center">
                    <p className="font-heading text-lg uppercase text-white">{selectedWeek?.label}</p>
                    <p className="text-gray-400 text-xs">{selectedWeek?.dateRange} &mdash; {selectedWeek?.focus}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedWeekIndex === 0 && <button onClick={() => setEditingWeek(!editingWeek)} className="text-accent text-xs hover:underline">{editingWeek ? "Cancel Edit" : "Edit Week"}</button>}
                    {selectedWeekIndex > 0 && <span className="text-gray-600 text-xs italic">Past weeks are locked</span>}
                    <button onClick={() => setSelectedWeekIndex(Math.max(selectedWeekIndex - 1, 0))} disabled={selectedWeekIndex <= 0} className="text-gray-400 hover:text-white disabled:opacity-30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                  </div>
                </div>

                {/* Coach Message */}
                <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                  <p className="text-gold text-xs font-heading uppercase mb-1">Weekly Message</p>
                  {editingWeek ? <textarea defaultValue={selectedWeek?.coachMessage} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={2} /> : <p className="text-gray-300 text-sm">{selectedWeek?.coachMessage || <span className="text-gray-600 italic">No message</span>}</p>}
                </div>

                {/* Workouts */}
                <div className="space-y-3">
                  {selectedWeek?.workouts.map((w, wi) => (
                    <div key={w.id} className="bg-primary/30 border border-white/5 rounded-xl p-4">
                      {!editingWeek ? (
                        <>
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${w.completed ? "bg-green-500" : "bg-gray-600"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-medium text-sm">{w.day}</span>
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(w.type)}`}>{getTypeLabel(w.type)}</span>
                                {w.type === "run" && w.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(w.trainingType)}`}>{getTrainingTypeLabel(w.trainingType)}</span>}
                                {w.completed && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Done</span>}
                              </div>
                              <p className="text-gray-300 text-sm mt-0.5">{w.title} {w.description && `— ${w.description}`}</p>
                              {w.paceTarget && <p className="text-accent text-xs mt-0.5">{w.paceTarget}</p>}
                            </div>
                            {w.miles && <span className="text-white font-heading text-lg flex-shrink-0">{w.miles}<span className="text-gray-500 text-xs ml-0.5">mi</span></span>}
                          </div>
                          {w.log && (
                            <div className="mt-3 ml-7 pl-4 border-l-2 border-accent/30">
                              <div className="flex flex-wrap gap-3 text-xs">
                                {w.log.rpe && <span><span className="text-gray-500">Effort:</span> <span className="text-white">{w.log.rpe}/10</span></span>}
                                {w.log.actualMiles && <span><span className="text-gray-500">Miles:</span> <span className="text-white">{w.log.actualMiles}</span></span>}
                                {w.log.actualPace && <span><span className="text-gray-500">Pace:</span> <span className="text-white">{w.log.actualPace}</span></span>}
                                {w.log.stress && <span><span className="text-gray-500">Stress:</span> <span className="text-white">{w.log.stress}</span></span>}
                                {w.log.onPeriod === "yes" && <span className="text-pink-400 font-medium">On Period</span>}
                              </div>
                              {w.log.notes && <p className="text-gray-400 text-xs mt-1">{w.log.notes}</p>}
                            </div>
                          )}
                        </>
                      ) : (
                        /* EDIT MODE - full workout editing */
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-white font-heading text-sm uppercase w-24">{w.day}</span>
                            <select defaultValue={w.type} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                              <option value="run">Run</option><option value="cross">Cross Training</option><option value="rest">Rest</option>
                            </select>
                            {w.type === "run" && (
                              <>
                                <select defaultValue={w.trainingType} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                                  <option value="" disabled>Select Run Type</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals (Run/Walk)</option><option value="LongRun">Long Run</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery Run</option><option value="SpeedRoad">Speed Workout - Road</option><option value="SpeedTrack">Speed Workout - Track</option><option value="Tempo">Tempo Runs</option><option value="Threshold">Threshold Runs</option><option value="TimeTrial">Time Trial</option>
                                </select>
                                <input type="text" defaultValue={w.miles?.toString() || ""} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent" placeholder="Miles" />
                              </>
                            )}
                          </div>
                          {w.type !== "rest" && (
                            <div className="grid md:grid-cols-3 gap-2">
                              <input type="text" defaultValue={w.title} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title" />
                              <input type="text" defaultValue={w.description} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Description" />
                              <input type="text" defaultValue={w.paceTarget || ""} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Pace target" />
                            </div>
                          )}
                          {w.type === "run" && (
                            <div className="grid md:grid-cols-2 gap-2">
                              <input type="text" defaultValue={w.location || ""} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" />
                              <input type="text" defaultValue={w.coachNotes || ""} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes" />
                            </div>
                          )}
                          {w.type === "cross" && <textarea defaultValue={w.description} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Full workout details..." />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {editingWeek && <div className="flex gap-3"><button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm">Save Changes</button><button onClick={() => { if (selectedWeek) unpublishWeek(selectedWeek.weekId); }} className="border border-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm">Unpublish (move to drafts)</button></div>}
              </div>
            )}
            {clientTab === "plan" && publishedWeeks.length === 0 && <p className="text-gray-500 text-center py-12">No published weeks yet. Create a week plan and publish it.</p>}

            {/* DRAFTS */}
            {clientTab === "drafts" && (
              <div className="space-y-4">
                <h3 className="font-heading text-lg uppercase text-white">Unpublished Week Plans</h3>
                <p className="text-gray-400 text-sm">These are hidden from {selectedClientData.name.split(" ")[0]}. Publish when ready.</p>
                {draftWeeks.length === 0 && <p className="text-gray-500 text-center py-8">No drafts. Create a new week to get started.</p>}
                {draftWeeks.map((week) => (
                  <div key={week.weekId} className="bg-primary/30 border border-yellow-500/20 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2"><h4 className="text-white font-medium">{week.dateRange}</h4><span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Draft</span></div>
                        <p className="text-gray-400 text-xs">{week.focus} &bull; {week.workouts.length} workouts</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => publishWeek(week.weekId)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-xs">Publish</button>
                        <button className="text-gray-400 hover:text-white text-xs border border-white/10 py-2 px-3 rounded-lg">Edit</button>
                        <button className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {week.workouts.map((w) => (
                        <div key={w.id} className="bg-primary/50 rounded p-2 text-center">
                          <p className="text-gray-500 text-xs">{w.day.slice(0,3)}</p>
                          <p className="text-white text-xs font-medium truncate">{w.title || getTypeLabel(w.type)}</p>
                          {w.miles && <p className="text-accent text-xs">{w.miles}mi</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CREATE WEEK */}
            {clientTab === "create" && (
              <div className="space-y-4">
                <h3 className="font-heading text-lg uppercase text-white">Create Week Plan</h3>
                <p className="text-gray-400 text-sm">New weeks are saved as <span className="text-yellow-400">Draft</span> until you publish them.</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-gray-400 text-xs block mb-1">Week Date Range</label>
                    <button onClick={() => setShowWeekPicker(!showWeekPicker)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between hover:border-white/30"><span className={weekPlan.dateRange ? "text-white" : "text-gray-500"}>{weekPlan.dateRange || "Select a week..."}</span><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                    {showWeekPicker && (
                      <div className="absolute top-full left-0 mt-2 z-50 bg-secondary border border-white/10 rounded-xl p-4 shadow-2xl w-80">
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1))} className="text-gray-400 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                          <span className="text-white text-sm">{pickerMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                          <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1))} className="text-gray-400 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-1">{["M","T","W","T","F","S","S"].map((d,i) => <div key={i} className="text-center text-gray-500 text-xs py-1">{d}</div>)}</div>
                        {getWeeksInMonth(pickerMonth).map((week, wi) => { const monday = week[0]; const isSelected = selectedWeekStart && monday.getTime() === selectedWeekStart.getTime(); return (
                          <button key={wi} onClick={() => selectWeek(monday)} className={`w-full grid grid-cols-7 gap-1 rounded-lg py-1 transition-colors ${isSelected ? "bg-accent/20" : "hover:bg-white/5"}`}>
                            {week.map((day, di) => <div key={di} className={`text-center text-xs py-1 rounded ${day.getMonth() === pickerMonth.getMonth() ? (isSelected ? "text-accent font-bold" : "text-white") : "text-gray-600"}`}>{day.getDate()}</div>)}
                          </button>); })}
                        <p className="text-gray-500 text-xs mt-2 text-center">Click a row to select Mon-Sun</p>
                      </div>
                    )}
                  </div>
                  <div><label className="text-gray-400 text-xs block mb-1">Week Focus</label><input type="text" value={weekPlan.focus} onChange={(e) => setWeekPlan({ ...weekPlan, focus: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Speed & Long Run" /></div>
                </div>
                <div><label className="text-gold text-xs font-heading uppercase block mb-1">Weekly Message to Client</label><textarea value={weekPlan.coachMessage} onChange={(e) => setWeekPlan({ ...weekPlan, coachMessage: e.target.value })} className="w-full bg-primary/50 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold resize-none" rows={2} placeholder="Shown at top of client's plan when published..." /></div>

                {/* Mon-Sun */}
                <div className="space-y-3">
                  {weekPlan.days.map((day, i) => (
                    <div key={day.day} className={`bg-primary/30 border border-white/5 rounded-xl p-4 ${day.type === "rest" ? "opacity-70" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-heading text-sm uppercase w-24">{day.day}</span>
                        <select value={day.type || ""} onChange={(e) => { updateDayPlan(i, "type", e.target.value); if (e.target.value === "rest") { updateDayPlan(i, "trainingType", "Rest"); updateDayPlan(i, "title", ""); updateDayPlan(i, "miles", ""); } else { updateDayPlan(i, "trainingType", ""); if (day.title === "") updateDayPlan(i, "title", ""); } }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                          <option value="" disabled>Select Workout Type</option><option value="run">Run</option><option value="cross">Cross Training</option><option value="rest">Rest</option>
                        </select>
                        {day.type === "rest" && <span className="text-green-400 text-xs">Rest Day</span>}
                        {day.type === "run" && (
                          <>
                            <select value={day.trainingType || ""} onChange={(e) => updateDayPlan(i, "trainingType", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                              <option value="" disabled>Select Run Type</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals (Run/Walk)</option><option value="LongRun">Long Run</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery Run</option><option value="SpeedRoad">Speed Workout - Road</option><option value="SpeedTrack">Speed Workout - Track</option><option value="Tempo">Tempo Runs</option><option value="Threshold">Threshold Runs</option><option value="TimeTrial">Time Trial</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <input type="text" value={day.miles} onChange={(e) => updateDayPlan(i, "miles", e.target.value)} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent" placeholder="Dist" />
                              <button type="button" onClick={() => updateDayPlan(i, "distanceUnit", day.distanceUnit === "km" ? "mi" : "km")} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold hover:border-accent"><span className={day.distanceUnit === "km" ? "text-accent" : "text-white"}>{day.distanceUnit === "km" ? "Kilometre" : "Mile"}</span></button>
                            </div>
                          </>
                        )}
                      </div>
                      {day.type === "run" && (<div className="grid md:grid-cols-3 gap-2 mt-3"><input type="text" value={day.title} onChange={(e) => updateDayPlan(i, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title" /><input type="text" value={day.description} onChange={(e) => updateDayPlan(i, "description", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Description" /><input type="text" value={day.paceTarget} onChange={(e) => updateDayPlan(i, "paceTarget", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Pace target" /></div>)}
                      {day.type === "run" && (<div className="grid md:grid-cols-2 gap-2 mt-2"><input type="text" value={day.location} onChange={(e) => updateDayPlan(i, "location", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" /><input type="text" value={day.coachNotes} onChange={(e) => updateDayPlan(i, "coachNotes", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes" /></div>)}
                      {day.type === "cross" && (<><div className="grid md:grid-cols-2 gap-2 mt-3"><input type="text" value={day.title} onChange={(e) => updateDayPlan(i, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title (e.g. Orange Theory)" /><input type="text" value={day.location} onChange={(e) => updateDayPlan(i, "location", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" /></div><textarea value={day.description} onChange={(e) => updateDayPlan(i, "description", e.target.value)} className="w-full mt-2 bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Full workout details..." /></>)}
                      {day.type === "rest" && <div className="mt-2"><input type="text" value={day.coachNotes} onChange={(e) => updateDayPlan(i, "coachNotes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes (optional)" /></div>}
                      {day.type !== "rest" && <button type="button" className="text-accent text-xs hover:underline mt-2">+ Add another workout</button>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3"><button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm">Save as Draft</button><button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg text-sm">Save & Publish</button></div>
              </div>
            )}

            {/* MESSAGES - full chat thread like client sees */}
            {clientTab === "messages" && (
              <div className="space-y-4">
                <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                  {!showMessageForm ? <div className="flex items-center justify-between"><p className="text-gold text-xs font-heading uppercase">Message {selectedClientData.name.split(" ")[0]}</p><button onClick={() => setShowMessageForm(true)} className="text-accent text-xs hover:underline">+ New Message</button></div> : <div className="space-y-3"><textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={3} placeholder="Write message..." /><div className="flex gap-3"><button className="bg-accent text-white font-bold py-2 px-4 rounded-lg text-sm">Send</button><button onClick={() => { setShowMessageForm(false); setNewMessage(""); }} className="text-gray-400 text-sm">Cancel</button></div><p className="text-gray-600 text-xs">Client will receive an email notification</p></div>}
                </div>
                {/* Chat thread - same view as client sees */}
                <div className="space-y-3">
                  {clientMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.from === "client" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl p-4 ${msg.from === "client" ? "bg-secondary/50 border border-white/10" : "bg-accent/10 border border-accent/30"}`}>
                        <div className="flex items-center gap-2 mb-1"><span className={`text-xs font-heading uppercase ${msg.from === "client" ? "text-white" : "text-accent"}`}>{msg.from === "client" ? selectedClientData.name.split(" ")[0] : "You"}</span><span className="text-gray-500 text-xs">{msg.date}</span></div>
                        <p className="text-gray-300 text-sm">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                  {clientMessages.length === 0 && <p className="text-gray-500 text-center py-8 text-sm">No messages yet. Start the conversation!</p>}
                </div>
              </div>
            )}

            {/* ACCOUNT */}
            {clientTab === "account" && (
              <div className="space-y-6">
                {/* Profile Picture */}
                <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
                  <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Profile Picture</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-gray-400">{selectedClientData.name.charAt(0)}</div>
                    <div>
                      <button className="bg-primary/50 border border-white/10 hover:border-accent text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors">Upload Photo</button>
                      <p className="text-gray-600 text-xs mt-1">JPG or PNG, max 2MB. Optional.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
                  <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Client Details</h4>
                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div><label className="text-gray-500 text-xs block mb-1">Name</label><input type="text" defaultValue={selectedClientData.name} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                    <div><label className="text-gray-500 text-xs block mb-1">Email</label><input type="email" defaultValue={selectedClientData.email} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                    <div><label className="text-gray-500 text-xs block mb-1">Start Date</label><input type="date" defaultValue={selectedClientData.startDate} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" /></div>
                    <div><label className="text-gray-500 text-xs block mb-1">Plan End</label><input type="date" defaultValue={selectedClientData.planDuration} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" /></div>
                  </div>
                  <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm">Save Details</button>
                </div>

                {/* Payment Management */}
                <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
                  <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Payment</h4>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div><label className="text-gray-500 text-xs block mb-1">Total Owed ($)</label><input type="number" defaultValue={selectedClientData.owed} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                    <div><label className="text-gray-500 text-xs block mb-1">Total Paid ($)</label><input type="number" defaultValue={selectedClientData.paid} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" /></div>
                    <div><label className="text-gray-500 text-xs block mb-1">Balance</label><p className="text-white text-sm font-bold mt-2">${(selectedClientData.owed - selectedClientData.paid).toFixed(2)}</p></div>
                  </div>
                  <div className="w-full bg-primary/50 rounded-full h-2 mb-3"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, (selectedClientData.paid / selectedClientData.owed) * 100)}%` }} /></div>
                  <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg text-sm">Update Payment</button>
                </div>

                {/* Danger Zone */}
                <div className="bg-primary/30 border border-red-500/20 rounded-xl p-5">
                  <h4 className="text-red-400 text-xs font-heading uppercase mb-4">Account Actions</h4>
                  <p className="text-gray-500 text-xs mb-3">Archiving hides the client but keeps their data. Deleting is permanent.</p>
                  <div className="flex flex-wrap gap-3">
                    {selectedClientData.status === "active" ? <button onClick={() => { setClients(clients.map(c => c.id === selectedClient ? { ...c, status: "archived" as const } : c)); }} className="border border-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm">Archive Client</button> : <button onClick={() => { setClients(clients.map(c => c.id === selectedClient ? { ...c, status: "active" as const } : c)); }} className="border border-green-500/30 text-green-400 py-2 px-4 rounded-lg text-sm">Reactivate Client</button>}
                    {!showDeleteConfirm ? <button onClick={() => setShowDeleteConfirm(true)} className="border border-red-500/30 text-red-400 py-2 px-4 rounded-lg text-sm">Delete Client</button> : <div className="flex items-center gap-2"><span className="text-red-400 text-xs">Are you sure? This cannot be undone.</span><button onClick={() => { setClients(clients.filter(c => c.id !== selectedClient)); setSelectedClient(null); setShowDeleteConfirm(false); }} className="bg-red-600 text-white py-1 px-3 rounded text-xs">Yes, Delete</button><button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 text-xs">Cancel</button></div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* COACH DASHBOARD or SETTINGS */
          <div className="p-6 space-y-6">
            {showNotificationSettings ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-2xl uppercase text-white">Notification Settings</h2>
                  <button onClick={() => setShowNotificationSettings(false)} className="text-gray-400 hover:text-white text-sm">Back to Dashboard</button>
                </div>

                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400 mb-2">Email Notifications</h3>
                  <p className="text-gray-500 text-xs mb-6">Choose what triggers an email to you. Emails are sent to your account email.</p>

                  <div className="space-y-4">
                    {[
                      { key: "workoutCompleted", label: "Client completes a workout", desc: "Get notified when a client logs and marks a workout as complete" },
                      { key: "workoutSkipped", label: "Client skips a workout", desc: "Get notified when a client marks a workout as skipped with their reason" },
                      { key: "workoutPartial", label: "Client partially completes a workout", desc: "Get notified when a client only partially finishes a workout" },
                      { key: "clientMessage", label: "Client sends a message", desc: "Get notified immediately when a client sends you a message" },
                      { key: "dailySummary", label: "Daily summary email", desc: "Receive one email at end of day summarizing all client activity" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between bg-primary/30 border border-white/5 rounded-lg p-4">
                        <div>
                          <p className="text-white text-sm font-medium">{item.label}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => setNotifications({ ...notifications, [item.key]: !(notifications as Record<string, boolean>)[item.key] })}
                          className={`w-11 h-6 rounded-full relative transition-colors ${(notifications as Record<string, boolean>)[item.key] ? "bg-green-500" : "bg-gray-600"}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${(notifications as Record<string, boolean>)[item.key] ? "translate-x-5.5 left-[1px]" : "left-0.5"}`} style={{ transform: (notifications as Record<string, boolean>)[item.key] ? "translateX(22px)" : "translateX(0)" }} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5">
                    <p className="text-gray-400 text-xs mb-3">Notification email address:</p>
                    <div className="flex gap-3">
                      <input type="email" defaultValue="crystal@pistolperformance.com" className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                      <button className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Save</button>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400 mb-2">How It Works</h3>
                  <div className="space-y-3 text-sm text-gray-400">
                    <div className="flex items-start gap-3"><span className="text-green-400 mt-0.5">&#10003;</span><p>When a client marks a workout <strong className="text-white">complete</strong>, you get an email with their log details (effort, miles, pace, notes)</p></div>
                    <div className="flex items-start gap-3"><span className="text-red-400 mt-0.5">&#10007;</span><p>When a client <strong className="text-white">skips</strong> a workout, you get their reason immediately so you can follow up</p></div>
                    <div className="flex items-start gap-3"><span className="text-yellow-400 mt-0.5">&#189;</span><p>When a client <strong className="text-white">partially completes</strong>, you see what they did and why they stopped</p></div>
                    <div className="flex items-start gap-3"><span className="text-accent mt-0.5">&#9993;</span><p>When a client <strong className="text-white">sends a message</strong>, you get it right away so nothing is missed</p></div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-2xl uppercase text-white">Dashboard</h2>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-accent">{clients.filter(c => c.status === "active").length}</p><p className="text-gray-400 text-xs">Active Clients</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-yellow-400">{clients.reduce((s, c) => s + c.weeks.filter(w => w.status === "draft").length, 0)}</p><p className="text-gray-400 text-xs">Drafts to Publish</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-green-400">${clients.reduce((s, c) => s + c.paid, 0)}</p><p className="text-gray-400 text-xs">Total Collected</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-white">${clients.reduce((s, c) => s + (c.owed - c.paid), 0)}</p><p className="text-gray-400 text-xs">Outstanding</p></div>
            </div>

            {/* Action Items */}
            {(() => {
              const allDrafts = clients.filter(c => c.status === "active").flatMap(c => c.weeks.filter(w => w.status === "draft").map(w => ({ client: c, week: w })));
              const unpaidClients = clients.filter(c => c.status === "active" && c.owed - c.paid > 0);
              const recentLogs = clients.filter(c => c.status === "active").flatMap(c => c.weeks.filter(w => w.status === "published").flatMap(w => w.workouts.filter(wo => wo.log).map(wo => ({ client: c, workout: wo }))));
              return (
                <>
                  {/* Drafts Ready to Publish */}
                  {allDrafts.length > 0 && (
                    <div className="bg-secondary/50 border border-yellow-500/20 rounded-xl p-5">
                      <h3 className="font-heading text-sm uppercase text-yellow-400 mb-3">Drafts Ready to Publish</h3>
                      <div className="space-y-2">
                        {allDrafts.map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-primary/30 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{item.client.name.charAt(0)}</div>
                              <div><p className="text-white text-sm">{item.client.name}</p><p className="text-gray-500 text-xs">{item.week.dateRange} &mdash; {item.week.focus}</p></div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setSelectedClient(item.client.id); setClientTab("drafts"); }} className="text-gray-400 hover:text-white text-xs border border-white/10 px-3 py-1 rounded">View</button>
                              <button onClick={() => { const updated = clients.map(c => { if (c.id === item.client.id) { return { ...c, weeks: c.weeks.map(w => w.weekId === item.week.weekId ? { ...w, status: "published" as const } : w) }; } return c; }); setClients(updated); }} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded font-bold">Publish</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Client Activity */}
                  {recentLogs.length > 0 && (
                    <div className="bg-secondary/50 border border-white/10 rounded-xl p-5">
                      <h3 className="font-heading text-sm uppercase text-gray-400 mb-3">Recent Client Logs</h3>
                      <div className="space-y-2">
                        {recentLogs.slice(0, 5).map((item, i) => (
                          <button key={i} onClick={() => { setSelectedClient(item.client.id); setClientTab("plan"); }} className="w-full flex items-center justify-between bg-primary/30 rounded-lg p-3 hover:bg-white/5 transition-colors text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{item.client.name.charAt(0)}</div>
                              <div><p className="text-white text-sm">{item.client.name} <span className="text-gray-500">logged</span> {item.workout.title}</p><p className="text-gray-500 text-xs">Effort: {item.workout.log?.rpe}/10 {item.workout.log?.actualMiles && `• ${item.workout.log.actualMiles} mi`} {item.workout.log?.onPeriod === "yes" && "• On Period"}</p></div>
                            </div>
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Overview */}
                  {unpaidClients.length > 0 && (
                    <div className="bg-secondary/50 border border-white/10 rounded-xl p-5">
                      <h3 className="font-heading text-sm uppercase text-gray-400 mb-3">Outstanding Payments</h3>
                      <div className="space-y-2">
                        {unpaidClients.map((c) => (
                          <button key={c.id} onClick={() => { setSelectedClient(c.id); setClientTab("account"); }} className="w-full flex items-center justify-between bg-primary/30 rounded-lg p-3 hover:bg-white/5 transition-colors text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{c.name.charAt(0)}</div>
                              <p className="text-white text-sm">{c.name}</p>
                            </div>
                            <div className="text-right"><p className="text-white text-sm font-medium">${(c.owed - c.paid).toFixed(0)} due</p><p className="text-gray-500 text-xs">${c.paid}/${c.owed} paid</p></div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Clients Quick View */}
                  <div className="bg-secondary/50 border border-white/10 rounded-xl p-5">
                    <h3 className="font-heading text-sm uppercase text-gray-400 mb-3">All Active Clients</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {clients.filter(c => c.status === "active").map((c) => {
                        const allWk = c.weeks.filter(w => w.status === "published").flatMap(w => w.workouts);
                        const doneWk = allWk.filter(w => w.completed);
                        const drafts = c.weeks.filter(w => w.status === "draft").length;
                        return (
                          <button key={c.id} onClick={() => { setSelectedClient(c.id); setClientTab("plan"); }} className="bg-primary/30 border border-white/5 rounded-lg p-4 hover:border-accent/30 transition-all text-left">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{c.name.charAt(0)}</div>
                              <div><p className="text-white text-sm font-medium">{c.name}</p><p className="text-gray-500 text-xs">{c.goal}</p></div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400">{doneWk.length}/{allWk.length} workouts</span>
                              {drafts > 0 && <span className="text-yellow-400">{drafts} draft{drafts > 1 ? "s" : ""}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
