"use client";

import { useState } from "react";
import Image from "next/image";

export default function DashboardPage() {
  // Mock client data based on Crystal's spreadsheet
  const [clientInfo] = useState({
    name: "Client Name",
    goal: "",
    planDuration: "July 26",
    startDate: "May 5, 2026",
    owed: 525.0,
    paid: 175.0,
    balance: 0.0,
  });

  const [weeklySchedule] = useState([
    { day: "Tuesday", warmUp: "1", training: "24x200/200", coolDown: "1", totalMiles: "8" },
    { day: "Wednesday", warmUp: "", training: "", coolDown: "", totalMiles: "7" },
    { day: "Thursday", warmUp: "", training: "", coolDown: "", totalMiles: "7" },
    { day: "Saturday", warmUp: "", training: "", coolDown: "", totalMiles: "15" },
    { day: "Sunday", warmUp: "", training: "", coolDown: "", totalMiles: "6" },
  ]);

  const [dailyEntries, setDailyEntries] = useState([
    {
      date: "Monday, June 1, 2026",
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

  const weeklyTotal = 43;

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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Client Info & Payment */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Client Info */}
          <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
            <h2 className="font-heading text-xl uppercase text-accent mb-4">Client Info</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Name:</span>
                <span className="text-white font-medium">{clientInfo.name}</span>
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

        {/* Training Breakdown */}
        <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl uppercase text-accent">Training Breakdown</h2>
            <div className="text-right">
              <span className="text-gray-400 text-sm">Weekly Total: </span>
              <span className="text-white font-heading text-2xl">{weeklyTotal}</span>
              <span className="text-gray-400 text-sm"> miles</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Day</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Warm Up</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Training</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Cool Down</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Total Miles</th>
                </tr>
              </thead>
              <tbody>
                {weeklySchedule.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white font-medium">{row.day}</td>
                    <td className="py-3 px-4 text-center text-gray-300">{row.warmUp || "—"}</td>
                    <td className="py-3 px-4 text-center text-gray-300">{row.training || "—"}</td>
                    <td className="py-3 px-4 text-center text-gray-300">{row.coolDown || "—"}</td>
                    <td className="py-3 px-4 text-center text-white font-medium">{row.totalMiles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-xs mt-4 italic">
            Saturday: War Eagle
          </p>
        </div>

        {/* Strength / Cross Training */}
        <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
          <h2 className="font-heading text-xl uppercase text-accent mb-4">Strength / Cross Training</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-primary/50 border border-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Cross Training</p>
              <p className="text-white">—</p>
            </div>
            <div className="bg-primary/50 border border-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Orange Theory</p>
              <p className="text-white">—</p>
            </div>
          </div>
          <div className="mt-4 bg-primary/50 border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-1">Notes</p>
            <textarea
              className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none"
              rows={2}
              placeholder="Add notes here..."
            />
          </div>
        </div>

        {/* Daily Tracking */}
        <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading text-xl uppercase text-accent">Daily Tracking</h2>
            <button
              onClick={addNewEntry}
              className="bg-accent hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
            >
              + Add Entry
            </button>
          </div>
          <p className="text-gray-500 text-xs mb-1">Please insert your data DAILY.</p>
          <p className="text-gray-500 text-xs mb-4">
            Training types: Speed, Heart Rate Training (HR), Long Run (LR), Tempo, Cross Training (CT)
          </p>
          <p className="text-gold text-xs mb-4">
            Rate categories 1-10 (1=Poor, 10=Perfect)
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 text-gray-400 font-medium whitespace-nowrap">Date</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Training</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">RPE</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Stress</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Notes</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Energy</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Motivation</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Sleep</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Strength</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Recovery</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Mood</th>
                  <th className="text-center py-3 px-2 text-gray-400 font-medium">Hunger</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.map((entry, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={entry.date}
                        onChange={(e) => handleEntryChange(i, "date", e.target.value)}
                        className="w-40 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
                        placeholder="Date"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={entry.training}
                        onChange={(e) => handleEntryChange(i, "training", e.target.value)}
                        className="w-20 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="Type"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.rpe}
                        onChange={(e) => handleEntryChange(i, "rpe", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={entry.stress}
                        onChange={(e) => handleEntryChange(i, "stress", e.target.value)}
                        className="w-20 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="Stress"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => handleEntryChange(i, "notes", e.target.value)}
                        className="w-24 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="Notes"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.energy}
                        onChange={(e) => handleEntryChange(i, "energy", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.motivation}
                        onChange={(e) => handleEntryChange(i, "motivation", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.sleep}
                        onChange={(e) => handleEntryChange(i, "sleep", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.strength}
                        onChange={(e) => handleEntryChange(i, "strength", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.recovery}
                        onChange={(e) => handleEntryChange(i, "recovery", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.mood}
                        onChange={(e) => handleEntryChange(i, "mood", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={entry.hunger}
                        onChange={(e) => handleEntryChange(i, "hunger", e.target.value)}
                        className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent"
                        placeholder="1-10"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-secondary/30 border border-white/5 rounded-2xl p-6">
          <h3 className="font-heading text-lg uppercase text-gold mb-3">Instructions</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>Please insert your data <strong className="text-white">DAILY</strong></li>
            <li>Training types: <span className="text-gray-300">Speed, Heart Rate Training (HR), Long Run (LR), Tempo, Cross Training (CT)</span></li>
            <li>Every Sunday, rate the categories to the right using a scale of <span className="text-gold">1-10 (1=Poor, 10=Perfect)</span></li>
            <li className="text-accent">FEMALES: Please indicate in the NOTES section if you are on your period that day</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
