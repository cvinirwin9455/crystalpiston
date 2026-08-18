"use client";

import { useState, useEffect, useRef } from "react";

// Types
export type MeasureType = "reps" | "time" | "distance";
export type WeightUnit = "kg" | "lbs";

export type Exercise = {
  name: string;
  measureType: MeasureType;
  measureValue: string;
  weight: string;
  weightUnit: WeightUnit;
  sets: number;
  rest: string; // e.g. "01:00" (mm:ss)
  notes: string;
  demoVideo?: string; // URL to a YouTube/Vimeo demo video
};

export type ExerciseLibraryItem = {
  id: string;
  name: string;
  demoVideo?: string;
  defaultMeasureType?: MeasureType;
  defaultMeasureValue?: string;
  defaultSets?: number;
  defaultRest?: string;
  defaultWeight?: string;
  defaultWeightUnit?: WeightUnit;
  defaultNotes?: string;
  categories?: string[];
};

export type HiitFormat = "emom" | "tabata" | "amrap" | "circuit" | "intervals";

export type HiitTimerSettings = {
  format: HiitFormat;
  // EMOM / E2MOM / E3MOM etc.
  intervalMinutes?: number; // 1 = EMOM, 2 = E2MOM, 3 = E3MOM, etc.
  totalMinutes?: number; // Total duration in minutes
  alternating?: boolean; // If true, exercises rotate each interval
  // Tabata
  workSeconds?: number; // e.g. 20
  restSeconds?: number; // e.g. 10
  tabataRounds?: number; // e.g. 8
  tabataSets?: number; // Number of different exercises/sets (each gets full rounds)
  tabataSetRest?: string; // Rest between sets e.g. "01:00"
  // AMRAP
  timeCap?: number; // Minutes
  // Circuit (already supported via rounds/roundRest, kept for clarity)
  // Intervals (work/rest alternating)
  intervalWorkSeconds?: number;
  intervalRestSeconds?: number;
  intervalRounds?: number;
};

export type CrossTrainingStructure = {
  exercises: Exercise[];
  rounds?: number; // Number of circuit rounds (for Circuit format)
  roundRest?: string; // Rest between rounds e.g. "01:00" (mm:ss)
  hiitTimer?: HiitTimerSettings; // HIIT-specific timer configuration
};

function emptyExercise(weightUnit: WeightUnit = "kg"): Exercise {
  return {
    name: "",
    measureType: "reps",
    measureValue: "",
    weight: "",
    weightUnit,
    sets: 3,
    rest: "01:00",
    notes: "",
    demoVideo: "",
  };
}

// Format for client display
export function formatCrossTrainingForDisplay(structure: CrossTrainingStructure): string {
  if (!structure || !structure.exercises || structure.exercises.length === 0) return "";
  const exerciseLines = structure.exercises
    .filter((ex) => ex.name)
    .map((ex) => {
      const measure =
        ex.measureType === "reps"
          ? `${ex.measureValue} reps`
          : ex.measureType === "time"
          ? `${ex.measureValue}`
          : `${ex.measureValue}m`;
      const weight = ex.weight ? ` @ ${ex.weight}${ex.weightUnit}` : "";
      const sets = ex.sets > 1 ? `${ex.sets} sets x ` : "";
      const rest = ex.rest && ex.rest !== "00:00" ? ` | Rest: ${ex.rest}` : "";
      return `${sets}${ex.name} — ${measure}${weight}${rest}`;
    })
    .join("\n");
  
  // HIIT Timer format header
  if (structure.hiitTimer) {
    const t = structure.hiitTimer;
    switch (t.format) {
      case "emom": {
        const interval = t.intervalMinutes || 1;
        const label = interval === 1 ? "EMOM" : `E${interval}MOM`;
        const duration = t.totalMinutes || 12;
        const alt = t.alternating ? " (alternating)" : "";
        return `${label} × ${duration} minutes${alt}\n${exerciseLines}`;
      }
      case "tabata": {
        const work = t.workSeconds || 20;
        const rest = t.restSeconds || 10;
        const rounds = t.tabataRounds || 8;
        const sets = (t.tabataSets || 1) > 1 ? ` — ${t.tabataSets} sets, ${t.tabataSetRest || '1:00'} rest between` : "";
        return `Tabata: ${work}s work / ${rest}s rest × ${rounds} rounds${sets}\n${exerciseLines}`;
      }
      case "amrap": {
        const cap = t.timeCap || 12;
        return `AMRAP ${cap} minutes\n${exerciseLines}`;
      }
      case "circuit": {
        const rounds = structure.rounds || 3;
        const roundRest = structure.roundRest && structure.roundRest !== "00:00" ? ` | Rest: ${structure.roundRest} between rounds` : "";
        return `${rounds} Rounds${roundRest}\n${exerciseLines}`;
      }
      case "intervals": {
        const work = t.intervalWorkSeconds || 30;
        const rest = t.intervalRestSeconds || 30;
        const rounds = t.intervalRounds || 6;
        return `${work}s work / ${rest}s rest × ${rounds} rounds\n${exerciseLines}`;
      }
    }
  }

  // Fallback: simple rounds (non-HIIT or legacy data)
  if (structure.rounds && structure.rounds > 1) {
    const roundRest = structure.roundRest && structure.roundRest !== "00:00" ? ` | Rest between rounds: ${structure.roundRest}` : "";
    return `${structure.rounds} Rounds${roundRest}\n${exerciseLines}`;
  }
  return exerciseLines;
}

// ===== COMPONENT =====
interface Props {
  structure: CrossTrainingStructure;
  onChange: (structure: CrossTrainingStructure) => void;
  weightUnit?: WeightUnit;
  exerciseLibrary?: ExerciseLibraryItem[];
  showRounds?: boolean; // Show rounds/circuit fields (for HIIT)
  hiitSubtype?: string; // The specific HIIT subtype (AMRAP, EMOM, Tabata, Circuit, Intervals)
  workoutType?: string; // The workout type (cross, strength, hiit, stretching) — used to filter exercise suggestions
}

export default function StructuredCrossTrainingBuilder({ structure, onChange, weightUnit = "kg", exerciseLibrary = [], showRounds = false, hiitSubtype, workoutType }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showVideoInput, setShowVideoInput] = useState<Record<number, boolean>>({});
  const [autocompleteIndex, setAutocompleteIndex] = useState<number | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<ExerciseLibraryItem[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const updateExercise = (index: number, changes: Partial<Exercise>) => {
    const exercises = [...structure.exercises];
    exercises[index] = { ...exercises[index], ...changes };
    onChange({ ...structure, exercises });
  };

  const addExercise = () => {
    onChange({ ...structure, exercises: [...structure.exercises, emptyExercise(weightUnit)] });
  };

  const removeExercise = (index: number) => {
    const exercises = structure.exercises.filter((_, i) => i !== index);
    onChange({ ...structure, exercises });
  };

  // Autocomplete: filter exercise library by workout type category, then by name
  const getFilteredLibrary = (searchText: string) => {
    let filtered = exerciseLibrary;
    // Filter by workout type category if provided
    if (workoutType && filtered.length > 0) {
      const categoryFiltered = filtered.filter(item =>
        item.categories && item.categories.includes(workoutType)
      );
      // Only apply filter if it returns results (graceful fallback for untagged exercises)
      if (categoryFiltered.length > 0) {
        filtered = categoryFiltered;
      }
    }
    // Filter by search text
    if (searchText.length > 0) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(lower));
    }
    return filtered.slice(0, 8);
  };

  const handleNameChange = (index: number, value: string) => {
    updateExercise(index, { name: value });
    if (exerciseLibrary.length > 0) {
      const matches = getFilteredLibrary(value);
      if (matches.length > 0) {
        setAutocompleteIndex(index);
        setAutocompleteResults(matches);
      } else {
        setAutocompleteIndex(null);
        setAutocompleteResults([]);
      }
    } else {
      setAutocompleteIndex(null);
      setAutocompleteResults([]);
    }
  };

  const handleNameFocus = (index: number) => {
    if (exerciseLibrary.length > 0) {
      const currentName = structure.exercises[index]?.name || "";
      const matches = getFilteredLibrary(currentName);
      if (matches.length > 0) {
        setAutocompleteIndex(index);
        setAutocompleteResults(matches);
      }
    }
  };

  const selectFromLibrary = (index: number, item: ExerciseLibraryItem) => {
    const changes: Partial<Exercise> = { name: item.name };
    if (item.demoVideo) changes.demoVideo = item.demoVideo;
    if (item.defaultMeasureType) changes.measureType = item.defaultMeasureType;
    if (item.defaultMeasureValue) changes.measureValue = item.defaultMeasureValue;
    if (item.defaultSets) changes.sets = item.defaultSets;
    if (item.defaultRest) changes.rest = item.defaultRest;
    if (item.defaultWeight) changes.weight = item.defaultWeight;
    if (item.defaultWeightUnit) changes.weightUnit = item.defaultWeightUnit;
    if (item.defaultNotes) changes.notes = item.defaultNotes;
    updateExercise(index, changes);
    setAutocompleteIndex(null);
    setAutocompleteResults([]);
    // Show video input if there's a video
    if (item.demoVideo) {
      setShowVideoInput(prev => ({ ...prev, [index]: true }));
    }
  };

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setAutocompleteIndex(null);
        setAutocompleteResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const exercises = [...structure.exercises];
    const [moved] = exercises.splice(dragIndex, 1);
    exercises.splice(index, 0, moved);
    onChange({ ...structure, exercises });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2 mt-2 border border-gold/20 rounded-lg p-3 bg-gold/5">
      <div className="flex items-center justify-between">
        <p className="text-gold text-[10px] font-heading uppercase tracking-wider">Exercises</p>
        <button
          type="button"
          onClick={addExercise}
          className="text-gold text-xs hover:text-yellow-300 flex items-center gap-1 border border-gold/30 rounded px-2 py-0.5 hover:bg-gold/10 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* HIIT Timer Configuration */}
      {showRounds && (
        <div className="pb-3 border-b border-gold/10 space-y-2">
          {/* EMOM / E2MOM / E3MOM */}
          {(hiitSubtype === "EMOM") && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-[10px] font-heading uppercase tracking-wider">EMOM — Every</span>
                <select
                  value={structure.hiitTimer?.intervalMinutes || 1}
                  onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "emom", intervalMinutes: parseInt(e.target.value) } as any })}
                  className="w-14 bg-primary/50 border border-orange-500/30 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                </select>
                <span className="text-orange-400 text-[10px] font-heading uppercase">Minute(s) On the Minute</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Total Duration</label>
                  <input
                    type="number" min={1} max={60}
                    value={structure.hiitTimer?.totalMinutes || 12}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "emom", totalMinutes: parseInt(e.target.value) || 12 } as any })}
                    className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-gray-500 text-[10px]">min</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={structure.hiitTimer?.alternating || false}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "emom", alternating: e.target.checked } as any })}
                    className="w-3.5 h-3.5 rounded border-gray-500 bg-primary/50 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-gray-400 text-[10px] uppercase">Alternating exercises each interval</span>
                </label>
              </div>
              <p className="text-gray-500 text-[10px]">
                {structure.hiitTimer?.alternating 
                  ? "Client rotates through exercises below — one per interval, then repeats" 
                  : "Client completes ALL exercises below within each interval, rests remainder"}
              </p>
            </div>
          )}

          {/* Tabata */}
          {hiitSubtype === "Tabata" && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-2">
              <span className="text-red-400 text-[10px] font-heading uppercase tracking-wider">Tabata Timer</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Work</label>
                  <input
                    type="number" min={5} max={120} step={5}
                    value={structure.hiitTimer?.workSeconds || 20}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "tabata", workSeconds: parseInt(e.target.value) || 20 } as any })}
                    className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-gray-500 text-[10px]">sec</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Rest</label>
                  <input
                    type="number" min={5} max={120} step={5}
                    value={structure.hiitTimer?.restSeconds || 10}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "tabata", restSeconds: parseInt(e.target.value) || 10 } as any })}
                    className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-gray-500 text-[10px]">sec</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Rounds</label>
                  <input
                    type="number" min={1} max={20}
                    value={structure.hiitTimer?.tabataRounds || 8}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "tabata", tabataRounds: parseInt(e.target.value) || 8 } as any })}
                    className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Exercise Sets</label>
                  <input
                    type="number" min={1} max={10}
                    value={structure.hiitTimer?.tabataSets || 1}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "tabata", tabataSets: parseInt(e.target.value) || 1 } as any })}
                    className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-gray-500 text-[10px]">(rotate through exercises)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Rest between sets</label>
                  <input
                    type="text"
                    value={structure.hiitTimer?.tabataSetRest || "01:00"}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "tabata", tabataSetRest: e.target.value } as any })}
                    className="w-16 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="mm:ss"
                  />
                </div>
              </div>
              <p className="text-gray-500 text-[10px]">
                {structure.hiitTimer?.workSeconds || 20}s on / {structure.hiitTimer?.restSeconds || 10}s off × {structure.hiitTimer?.tabataRounds || 8} rounds
                {(structure.hiitTimer?.tabataSets || 1) > 1 ? ` — ${structure.hiitTimer?.tabataSets} sets with ${structure.hiitTimer?.tabataSetRest || '1:00'} rest between` : ''}
              </p>
            </div>
          )}

          {/* AMRAP */}
          {hiitSubtype === "AMRAP" && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 space-y-2">
              <span className="text-green-400 text-[10px] font-heading uppercase tracking-wider">AMRAP — As Many Rounds As Possible</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Time Cap</label>
                  <input
                    type="number" min={1} max={60}
                    value={structure.hiitTimer?.timeCap || 12}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "amrap", timeCap: parseInt(e.target.value) || 12 } as any })}
                    className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-gray-500 text-[10px]">minutes</span>
                </div>
              </div>
              <p className="text-gray-500 text-[10px]">Client completes as many rounds of the exercises below as possible within the time cap. No programmed rest — they rest as needed.</p>
            </div>
          )}

          {/* Circuit */}
          {hiitSubtype === "Circuit" && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 space-y-2">
              <span className="text-purple-400 text-[10px] font-heading uppercase tracking-wider">Circuit</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Rounds</label>
                  <input
                    type="number" min={1} max={20}
                    value={structure.rounds || 3}
                    onChange={(e) => onChange({ ...structure, rounds: parseInt(e.target.value) || 3, hiitTimer: { ...structure.hiitTimer, format: "circuit" } as any })}
                    className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Rest between rounds</label>
                  <input
                    type="text"
                    value={structure.roundRest || "01:00"}
                    onChange={(e) => onChange({ ...structure, roundRest: e.target.value, hiitTimer: { ...structure.hiitTimer, format: "circuit" } as any })}
                    className="w-16 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="mm:ss"
                  />
                </div>
              </div>
              <p className="text-gray-500 text-[10px]">Complete all exercises below in order, rest between rounds, then repeat.</p>
            </div>
          )}

          {/* Intervals (work/rest alternating) */}
          {hiitSubtype === "Intervals" && (
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3 space-y-2">
              <span className="text-cyan-400 text-[10px] font-heading uppercase tracking-wider">Intervals — Work / Rest</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Work</label>
                  <input
                    type="number" min={5} max={300} step={5}
                    value={structure.hiitTimer?.intervalWorkSeconds || 30}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "intervals", intervalWorkSeconds: parseInt(e.target.value) || 30 } as any })}
                    className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <span className="text-gray-500 text-[10px]">sec</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Rest</label>
                  <input
                    type="number" min={5} max={300} step={5}
                    value={structure.hiitTimer?.intervalRestSeconds || 30}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "intervals", intervalRestSeconds: parseInt(e.target.value) || 30 } as any })}
                    className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <span className="text-gray-500 text-[10px]">sec</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] uppercase">Rounds</label>
                  <input
                    type="number" min={1} max={30}
                    value={structure.hiitTimer?.intervalRounds || 6}
                    onChange={(e) => onChange({ ...structure, hiitTimer: { ...structure.hiitTimer, format: "intervals", intervalRounds: parseInt(e.target.value) || 6 } as any })}
                    className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <p className="text-gray-500 text-[10px]">
                {structure.hiitTimer?.intervalWorkSeconds || 30}s work / {structure.hiitTimer?.intervalRestSeconds || 30}s rest × {structure.hiitTimer?.intervalRounds || 6} rounds — perform exercises below during work periods
              </p>
            </div>
          )}

          {/* Fallback: if no subtype selected yet, show generic rounds */}
          {!hiitSubtype && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-gray-400 text-[10px] uppercase">Rounds</label>
                <input
                  type="number" min={1} max={20}
                  value={structure.rounds || 1}
                  onChange={(e) => onChange({ ...structure, rounds: parseInt(e.target.value) || 1 })}
                  className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-gray-400 text-[10px] uppercase">Rest between rounds</label>
                <input
                  type="text"
                  value={structure.roundRest || "01:00"}
                  onChange={(e) => onChange({ ...structure, roundRest: e.target.value })}
                  className="w-16 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="mm:ss"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exercise Rows */}
      <div className="space-y-1.5">
        {structure.exercises.map((ex, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={`bg-primary/40 border rounded-lg p-2 transition-all ${
              dragOverIndex === idx && dragIndex !== idx
                ? "border-gold/50 bg-gold/10"
                : "border-white/5"
            } ${dragIndex === idx ? "opacity-50" : ""}`}
          >
            {/* Row 1: Drag handle + Name + Video link */}
            <div className="flex items-center gap-2">
              <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </div>
              <div className="flex-1 relative" ref={autocompleteIndex === idx ? autocompleteRef : undefined}>
                <input
                  type="text"
                  value={ex.name}
                  onChange={(e) => handleNameChange(idx, e.target.value)}
                  onFocus={() => handleNameFocus(idx)}
                  className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50"
                  placeholder="Exercise name"
                />
                {/* Autocomplete dropdown */}
                {autocompleteIndex === idx && autocompleteResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-primary border border-gold/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {autocompleteResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectFromLibrary(idx, item)}
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-gold/10 flex items-center gap-2 border-b border-white/5 last:border-0"
                      >
                        <span className="flex-1">{item.name}</span>
                        {item.demoVideo && (
                          <svg className="w-3.5 h-3.5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Video link toggle button */}
              <button
                type="button"
                onClick={() => setShowVideoInput(prev => ({ ...prev, [idx]: !prev[idx] }))}
                className={`flex-shrink-0 p-1 rounded transition-colors ${
                  ex.demoVideo ? "text-gold hover:text-yellow-300" : "text-gray-500 hover:text-gray-300"
                }`}
                title={ex.demoVideo ? "Video linked" : "Add demo video"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {structure.exercises.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExercise(idx)}
                  className="text-red-400 hover:text-red-300 text-xs flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Video URL input (shown when toggled or when video exists) */}
            {(showVideoInput[idx] || ex.demoVideo) && (
              <div className="flex items-center gap-2 mt-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <input
                  type="url"
                  value={ex.demoVideo || ""}
                  onChange={(e) => updateExercise(idx, { demoVideo: e.target.value })}
                  className="flex-1 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50"
                  placeholder="Demo video URL (YouTube or Vimeo)"
                />
                {ex.demoVideo && (
                  <button
                    type="button"
                    onClick={() => { updateExercise(idx, { demoVideo: "" }); setShowVideoInput(prev => ({ ...prev, [idx]: false })); }}
                    className="text-red-400 hover:text-red-300 text-xs flex-shrink-0"
                    title="Remove video"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Row 2: Measure | Weight | Sets | Rest */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {/* Measure type */}
              <select
                value={ex.measureType}
                onChange={(e) => updateExercise(idx, { measureType: e.target.value as MeasureType })}
                className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold/50"
              >
                <option value="reps">Reps</option>
                <option value="time">Time</option>
                <option value="distance">Dist</option>
              </select>
              {/* Measure value */}
              <input
                type="text"
                value={ex.measureValue}
                onChange={(e) => updateExercise(idx, { measureValue: e.target.value })}
                className="w-12 bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-gold/50"
                placeholder={ex.measureType === "time" ? "0:30" : "0"}
              />
              <span className="text-gray-500 text-[10px]">
                {ex.measureType === "reps" ? "reps" : ex.measureType === "time" ? "h:m:s" : "m"}
              </span>

              <span className="text-gray-600 text-xs">|</span>

              {/* Weight */}
              <span className="text-gray-400 text-[10px]">Wt</span>
              <input
                type="text"
                value={ex.weight}
                onChange={(e) => updateExercise(idx, { weight: e.target.value })}
                className="w-12 bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-gold/50"
                placeholder="—"
              />
              <button
                type="button"
                onClick={() => updateExercise(idx, { weightUnit: ex.weightUnit === "kg" ? "lbs" : "kg" })}
                className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-xs font-bold hover:border-gold/50 transition-colors"
              >
                <span className="text-gold">{ex.weightUnit}</span>
              </button>

              <span className="text-gray-600 text-xs">|</span>

              {/* Sets */}
              <span className="text-gray-400 text-[10px]">Sets</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => updateExercise(idx, { sets: Math.max(1, ex.sets - 1) })}
                  className="bg-primary/50 border border-white/10 rounded-l px-1.5 py-1 text-white text-xs hover:bg-white/5"
                >
                  -
                </button>
                <span className="bg-primary/50 border-t border-b border-white/10 px-2 py-1 text-white text-xs text-center min-w-[20px]">
                  {ex.sets}
                </span>
                <button
                  type="button"
                  onClick={() => updateExercise(idx, { sets: ex.sets + 1 })}
                  className="bg-primary/50 border border-white/10 rounded-r px-1.5 py-1 text-white text-xs hover:bg-white/5"
                >
                  +
                </button>
              </div>

              <span className="text-gray-600 text-xs">|</span>

              {/* Rest */}
              <span className="text-gray-400 text-[10px]">Rest</span>
              <input
                type="text"
                value={ex.rest}
                onChange={(e) => updateExercise(idx, { rest: e.target.value })}
                className="w-14 bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-gold/50"
                placeholder="1:00"
              />
            </div>

            {/* Row 3: Notes (optional, inline) */}
            <div className="mt-1.5">
              <input
                type="text"
                value={ex.notes}
                onChange={(e) => updateExercise(idx, { notes: e.target.value })}
                className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold/50"
                placeholder="Notes (optional — e.g. slow tempo, squeeze at top)"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      {structure.exercises.some((ex) => ex.name) && (
        <div className="bg-primary/50 border border-white/5 rounded-lg p-2 mt-2">
          <p className="text-gray-400 text-[10px] uppercase mb-1">Preview (client sees):</p>
          <p className="text-white text-xs whitespace-pre-line leading-relaxed">
            {formatCrossTrainingForDisplay(structure)}
          </p>
        </div>
      )}
    </div>
  );
}
