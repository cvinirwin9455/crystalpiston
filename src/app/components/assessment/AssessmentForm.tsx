"use client";

import { useState, useEffect } from "react";
import { ASSESSMENT_SECTIONS, CONSENT_TEXT } from "./questions";

interface AssessmentFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
  reviewRequested?: boolean;
}

export default function AssessmentForm({ onSaved, onCancel, reviewRequested }: AssessmentFormProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [meds, setMeds] = useState<{ name: string; reason: string }[]>([{ name: "", reason: "" }]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/assessment");
        if (res.ok) {
          const data = await res.json();
          if (data.assessment) {
            setAnswers(data.assessment.answers || {});
            setConsent(data.assessment.consent_given || false);
            if (data.assessment.answers?.medications?.length) {
              setMeds(data.assessment.answers.medications);
            }
          }
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const setField = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!consent) {
      setError("Please provide consent before submitting.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const takingMeds = answers.takingMedication === "yes";
      const finalAnswers = {
        ...answers,
        medications: takingMeds ? meds.filter((m) => m.name.trim()) : [],
      };
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers, consentGiven: consent }),
      });
      if (res.ok) {
        onSaved?.();
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8"><p className="text-gray-400">Loading your assessment...</p></div>;
  }

  const renderField = (field: any) => {
    const val = answers[field.key];
    switch (field.type) {
      case "yesno":
        return (
          <div className="flex gap-2">
            {["yes", "no"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setField(field.key, opt)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${val === opt ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}
              >
                {opt === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        );
      case "yesno_text":
        return (
          <div>
            <div className="flex gap-2">
              {["yes", "no"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setField(field.key, opt)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${val === opt ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}
                >
                  {opt === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
            {val === "yes" && (
              <textarea
                value={answers[`${field.key}_detail`] || ""}
                onChange={(e) => setField(`${field.key}_detail`, e.target.value)}
                rows={2}
                className="w-full mt-2 bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none"
                placeholder={field.followUpLabel || "Please describe"}
              />
            )}
          </div>
        );
      case "text":
        return (
          <input
            type="text"
            value={val || ""}
            onChange={(e) => setField(field.key, e.target.value)}
            className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
            placeholder={field.placeholder || ""}
          />
        );
      case "textarea":
        return (
          <textarea
            value={val || ""}
            onChange={(e) => setField(field.key, e.target.value)}
            rows={2}
            className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none"
            placeholder={field.placeholder || ""}
          />
        );
      case "select":
        return (
          <select
            value={val || ""}
            onChange={(e) => setField(field.key, e.target.value)}
            className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Select...</option>
            {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case "medications":
        // Only shown when takingMedication === 'yes'
        if (answers.takingMedication !== "yes") return null;
        return (
          <div className="space-y-2">
            {meds.map((m, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => setMeds((prev) => prev.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))}
                  className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                  placeholder="Medication name"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={m.reason}
                    onChange={(e) => setMeds((prev) => prev.map((x, xi) => xi === i ? { ...x, reason: e.target.value } : x))}
                    className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                    placeholder="Reason for taking"
                  />
                  {meds.length > 1 && (
                    <button type="button" onClick={() => setMeds((prev) => prev.filter((_, xi) => xi !== i))} className="text-gray-500 hover:text-red-400 px-2">✕</button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setMeds((prev) => [...prev, { name: "", reason: "" }])} className="text-accent text-xs hover:underline">+ Add another medication</button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {reviewRequested && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <p className="text-yellow-400 text-sm">Your coach has asked you to review and update your assessment.</p>
        </div>
      )}

      {ASSESSMENT_SECTIONS.map((section) => (
        <div key={section.key} className="bg-secondary/30 border border-white/10 rounded-xl p-4">
          <h4 className="font-heading text-sm uppercase text-white mb-1">{section.title}</h4>
          {section.description && <p className="text-gray-400 text-xs mb-3">{section.description}</p>}
          <div className="space-y-4 mt-3">
            {section.fields.map((field) => {
              // Hide the medications list field entirely if not applicable (handled inside render)
              if (field.type === "medications" && answers.takingMedication !== "yes") return null;
              return (
                <div key={field.key}>
                  {field.type !== "medications" && <label className="text-gray-300 text-sm block mb-1.5">{field.label}</label>}
                  {field.type === "medications" && <label className="text-gray-300 text-sm block mb-1.5">List your medication</label>}
                  {renderField(field)}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Consent */}
      <div className="bg-primary/30 border border-white/10 rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-accent flex-shrink-0" />
          <span className="text-gray-300 text-xs leading-relaxed">{CONSENT_TEXT}</span>
        </label>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving || !consent} className="bg-accent hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm disabled:opacity-50">
          {saving ? "Saving..." : "Save Assessment"}
        </button>
        {onCancel && <button onClick={onCancel} className="text-gray-400 hover:text-white text-sm px-4">Cancel</button>}
      </div>
    </div>
  );
}
