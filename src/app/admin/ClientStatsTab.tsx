"use client";

import { useState, useEffect } from "react";

type StatsData = {
  totals: { totalMiles: number; totalRuns: number; avgPace: string };
  distancePRs: { distance: string; miles: number; pace: string; date: string; name: string }[];
  weeklyMileage: { week: string; miles: number }[];
  recentRuns: { date: string; miles: number; pace: string; duration: string; avgHr: number | null; maxHr: number | null; name: string; source: string }[];
};

export default function ClientStatsTab({ clientId, distanceUnit }: { clientId: string | null; distanceUnit: "mi" | "km" }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setError("");
    fetch(`/api/client-stats?client_id=${clientId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load stats");
        return res.json();
      })
      .then(data => setStats(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const convertMiles = (miles: number) => {
    if (distanceUnit === "km") return (miles * 1.60934).toFixed(1);
    return miles.toFixed(1);
  };

  if (loading) return <div className="p-6"><p className="text-gray-500 text-sm">Loading stats...</p></div>;
  if (error) return <div className="p-6"><p className="text-red-400 text-sm">{error}</p></div>;
  if (!stats) return <div className="p-6"><p className="text-gray-500 text-sm">No stats available.</p></div>;

  const maxWeeklyMiles = Math.max(...stats.weeklyMileage.map(w => w.miles), 1);

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-primary/30 border border-white/5 rounded-xl p-4 text-center">
          <p className="text-accent text-2xl font-heading">{convertMiles(stats.totals.totalMiles)}</p>
          <p className="text-gray-400 text-xs">{distanceUnit === "km" ? "Total km" : "Total Miles"}</p>
        </div>
        <div className="bg-primary/30 border border-white/5 rounded-xl p-4 text-center">
          <p className="text-white text-2xl font-heading">{stats.totals.totalRuns}</p>
          <p className="text-gray-400 text-xs">Total Runs</p>
        </div>
        <div className="bg-primary/30 border border-white/5 rounded-xl p-4 text-center">
          <p className="text-purple-400 text-2xl font-heading">{stats.totals.avgPace || "—"}</p>
          <p className="text-gray-400 text-xs">Avg Pace /{distanceUnit === "km" ? "km" : "mi"}</p>
        </div>
      </div>

      {/* Distance PRs */}
      {stats.distancePRs.length > 0 && (
        <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
          <h3 className="font-heading text-sm uppercase text-gold mb-3">Distance PRs</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.distancePRs.map((pr) => (
              <div key={pr.distance} className="bg-gold/5 border border-gold/20 rounded-lg p-3 text-center">
                <p className="text-gold text-xs font-heading uppercase">{pr.distance}</p>
                <p className="text-white text-lg font-bold mt-1">{pr.pace}</p>
                <p className="text-gray-500 text-xs">/{distanceUnit === "km" ? "km" : "mi"}</p>
                <p className="text-gray-500 text-xs mt-1">{formatDate(pr.date)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Mileage Chart */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <h3 className="font-heading text-sm uppercase text-gray-400 mb-3">Weekly Mileage (Last 12 Weeks)</h3>
        <div className="flex items-end gap-1 h-32">
          {stats.weeklyMileage.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full bg-accent/60 rounded-t transition-all hover:bg-accent"
                style={{ height: `${maxWeeklyMiles > 0 ? (w.miles / maxWeeklyMiles) * 100 : 0}%`, minHeight: w.miles > 0 ? '4px' : '0px' }}
                title={`${w.week}: ${convertMiles(w.miles)} ${distanceUnit}`}
              />
              <p className="text-gray-600 text-[8px] mt-1 text-center leading-tight">{w.week.split(' ')[0]}<br/>{w.week.split(' ')[1]}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-gray-600 text-xs">12 weeks ago</span>
          <span className="text-gray-600 text-xs">This week</span>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <h3 className="font-heading text-sm uppercase text-gray-400 mb-3">Recent Runs</h3>
        {stats.recentRuns.length === 0 ? (
          <p className="text-gray-500 text-sm">No completed runs yet.</p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-6 gap-2 text-gray-500 text-xs font-heading uppercase pb-2 border-b border-white/5">
              <span>Date</span>
              <span>Name</span>
              <span className="text-right">Distance</span>
              <span className="text-right">Pace</span>
              <span className="text-right">Duration</span>
              <span className="text-right">HR</span>
            </div>
            {stats.recentRuns.map((run, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 text-xs py-2 border-b border-white/5 last:border-b-0 items-center">
                <span className="text-gray-400">{formatDate(run.date)}</span>
                <span className="text-white truncate flex items-center gap-1">
                  {run.name}
                  {run.source === "strava" && <svg className="w-3 h-3 text-orange-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>}
                </span>
                <span className="text-accent text-right font-medium">{convertMiles(run.miles)} {distanceUnit}</span>
                <span className="text-purple-400 text-right">{run.pace || "—"}</span>
                <span className="text-gray-300 text-right">{run.duration || "—"}</span>
                <span className="text-red-400 text-right">{run.avgHr || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
