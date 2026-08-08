"use client";

import { useState, useEffect } from "react";
import type { ExerciseLibraryItem, MeasureType, WeightUnit } from "./StructuredCrossTrainingBuilder";

interface Props {
  onBack: () => void;
  weightUnit?: WeightUnit;
}

export default function ExerciseLibraryTab({ onBack, weightUnit = "kg" }: Props) {
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDemoVideo, setFormDemoVideo] = useState("");
  const [formMeasureType, setFormMeasureType] = useState<MeasureType>("reps");
  const [formMeasureValue, setFormMeasureValue] = useState("");
  const [formSets, setFormSets] = useState(3);
  const [formRest, setFormRest] = useState("01:00");
  const [formWeight, setFormWeight] = useState("");
  const [formWeightUnit, setFormWeightUnit] = useState<WeightUnit>(weightUnit);
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const res = await fetch("/api/exercise-library");
      if (res.ok) {
        const data = await res.json();
        setExercises(data);
      }
    } catch (err) {
      console.error("Failed to fetch exercise library:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDemoVideo("");
    setFormMeasureType("reps");
    setFormMeasureValue("");
    setFormSets(3);
    setFormRest("01:00");
    setFormWeight("");
    setFormWeightUnit(weightUnit);
    setFormNotes("");
  };

  const startEdit = (ex: ExerciseLibraryItem) => {
    setEditingId(ex.id);
    setFormName(ex.name);
    setFormDemoVideo(ex.demoVideo || "");
    setFormMeasureType(ex.defaultMeasureType || "reps");
    setFormMeasureValue(ex.defaultMeasureValue || "");
    setFormSets(ex.defaultSets || 3);
    setFormRest(ex.defaultRest || "01:00");
    setFormWeight(ex.defaultWeight || "");
    setFormWeightUnit(ex.defaultWeightUnit || weightUnit);
    setFormNotes(ex.defaultNotes || "");
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      name: formName.trim(),
      demoVideo: formDemoVideo.trim(),
      defaultMeasureType: formMeasureType,
      defaultMeasureValue: formMeasureValue,
      defaultSets: formSets,
      defaultRest: formRest,
      defaultWeight: formWeight,
      defaultWeightUnit: formWeightUnit,
      defaultNotes: formNotes,
    };

    try {
      const res = await fetch("/api/exercise-library", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (editingId) {
          setExercises((prev) => prev.map((ex) => (ex.id === editingId ? data.exercise : ex)));
        } else {
          setExercises((prev) => [...prev, data.exercise].sort((a, b) => a.name.localeCompare(b.name)));
        }
        resetForm();
        setShowAddForm(false);
        setEditingId(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Save exercise failed:", res.status, errData);
        alert(`Failed to save: ${errData.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to save exercise:", err);
      alert("Failed to save exercise. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this exercise from your library?")) return;

    try {
      const res = await fetch("/api/exercise-library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setExercises((prev) => prev.filter((ex) => ex.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete exercise:", err);
    }
  };

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getVideoHostname = (url: string) => {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtube") || u.hostname.includes("youtu.be")) return "YouTube";
      if (u.hostname.includes("vimeo")) return "Vimeo";
      return u.hostname;
    } catch {
      return "";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors md:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-heading text-white">Exercise Library</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Save exercises with demo videos. They auto-complete when building workouts.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingId(null); setShowAddForm(true); }}
          className="bg-gold/20 hover:bg-gold/30 text-gold font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Exercise
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
          placeholder="Search exercises..."
        />
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-secondary/50 border border-gold/20 rounded-xl p-4 mb-6">
          <h3 className="text-gold font-heading text-sm uppercase mb-3">
            {editingId ? "Edit Exercise" : "New Exercise"}
          </h3>

          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Exercise Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-primary/50 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
                placeholder="e.g. Bird Dog, Clamshell, Deadlift"
              />
            </div>

            {/* Demo Video URL */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Demo Video URL</label>
              <input
                type="url"
                value={formDemoVideo}
                onChange={(e) => setFormDemoVideo(e.target.value)}
                className="w-full bg-primary/50 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {formDemoVideo && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {getVideoHostname(formDemoVideo)} video linked — clients will see this in their plan
                </p>
              )}
            </div>

            {/* Default Settings Row */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Default Settings (optional)</label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Measure type */}
                <select
                  value={formMeasureType}
                  onChange={(e) => setFormMeasureType(e.target.value as MeasureType)}
                  className="bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold/50"
                >
                  <option value="reps">Reps</option>
                  <option value="time">Time</option>
                  <option value="distance">Distance</option>
                </select>
                <input
                  type="text"
                  value={formMeasureValue}
                  onChange={(e) => setFormMeasureValue(e.target.value)}
                  className="w-16 bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-gold/50"
                  placeholder={formMeasureType === "time" ? "0:30" : "12"}
                />

                <span className="text-gray-600">|</span>

                <span className="text-gray-400 text-xs">Sets</span>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setFormSets(Math.max(1, formSets - 1))}
                    className="bg-primary/50 border border-white/10 rounded-l px-2 py-1.5 text-white text-xs hover:bg-white/5"
                  >
                    -
                  </button>
                  <span className="bg-primary/50 border-t border-b border-white/10 px-3 py-1.5 text-white text-xs text-center min-w-[24px]">
                    {formSets}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormSets(formSets + 1)}
                    className="bg-primary/50 border border-white/10 rounded-r px-2 py-1.5 text-white text-xs hover:bg-white/5"
                  >
                    +
                  </button>
                </div>

                <span className="text-gray-600">|</span>

                <span className="text-gray-400 text-xs">Rest</span>
                <input
                  type="text"
                  value={formRest}
                  onChange={(e) => setFormRest(e.target.value)}
                  className="w-16 bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-gold/50"
                  placeholder="1:00"
                />

                <span className="text-gray-600">|</span>

                <span className="text-gray-400 text-xs">Weight</span>
                <input
                  type="text"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-gold/50"
                  placeholder="--"
                />
                <button
                  type="button"
                  onClick={() => setFormWeightUnit(formWeightUnit === "kg" ? "lbs" : "kg")}
                  className="bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-xs font-bold text-gold hover:border-gold/50 transition-colors"
                >
                  {formWeightUnit}
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Default Notes</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full bg-primary/50 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
                placeholder="e.g. Slow tempo, hold 2 sec at top"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="bg-gold hover:bg-yellow-500 text-black font-bold py-2 px-5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update Exercise" : "Save to Library"}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setEditingId(null); resetForm(); }}
                className="text-gray-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise List */}
      {loading ? (
        <div className="text-gray-400 text-sm text-center py-8">Loading...</div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-400 text-sm">
            {searchQuery ? "No exercises match your search." : "Your exercise library is empty."}
          </p>
          {!searchQuery && (
            <p className="text-gray-500 text-xs mt-1">
              Add exercises with demo videos to quickly build workouts.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExercises.map((ex) => (
            <div
              key={ex.id}
              className="bg-secondary/30 border border-white/5 rounded-xl p-4 hover:border-gold/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium text-sm truncate">{ex.name}</h3>
                    {ex.demoVideo && (
                      <span className="flex items-center gap-1 text-gold text-[10px] bg-gold/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {getVideoHostname(ex.demoVideo)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    {ex.defaultSets && ex.defaultSets > 1 && <span>{ex.defaultSets} sets</span>}
                    {ex.defaultMeasureValue && (
                      <span>
                        {ex.defaultMeasureValue}{" "}
                        {ex.defaultMeasureType === "reps" ? "reps" : ex.defaultMeasureType === "time" ? "" : "m"}
                      </span>
                    )}
                    {ex.defaultWeight && (
                      <span>@ {ex.defaultWeight}{ex.defaultWeightUnit || "kg"}</span>
                    )}
                    {ex.defaultRest && ex.defaultRest !== "00:00" && (
                      <span>Rest: {ex.defaultRest}</span>
                    )}
                  </div>
                  {ex.defaultNotes && (
                    <p className="text-gray-500 text-xs mt-1 italic">{ex.defaultNotes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(ex)}
                    className="text-gray-400 hover:text-gold p-1.5 rounded-lg hover:bg-gold/10 transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(ex.id)}
                    className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats footer */}
      {exercises.length > 0 && (
        <div className="mt-6 text-center text-xs text-gray-500">
          {exercises.length} exercise{exercises.length !== 1 ? "s" : ""} in your library
          {exercises.filter(e => e.demoVideo).length > 0 && (
            <> &middot; {exercises.filter(e => e.demoVideo).length} with video</>
          )}
        </div>
      )}
    </div>
  );
}
