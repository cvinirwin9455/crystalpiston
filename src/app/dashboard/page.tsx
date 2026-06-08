"use client";

import { useState } from "react";
import Image from "next/image";

type WorkoutDay = {
  day: string;
  date: string;
  type: "run" | "cross" | "rest";
  title: string;
  miles: number | null;
  description: string;
  paceTarget?: string;
  location?: string;
  coachNotes?: string;
  completed: boolean;
};

type DailyEntry = {
  date: string;
  training: string;
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
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"plan" | "log" | "account">("plan");

  const [clientInfo] = useState({
    name: "Client Name",
    goal: "War Eagle 50K",
    planDuration: "July 26",
    startDate: "May 5, 2026",
    owed: 525.0,
    paid: 175.0,
    balance: 0.0,
  });

  const [weeklyPlan] = useState<WorkoutDay[]>([
    {
      day: "Monday",
      date: "Jun 2",
      type: "cross",
      title: "Bike / Strength",
      miles: null,
      description: "Cross training day. Bike and strength work.",
      completed: false,
    },
    {
      day: "Tuesday",
      date: "Jun 3",
      type: "run",
      title: "HILLS - Technique Day",
      miles: 7,
      description: "2 WU | 1 down | 1 up | 1 down | 1 up | 1 CD",
      paceTarget: "Downhill close to race pace",
      location: "Location specific hills",
      coachNotes:
        "This first training day is for technique. Jeff will run the downs with you to help coach you on keeping head up, not leaning too far forward, but yet allowing gravity to help you down, without falling.",
      completed: false,
    },
    {
      day: "Wednesday",
      date: "Jun 4",
      type: "run",
      title: "Easy Run",
      miles: 5,
      description: "5 mi easy",
      location: "Table Rock Coffee Roasters",
      completed: false,
    },
    {
      day: "Thursday",
      date: "Jun 5",
      type: "run",
      title: "Strides",
      miles: 7,
      description: "7 mi w/strides",
      completed: false,
    },
    {
      day: "Friday",
      date: "Jun 6",
      type: "cross",
      title: "Bike / Strength",
      miles: null,
      description: "Cross training day. Bike and strength work.",
      completed: false,
    },
    {
      day: "Saturday",
      date: "Jun 7",
      type: "run",
      title: "Race Pace Workout",
      miles: 12,
      description: "5 WU | 5 mi @ 9:15 (2 min rest between miles) | 2 CD",
      paceTarget: "9:15/mi race pace",
      coachNotes: "12 mi total workout at race pace.",
      completed: false,
    },
    {
      day: "Sunday",
      date: "Jun 8",
      type: "rest",
      title: "Complete Rest",
      miles: null,
      description: "Complete rest day. Recover and recharge.",
      completed: false,
    },
  ]);

  const weeklyTotal = weeklyPlan.reduce((sum, day) => sum + (day.miles || 0), 0);

  const [coachMessage] = useState(
    "I'm giving you this week of training a week ahead, because I will be gone. But Jeff will be here to guide you through it. This week will be more specificity training on hills—Tuesday will be location specific. The day after Memorial Day, hopefully you will be ready to get after it."
  );

  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([
    {
      date: "Monday, June 2, 2026",
      training: "",
      rpe: "",
      stress: "",
      notes: "",
      energy: "",
      motivation: "",
      sleep: "",
      strength: "",
      recovery: "",
      mood: "",
      hunger: "",
    },
  ]);

  const handleEntryChange = (index: number, field: string, value: string) => {
    const updated = [...dailyEntries];
    updated[index] = { ...updated[index], [field]: value };
    setDailyEntries(updated);
  };

  const addNewEntry = () => {
    setDailyEntries([
      ...dailyEntries,
      {
        date: "",
        training: "",
        rpe: "",
        stress: "",
        notes: "",
        energy: "",
        motivation: "",
        sleep: "",
        strength: "",
        recovery: "",
        mood: "",
        hunger: "",
      },
    ]);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "run":
        return "border-accent/50 bg-accent/5";
      case "cross":
        return "border-gold/50 bg-gold/5";
      case "rest":
        return "border-green-500/50 bg-green-500/5";
      default:
        return "border-white/10";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "run":
        return "bg-accent/20 text-accent";
      case "cross":
        return "bg-gold/20 text-gold";
      case "rest":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Top Bar */}
      <header className="bg-secondary/50 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/IMG_5861.PNG"
              alt="Pistol Performance Coaching"
              width={50}
              height={50}
            />
            <div>
              <h1 className="font-heading text-xl uppercase text-white">Training Dashboard</h1>
              <p className="text-gray-400 text-sm">Pistol Performance Coaching</p>
            </div>
          </div>
          <a href="/" className="text-gray-400 hover:text-accent text-sm transition-colors">
            Logout
          </a>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          <button
            onClick={() => setActiveTab("plan")}
            className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors ${
              activeTab === "plan"
                ? "text-accent border-b-2 border-accent"
                : "text-gray-400 hover:text-white"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setActiveTab("log")}
            className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors ${
              activeTab === "log"
                ? "text-accent border-b-2 border-accent"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Daily Log
          </button>
          <button
            onClick={() => setActiveTab("account")}
            className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors ${
              activeTab === "account"
                ? "text-accent border-b-2 border-accent"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Account
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* THIS WEEK TAB */}
        {activeTab === "plan" && (
          <>
            {/* Coach Message */}
            {coachMessage && (
              <div className="bg-secondary/50 border border-gold/30 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gold font-heading uppercase text-sm mb-1">Message from Crystal</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{coachMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Summary Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl uppercase text-white">Week of Jun 2 - Jun 8</h2>
                <p className="text-gray-400 text-sm mt-1">Hills &amp; Specificity Focus</p>
              </div>
              <div className="text-right">
                <p className="font-heading text-3xl text-accent">{weeklyTotal}</p>
                <p className="text-gray-400 text-sm">total miles</p>
              </div>
            </div>

            {/* Daily Workout Cards */}
            <div className="space-y-4">
              {weeklyPlan.map((workout, i) => (
                <div
                  key={i}
                  className={`border rounded-2xl p-6 transition-all duration-300 hover:border-opacity-100 ${getTypeColor(workout.type)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-heading text-lg uppercase">
                          {workout.day}
                        </span>
                        <span className="text-gray-500 text-sm">{workout.date}</span>
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(workout.type)}`}>
                          {workout.type}
                        </span>
                      </div>
                      <h3 className="text-white font-bold text-lg mb-1">{workout.title}</h3>
                      <p className="text-gray-300 text-sm">{workout.description}</p>

                      {workout.paceTarget && (
                        <div className="mt-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-accent text-sm font-medium">{workout.paceTarget}</span>
                        </div>
                      )}

                      {workout.location && (
                        <div className="mt-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
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

                    <div className="text-right ml-4 flex-shrink-0">
                      {workout.miles ? (
                        <div>
                          <p className="font-heading text-2xl text-white">{workout.miles}</p>
                          <p className="text-gray-500 text-xs">miles</p>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                          {workout.type === "rest" ? (
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* DAILY LOG TAB */}
        {activeTab === "log" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl uppercase text-white">Daily Training Log</h2>
                <p className="text-gray-400 text-sm mt-1">Track your daily metrics</p>
              </div>
              <button
                onClick={addNewEntry}
                className="bg-accent hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
              >
                + Add Entry
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-secondary/30 border border-white/5 rounded-xl p-4">
              <div className="grid md:grid-cols-3 gap-4 text-xs text-gray-400">
                <div>
                  <span className="text-gold font-bold">Training Types:</span> Speed, HR, LR, Tempo, CT
                </div>
                <div>
                  <span className="text-gold font-bold">Rate 1-10:</span> 1=Poor, 10=Perfect
                </div>
                <div className="text-accent">
                  Females: Note period days
                </div>
              </div>
            </div>

            {/* Daily Entry Cards */}
            {dailyEntries.map((entry, i) => (
              <div key={i} className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-xs block mb-1">Date</label>
                    <input
                      type="text"
                      value={entry.date}
                      onChange={(e) => handleEntryChange(i, "date", e.target.value)}
                      className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                      placeholder="e.g. Monday, June 2, 2026"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Training Type</label>
                    <input
                      type="text"
                      value={entry.training}
                      onChange={(e) => handleEntryChange(i, "training", e.target.value)}
                      className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                      placeholder="Speed, HR, LR..."
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">RPE (1-10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={entry.rpe}
                      onChange={(e) => handleEntryChange(i, "rpe", e.target.value)}
                      className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                      placeholder="1-10"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Stress</label>
                    <input
                      type="text"
                      value={entry.stress}
                      onChange={(e) => handleEntryChange(i, "stress", e.target.value)}
                      className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                      placeholder="e.g. Travel Day, Work stress..."
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Notes</label>
                    <input
                      type="text"
                      value={entry.notes}
                      onChange={(e) => handleEntryChange(i, "notes", e.target.value)}
                      className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                      placeholder="Any notes..."
                    />
                  </div>
                </div>

                {/* Weekly Ratings */}
                <div className="border-t border-white/5 pt-4 mt-4">
                  <p className="text-gold text-xs font-heading uppercase mb-3">Sunday Ratings (1-10)</p>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                    {[
                      { key: "energy", label: "Energy" },
                      { key: "motivation", label: "Motivation" },
                      { key: "sleep", label: "Sleep" },
                      { key: "strength", label: "Strength" },
                      { key: "recovery", label: "Recovery" },
                      { key: "mood", label: "Mood" },
                      { key: "hunger", label: "Hunger" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="text-gray-500 text-xs block mb-1 text-center">{field.label}</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={(entry as Record<string, string>)[field.key]}
                          onChange={(e) => handleEntryChange(i, field.key, e.target.value)}
                          className="w-full bg-primary/50 border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-accent"
                          placeholder="—"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ACCOUNT TAB */}
        {activeTab === "account" && (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Client Info */}
              <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                <h2 className="font-heading text-xl uppercase text-accent mb-4">Your Plan</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-white font-medium">{clientInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Goal:</span>
                    <span className="text-white font-medium">{clientInfo.goal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Plan Duration:</span>
                    <span className="text-white">{clientInfo.planDuration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Start Date:</span>
                    <span className="text-white">{clientInfo.startDate}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                <h2 className="font-heading text-xl uppercase text-accent mb-4">Payment</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Owed:</span>
                    <span className="text-white font-medium">${clientInfo.owed.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Paid:</span>
                    <span className="text-green-400 font-medium">${clientInfo.paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-3">
                    <span className="text-gray-400">Balance:</span>
                    <span className="text-white font-bold">${clientInfo.balance.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strength / Cross Training */}
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h2 className="font-heading text-xl uppercase text-accent mb-4">Strength / Cross Training</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-primary/50 border border-white/5 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Cross Training</p>
                  <p className="text-white">Bike / OT</p>
                </div>
                <div className="bg-primary/50 border border-white/5 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Orange Theory</p>
                  <p className="text-white">Mon &amp; Fri</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
