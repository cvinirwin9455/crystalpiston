"use client";

import { useState, useEffect } from "react";

type MeasureType = "reps" | "time" | "distance";
type WeightUnit = "kg" | "lbs";
type ExerciseCategory = "stretching" | "strength" | "hiit" | "cross";

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  stretching: "Stretching/Mobility",
  strength: "Strength",
  hiit: "HIIT",
  cross: "Cross Training",
};

const ALL_CATEGORIES: ExerciseCategory[] = ["stretching", "strength", "hiit", "cross"];

type Exercise = {
  id: string;
  name: string;
  demoVideo: string;
  defaultMeasureType: MeasureType;
  defaultMeasureValue: string;
  defaultSets: number;
  defaultRest: string;
  defaultWeight: string;
  defaultWeightUnit: WeightUnit;
  defaultNotes: string;
  categories: ExerciseCategory[];
};

// ─── Separate Form Component ─────────────────────────────────────────────────
// Using a separate component with key={exercise.id} forces React to fully 
// re-mount it with fresh initial state whenever the exercise changes.

function ExerciseForm({
  exercise,
  onSave,
  onCancel,
}: {
  exercise: Exercise | null;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(exercise?.name || "");
  const [demoVideo, setDemoVideo] = useState(exercise?.demoVideo || "");
  const [measureType, setMeasureType] = useState<MeasureType>(exercise?.defaultMeasureType || "reps");
  const [measureValue, setMeasureValue] = useState(exercise?.defaultMeasureValue || "");
  const [sets, setSets] = useState(typeof exercise?.defaultSets === "number" ? exercise.defaultSets : 3);
  const [rest, setRest] = useState(exercise?.defaultRest || "01:00");
  const [weight, setWeight] = useState(exercise?.defaultWeight || "");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(exercise?.defaultWeightUnit || "kg");
  const [notes, setNotes] = useState(exercise?.defaultNotes || "");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ExerciseCategory[]>(exercise?.categories || []);

  const toggleCategory = (cat: ExerciseCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      demoVideo: demoVideo.trim(),
      defaultMeasureType: measureType,
      defaultMeasureValue: measureValue,
      defaultSets: sets,
      defaultRest: rest,
      defaultWeight: weight,
      defaultWeightUnit: weightUnit,
      defaultNotes: notes,
      categories,
      ...(exercise ? { originalName: exercise.name } : {}),
    });
    setSaving(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-bold text-gray-900">
        {exercise ? `Edit: ${exercise.name}` : "Add New Exercise"}
      </h3>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Exercise Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Barbell Back Squat"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Categories</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                categories.includes(cat)
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Demo Video */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Demo Video URL</label>
        <input
          type="url"
          value={demoVideo}
          onChange={(e) => setDemoVideo(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Measure Type + Value + Sets row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Measure Type</label>
          <select
            value={measureType}
            onChange={(e) => setMeasureType(e.target.value as MeasureType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="reps">Reps</option>
            <option value="time">Time</option>
            <option value="distance">Distance</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {measureType === "reps" ? "Reps" : measureType === "time" ? "Duration" : "Distance"}
          </label>
          <input
            type="text"
            value={measureValue}
            onChange={(e) => setMeasureValue(e.target.value)}
            placeholder={measureType === "reps" ? "12" : measureType === "time" ? "0:30" : "20m"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sets</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setSets(Math.max(1, sets - 1))} className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-900">−</button>
            <span className="text-sm font-medium w-6 text-center text-gray-900">{sets}</span>
            <button onClick={() => setSets(sets + 1)} className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-900">+</button>
          </div>
        </div>
      </div>

      {/* Rest + Weight + Unit row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rest (mm:ss)</label>
          <input
            type="text"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            placeholder="01:00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Default Weight</label>
          <input
            type="text"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
          <div className="flex gap-1">
            <button
              onClick={() => setWeightUnit("kg")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${weightUnit === "kg" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              kg
            </button>
            <button
              onClick={() => setWeightUnit("lbs")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${weightUnit === "lbs" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              lbs
            </button>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Form Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Brace core. Break at hips and knees together."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : exercise ? "Update All Coaches" : "Add to All Coaches"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SuperAdminExerciseLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const res = await fetch("/api/super-admin/exercise-library");
      if (res.ok) {
        const data = await res.json();
        setExercises(data);
      }
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingExercise(null);
    setShowForm(true);
  };

  const openEditForm = (ex: Exercise) => {
    setEditingExercise(ex);
    setShowForm(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingExercise(null);
  };

  const handleSave = async (payload: any) => {
    setMessage(null);
    try {
      const res = await fetch("/api/super-admin/exercise-library", {
        method: editingExercise ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (editingExercise) {
          setMessage({ text: `Updated "${payload.name}" across ${data.updated} coach(es). ${data.skippedModified || 0} skipped (coach-modified).`, type: "success" });
          setExercises((prev) =>
            prev.map((ex) =>
              ex.name === editingExercise.name
                ? { ...ex, ...data.exercise, id: ex.id }
                : ex
            )
          );
        } else {
          setMessage({ text: `Added "${payload.name}" to ${data.orgsUpdated} coach(es).`, type: "success" });
          setExercises((prev) => [...prev, { id: Date.now().toString(), ...data.exercise }].sort((a, b) => a.name.localeCompare(b.name)));
        }
        closeForm();
      } else {
        setMessage({ text: data.error || "Failed to save", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error. Try again.", type: "error" });
    }
  };

  const handleDelete = async (ex: Exercise) => {
    if (!confirm(`Delete "${ex.name}" from all coaches who haven't modified it?`)) return;
    setMessage(null);

    try {
      const res = await fetch("/api/super-admin/exercise-library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ex.name }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ text: `Deleted "${ex.name}" from ${data.deleted} coach(es).`, type: "success" });
        setExercises((prev) => prev.filter((e) => e.name !== ex.name));
      } else {
        setMessage({ text: data.error || "Failed to delete", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error. Try again.", type: "error" });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Master Exercise Library</h2>
          <p className="text-sm text-gray-500">
            {exercises.length} exercises. Changes here sync to all coaches who haven&apos;t customized the exercise.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
        >
          + Add Exercise
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Form — only for adding new exercises (editing is inline) */}
      {showForm && !editingExercise && (
        <ExerciseForm
          key="new"
          exercise={null}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercises..."
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        />
      </div>

      {/* Exercise List */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
        {filteredExercises.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {searchQuery ? "No exercises match your search." : "No exercises in the master library yet."}
          </div>
        ) : (
          filteredExercises.map((ex) => (
            <div key={ex.id} className={`px-5 py-3 transition-colors ${editingExercise?.id === ex.id ? 'bg-purple-50 border-l-4 border-l-purple-500' : 'hover:bg-gray-50'}`}>
              {editingExercise?.id === ex.id ? (
                <ExerciseForm
                  key={ex.id}
                  exercise={ex}
                  onSave={handleSave}
                  onCancel={closeForm}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">{ex.name}</span>
                      {ex.demoVideo && (
                        <a href={ex.demoVideo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded hover:bg-orange-100">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          {getVideoHostname(ex.demoVideo)}
                        </a>
                      )}
                      {(ex.categories || []).map((cat) => (
                        <span key={cat} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                          {CATEGORY_LABELS[cat]}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{ex.defaultSets} sets × {ex.defaultMeasureValue || "—"} {ex.defaultMeasureType}</span>
                      {ex.defaultWeight && <span>{ex.defaultWeight} {ex.defaultWeightUnit}</span>}
                      <span>Rest: {ex.defaultRest}</span>
                    </div>
                    {ex.defaultNotes && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-lg">{ex.defaultNotes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(ex)}
                      className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ex)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
