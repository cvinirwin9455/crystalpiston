"use client";

import { useState, useEffect } from "react";
import { ASSESSMENT_SECTIONS } from "@/app/components/assessment/questions";

interface AssessmentTabProps {
  clientId: string;
  clientName: string;
}

export default function AssessmentTab({ clientId, clientName }: AssessmentTabProps) {
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/assessment?client_id=${clientId}`);
        if (res.ok) {
          const data = await res.json();
          setAssessment(data.assessment);
          if (data.assessment?.status === "review_requested") setRequested(true);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [clientId]);

  const handleRequestReview = async () => {
    setRequesting(true);
    try {
      const res = await fetch("/api/assessment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, action: "request_review" }),
      });
      if (res.ok) setRequested(true);
    } catch {}
    setRequesting(false);
  };

  if (loading) {
    return <div className="text-center py-8"><p className="text-gray-400">Loading assessment...</p></div>;
  }

  const answers = assessment?.answers || {};
  const completed = assessment?.status === "completed";
  const firstName = clientName.split(" ")[0];

  // Collect flagged (health-risk) answers that are "yes"
  const flagged: { label: string; detail?: string }[] = [];
  for (const section of ASSESSMENT_SECTIONS) {
    for (const field of section.fields) {
      if ((field as any).flagOnYes) {
        const v = answers[field.key];
        if (v === "yes" || (field.type === "select" && v === "Yes")) {
          flagged.push({ label: field.label, detail: answers[`${field.key}_detail`] });
        }
      }
    }
  }

  const displayValue = (field: any) => {
    const v = answers[field.key];
    if (field.type === "medications") {
      const meds = answers.medications || [];
      if (!meds.length) return <span className="text-gray-500">None listed</span>;
      return (
        <div className="space-y-1">
          {meds.map((m: any, i: number) => (
            <div key={i} className="text-white text-sm">{m.name}{m.reason ? ` — ${m.reason}` : ""}</div>
          ))}
        </div>
      );
    }
    if (v === undefined || v === "" || v === null) return <span className="text-gray-500">—</span>;
    if (field.type === "yesno" || field.type === "yesno_text") {
      const detail = answers[`${field.key}_detail`];
      return (
        <span className="text-white text-sm">
          {v === "yes" ? "Yes" : "No"}{v === "yes" && detail ? ` — ${detail}` : ""}
        </span>
      );
    }
    return <span className="text-white text-sm">{String(v)}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-heading text-lg uppercase text-white">Health Assessment</h3>
          <p className="text-gray-400 text-xs">{firstName}&apos;s intake &amp; health screening</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${completed ? "bg-green-500/20 text-green-400" : assessment?.status === "review_requested" ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-500/20 text-gray-400"}`}>
            {completed ? "✓ Completed" : assessment?.status === "review_requested" ? "Review requested" : "Not started"}
          </span>
          {assessment?.updated_at && (
            <span className="text-gray-500 text-xs">Updated {new Date(assessment.updated_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {!assessment || assessment.status === "not_started" ? (
        <div className="bg-primary/20 border border-white/5 rounded-xl p-6 text-center">
          <p className="text-gray-400 text-sm">{firstName} hasn&apos;t completed their assessment yet.</p>
          <p className="text-gray-500 text-xs mt-1">They&apos;ll be prompted to complete it when they log in.</p>
        </div>
      ) : (
        <>
          {/* Flagged health items */}
          {flagged.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-sm font-medium mb-2">⚠️ Health items to review ({flagged.length})</p>
              <p className="text-gray-400 text-xs mb-2">Review these before programming. Refer to a medical professional if appropriate — you are not expected to diagnose.</p>
              <ul className="space-y-1">
                {flagged.map((f, i) => (
                  <li key={i} className="text-gray-200 text-xs">• {f.label}{f.detail ? <span className="text-gray-400"> — {f.detail}</span> : ""}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Consent status */}
          <div className="bg-secondary/30 border border-white/10 rounded-lg p-3 text-xs">
            {assessment.consent_given ? (
              <span className="text-green-400">✓ Client gave consent to share health info{assessment.consent_at ? ` on ${new Date(assessment.consent_at).toLocaleDateString()}` : ""}</span>
            ) : (
              <span className="text-yellow-400">Consent not recorded</span>
            )}
          </div>

          {/* All answers by section */}
          {ASSESSMENT_SECTIONS.map((section) => (
            <div key={section.key} className="bg-secondary/30 border border-white/10 rounded-xl p-4">
              <h4 className="font-heading text-sm uppercase text-gray-300 mb-3">{section.title}</h4>
              <div className="space-y-2.5">
                {section.fields.map((field) => {
                  if (field.type === "medications" && answers.takingMedication !== "yes") return null;
                  const isFlagged = (field as any).flagOnYes && (answers[field.key] === "yes" || answers[field.key] === "Yes");
                  return (
                    <div key={field.key} className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 ${isFlagged ? "bg-red-500/5 -mx-2 px-2 py-1.5 rounded-lg border border-red-500/20" : ""}`}>
                      <span className="text-gray-400 text-sm sm:max-w-[55%]">{field.type === "medications" ? "Medication" : field.label}</span>
                      <span className="sm:text-right">{displayValue(field)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Request review */}
          <div className="bg-secondary/30 border border-white/10 rounded-xl p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-white text-sm font-medium">Ask {firstName} to review their assessment</p>
              <p className="text-gray-400 text-xs">Sends a prompt to confirm it&apos;s still accurate or update it.</p>
            </div>
            <button
              onClick={handleRequestReview}
              disabled={requesting || requested}
              className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
            >
              {requested ? "Review requested ✓" : requesting ? "Sending..." : "Request Review"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
