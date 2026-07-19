"use client";

import { useState, useEffect } from "react";
import AvatarUpload from "@/components/AvatarUpload";

type Plan = {
  id: string;
  clientId: string;
  startDate: string;
  endDate: string;
  goal: string;
  owed: number;
  paid: number;
  status: string;
  completionReason: string;
  targetDistance: string;
  raceDate: string;
  goalPace: string;
  injuryNotes: string;
  programTemplateId?: string;
  raceDateSameAsEnd?: boolean;
};

type ClientData = {
  id: string;
  clientId: string | null;
  name: string;
  email: string;
  gender: string;
  goal: string;
  status: string;
  birthday?: string | null;
  avatarUrl?: string | null;
};

export default function AccountTab({ clientData, onSave, onArchive, onDelete, dateFormat, programTemplates }: { clientData: ClientData; onSave: () => void; onArchive: () => void; onDelete: () => void; dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY"; programTemplates?: { id: string; name: string; category: string; data: { totalWeeks: number } }[] }) {
  const [name, setName] = useState(clientData.name);
  const [email, setEmail] = useState(clientData.email);
  const [gender, setGender] = useState(clientData.gender);
  const [goal, setGoal] = useState(clientData.goal);
  const [birthday, setBirthday] = useState(clientData.birthday || "");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editing, setEditing] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanStart, setNewPlanStart] = useState("");
  const [newPlanEnd, setNewPlanEnd] = useState("");
  const [newPlanOwed, setNewPlanOwed] = useState("");
  const [newPlanGoal, setNewPlanGoal] = useState("");
  const [newPlanTargetDistance, setNewPlanTargetDistance] = useState("");
  const [newPlanRaceDate, setNewPlanRaceDate] = useState("");
  const [newPlanGoalPace, setNewPlanGoalPace] = useState("");
  const [newPlanInjuryNotes, setNewPlanInjuryNotes] = useState("");
  const [newPlanProgramId, setNewPlanProgramId] = useState("");
  const [newPlanRaceDateSameAsEnd, setNewPlanRaceDateSameAsEnd] = useState(true);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when client changes
  useEffect(() => {
    setName(clientData.name);
    setEmail(clientData.email);
    setGender(clientData.gender);
    setGoal(clientData.goal);
    setBirthday(clientData.birthday || "");
    setSaveSuccess(false);
  }, [clientData.id]);

  // Fetch plans for this client
  useEffect(() => {
    if (!clientData.clientId) return;
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const res = await fetch(`/api/plans?client_id=${clientData.clientId}`);
        if (res.ok) {
          const data = await res.json();
          setPlans(data.map((p: any) => ({
            id: p.id,
            clientId: p.client_id,
            startDate: p.start_date,
            endDate: p.end_date,
            goal: p.goal || '',
            owed: parseFloat(p.owed) || 0,
            paid: parseFloat(p.paid) || 0,
            status: p.status,
            completionReason: p.completion_reason || '',
            targetDistance: p.target_distance || '',
            raceDate: p.race_date || '',
            goalPace: p.goal_pace || '',
            injuryNotes: p.injury_notes || '',
            programTemplateId: p.program_template_id || '',
            raceDateSameAsEnd: p.race_date_same_as_end !== false,
          })));
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, [clientData.clientId]);

  const handleSaveDetails = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, gender, goal,
          birthday: birthday || null,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setEditing(false);
        onSave();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanStart || !newPlanEnd || !clientData.clientId) return;
    setCreatingPlan(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientData.clientId,
          startDate: newPlanStart,
          endDate: newPlanEnd,
          owed: newPlanOwed,
          goal: newPlanGoal,
          targetDistance: newPlanTargetDistance || null,
          raceDate: newPlanRaceDateSameAsEnd ? newPlanEnd : (newPlanRaceDate || null),
          goalPace: newPlanGoalPace || null,
          injuryNotes: newPlanInjuryNotes || null,
          programTemplateId: newPlanProgramId || null,
          raceDateSameAsEnd: newPlanRaceDateSameAsEnd,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state: add new plan
        setPlans(prev => [
          {
            id: data.plan.id,
            clientId: data.plan.client_id,
            startDate: data.plan.start_date,
            endDate: data.plan.end_date,
            goal: data.plan.goal || '',
            owed: parseFloat(data.plan.owed) || 0,
            paid: parseFloat(data.plan.paid) || 0,
            status: data.plan.status,
            completionReason: '',
            targetDistance: data.plan.target_distance || '',
            raceDate: data.plan.race_date || '',
            goalPace: data.plan.goal_pace || '',
            injuryNotes: data.plan.injury_notes || '',
          },
          ...prev,
        ]);
        setShowNewPlan(false);
        setNewPlanStart("");
        setNewPlanEnd("");
        setNewPlanOwed("");
        setNewPlanGoal("");
        setNewPlanTargetDistance("");
        setNewPlanRaceDate("");
        setNewPlanGoalPace("");
        setNewPlanInjuryNotes("");
        setNewPlanProgramId("");
        setNewPlanRaceDateSameAsEnd(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to create plan. Please try again.');
      }
    } catch (err) {
      console.error("Failed to create plan:", err);
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleUpdatePlan = async (planId: string, updates: { paid?: string; status?: string; completionReason?: string }) => {
    try {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, ...updates }),
      });
      if (res.ok) {
        setPlans(prev => prev.map(p => {
          if (p.id === planId) {
            return {
              ...p,
              ...(updates.paid !== undefined ? { paid: parseFloat(updates.paid) } : {}),
              ...(updates.status !== undefined ? { status: updates.status } : {}),
              ...(updates.completionReason !== undefined ? { completionReason: updates.completionReason } : {}),
            };
          }
          return p;
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Plan update failed:", errData);
      }
    } catch (err) {
      console.error("Failed to update plan:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const monthLong = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    if (dateFormat === 'DD/MM/YYYY') return `${day} ${monthLong} ${year}`;
    return `${monthLong} ${day}, ${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Client Details */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-gray-400 text-xs font-heading uppercase">Client Details</h4>
          {!editing && <button onClick={() => setEditing(true)} className="text-accent text-xs hover:underline">Edit</button>}
        </div>

        {!editing ? (
          /* View Mode */
          <div className="space-y-4">
            <div className="flex items-start gap-5">
              {/* Avatar Upload (admin can change client photo) */}
              <AvatarUpload
                currentAvatarUrl={clientData.avatarUrl}
                userName={clientData.name}
                userId={clientData.id}
                size="md"
                onUploadComplete={() => onSave()}
                onRemove={() => onSave()}
              />
              <div className="grid md:grid-cols-4 gap-4 flex-1">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Name</p>
                  <p className="text-white text-sm">{name || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Email</p>
                  <p className="text-white text-sm">{email || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Gender</p>
                  <p className="text-white text-sm capitalize">{gender || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Birthday</p>
                  <p className="text-white text-sm">{birthday ? `${formatDate(birthday)} (age ${Math.floor((Date.now() - new Date(birthday + 'T00:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000))})` : "—"}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Mode */
          <>
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-primary/50 border border-accent/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-primary/50 border border-accent/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full bg-primary/50 border border-accent/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Birthday</label>
                <div className="flex gap-2">
                  <select value={birthday ? new Date(birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long' }) : ''} onChange={(e) => { const current = birthday ? new Date(birthday + 'T00:00:00') : new Date(1990, 0, 1); const monthIdx = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(e.target.value); if (monthIdx >= 0) { current.setMonth(monthIdx); setBirthday(current.toISOString().split('T')[0]); } }} className="flex-1 bg-primary/50 border border-accent/30 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-accent">
                    <option value="" disabled>Month</option>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={birthday ? new Date(birthday + 'T00:00:00').getDate().toString() : ''} onChange={(e) => { const current = birthday ? new Date(birthday + 'T00:00:00') : new Date(1990, 0, 1); current.setDate(parseInt(e.target.value)); setBirthday(current.toISOString().split('T')[0]); }} className="w-16 bg-primary/50 border border-accent/30 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-accent">
                    <option value="" disabled>Day</option>
                    {Array.from({length: 31}, (_, i) => <option key={i+1} value={(i+1).toString()}>{i+1}</option>)}
                  </select>
                  <select value={birthday ? new Date(birthday + 'T00:00:00').getFullYear().toString() : ''} onChange={(e) => { const current = birthday ? new Date(birthday + 'T00:00:00') : new Date(1990, 0, 1); current.setFullYear(parseInt(e.target.value)); setBirthday(current.toISOString().split('T')[0]); }} className="w-20 bg-primary/50 border border-accent/30 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-accent">
                    <option value="" disabled>Year</option>
                    {Array.from({length: 80}, (_, i) => { const y = new Date().getFullYear() - 12 - i; return <option key={y} value={y.toString()}>{y}</option>; })}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveDetails} disabled={saving} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => { setEditing(false); setName(clientData.name); setEmail(clientData.email); setGender(clientData.gender); setGoal(clientData.goal); setBirthday(clientData.birthday || ""); }} className="text-gray-400 text-sm hover:text-white">Cancel</button>
              {saveSuccess && <span className="text-green-400 text-xs">Saved!</span>}
            </div>
          </>
        )}
      </div>

      {/* Plans & Payments */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-gray-400 text-xs font-heading uppercase">Plans & Payments</h4>
          {/* Only show + New Plan if no active plan exists */}
          {!plans.some(p => p.status === "active") ? (
            <button onClick={() => setShowNewPlan(!showNewPlan)} className="text-accent text-xs hover:underline">+ New Plan</button>
          ) : (
            <span className="text-gray-500 text-xs italic">Active plan in progress</span>
          )}
        </div>

        {/* Instruction when trying to create plan while one is active */}
        {plans.some(p => p.status === "active") && showNewPlan && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
            <p className="text-yellow-400 text-sm font-medium mb-2">You already have an active plan</p>
            <p className="text-gray-300 text-xs mb-2">You need to complete the current plan before creating a new one. This ensures clean tracking of goals, payments, and training history.</p>
            <p className="text-gray-400 text-xs">To create a new plan: scroll down to the active plan below and click &ldquo;Mark Complete&rdquo;. If there&apos;s an outstanding balance, you&apos;ll be asked to provide a reason.</p>
            <button onClick={() => setShowNewPlan(false)} className="text-gray-400 text-xs mt-3 hover:text-white">Dismiss</button>
          </div>
        )}

        {/* New Plan Form - only shown when no active plan */}
        {showNewPlan && !plans.some(p => p.status === "active") && (
          <div className="bg-secondary/50 border border-accent/20 rounded-lg p-4 mb-4">
            <p className="text-accent text-xs font-heading uppercase mb-3">Create New Plan</p>
            <div className="grid md:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Goal</label>
                <input type="text" value={newPlanGoal} onChange={(e) => setNewPlanGoal(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. War Eagle 50K" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Target Distance</label>
                <select value={newPlanTargetDistance} onChange={(e) => setNewPlanTargetDistance(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="">Select...</option><option value="5K">5K</option><option value="10K">10K</option><option value="Half Marathon">Half Marathon</option><option value="Marathon">Marathon</option><option value="Ultra">Ultra</option><option value="No Race">No Race / General Fitness</option></select>
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Race Date</label>
                <input type="date" value={newPlanRaceDate} onChange={(e) => setNewPlanRaceDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Start Date</label>
                <input type="date" value={newPlanStart} onChange={(e) => setNewPlanStart(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">End Date</label>
                <input type="date" value={newPlanEnd} onChange={(e) => setNewPlanEnd(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Plan Cost ($)</label>
                <input type="number" value={newPlanOwed} onChange={(e) => setNewPlanOwed(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="0" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Goal Race Pace</label>
                <input type="text" value={newPlanGoalPace} onChange={(e) => setNewPlanGoalPace(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="8:45/mi" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Injuries / Important Notes</label>
                <input type="text" value={newPlanInjuryNotes} onChange={(e) => setNewPlanInjuryNotes(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. History of shin splints, weak left knee" />
              </div>
            </div>
            {/* Program Assignment */}
            {programTemplates && programTemplates.length > 0 && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 mb-3">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-purple-300 text-xs block mb-1">Training Program (optional)</label>
                    <select value={newPlanProgramId} onChange={(e) => setNewPlanProgramId(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                      <option value="">No Program</option>
                      {programTemplates.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ''} — {p.data.totalWeeks} weeks</option>
                      ))}
                    </select>
                    <p className="text-gray-500 text-xs mt-1">Assigns a structured week-by-week program that auto-populates when creating weeks</p>
                  </div>
                  <div>
                    <label className="text-purple-300 text-xs block mb-1">Race Date</label>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" checked={newPlanRaceDateSameAsEnd} onChange={(e) => setNewPlanRaceDateSameAsEnd(e.target.checked)} className="rounded border-white/20 bg-primary/50 text-purple-500 focus:ring-purple-500" />
                      <span className="text-gray-400 text-xs">Race date is same as plan end date</span>
                    </div>
                    {!newPlanRaceDateSameAsEnd && (
                      <input type="date" value={newPlanRaceDate} onChange={(e) => setNewPlanRaceDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 [color-scheme:dark]" />
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleCreatePlan} disabled={creatingPlan || !newPlanStart || !newPlanEnd} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">
                {creatingPlan ? "Creating..." : "Create Plan"}
              </button>
              <button onClick={() => setShowNewPlan(false)} className="text-gray-400 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Plans List */}
        {loadingPlans && <p className="text-gray-500 text-sm">Loading plans...</p>}
        {!loadingPlans && plans.length === 0 && <p className="text-gray-500 text-sm">No plans yet. Create one above.</p>}
        {/* Active Plan */}
        {plans.filter(p => p.status === "active").map((plan) => (
          <PlanCard key={plan.id} plan={plan} onUpdate={handleUpdatePlan} dateFormat={dateFormat} />
        ))}
        {/* Completed Plans - collapsible */}
        {plans.filter(p => p.status !== "active").length > 0 && (
          <details className="mt-4">
            <summary className="text-gray-500 text-xs cursor-pointer hover:text-white">
              Show completed plans ({plans.filter(p => p.status !== "active").length})
            </summary>
            <div className="mt-3 space-y-3">
              {plans.filter(p => p.status !== "active").map((plan) => (
                <PlanCard key={plan.id} plan={plan} onUpdate={handleUpdatePlan} dateFormat={dateFormat} />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Account Actions */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Account Actions</h4>
        <p className="text-gray-500 text-xs mb-3">Archiving hides the client but keeps their data. They can no longer log in.</p>
        <div className="flex flex-wrap gap-3">
          {clientData.status === "active" ? (
            <button onClick={onArchive} className="border border-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm">Archive Client</button>
          ) : (
            <button onClick={onArchive} className="border border-green-500/30 text-green-400 py-2 px-4 rounded-lg text-sm">Reactivate Client</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-component for individual plan card with payment logging
function PlanCard({ plan, onUpdate, dateFormat }: { plan: Plan; onUpdate: (planId: string, updates: any) => void; dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" }) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentHistory, setPaymentHistory] = useState<{id: string; amount: number; date: string}[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loggingPayment, setLoggingPayment] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completionReason, setCompletionReason] = useState("");
  const [completing, setCompleting] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editGoal, setEditGoal] = useState(plan.goal);
  const [editStartDate, setEditStartDate] = useState(plan.startDate);
  const [editEndDate, setEditEndDate] = useState(plan.endDate);
  const [editOwed, setEditOwed] = useState(plan.owed.toString());
  const [editTargetDistance, setEditTargetDistance] = useState(plan.targetDistance || "");
  const [editRaceDate, setEditRaceDate] = useState(plan.raceDate || "");
  const [editGoalPace, setEditGoalPace] = useState(plan.goalPace || "");
  const [editInjuryNotes, setEditInjuryNotes] = useState(plan.injuryNotes || "");
  const [editProgramId, setEditProgramId] = useState((plan as any).programTemplateId || "");
  const [editRaceDateSameAsEnd, setEditRaceDateSameAsEnd] = useState((plan as any).raceDateSameAsEnd !== false);
  const [savingPlanEdit, setSavingPlanEdit] = useState(false);

  const handleSavePlanEdit = async () => {
    setSavingPlanEdit(true);
    try {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, goal: editGoal, startDate: editStartDate, endDate: editEndDate, owed: editOwed, targetDistance: editTargetDistance || null, raceDate: editRaceDateSameAsEnd ? editEndDate : (editRaceDate || null), goalPace: editGoalPace || null, injuryNotes: editInjuryNotes || null, programTemplateId: editProgramId || null, raceDateSameAsEnd: editRaceDateSameAsEnd }),
      });
      if (res.ok) {
        // Update local state via parent
        onUpdate(plan.id, { paid: plan.paid.toString() }); // Trigger a re-render
        setEditingPlan(false);
        // Force refresh plans by triggering parent
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to save plan edit:", err);
    } finally {
      setSavingPlanEdit(false);
    }
  };

  const hasOutstandingBalance = (plan.owed - plan.paid) > 0;

  // Fetch payments from API on mount
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await fetch(`/api/payments?plan_id=${plan.id}`);
        if (res.ok) {
          const data = await res.json();
          setPaymentHistory(data.map((p: any) => ({
            id: p.id,
            amount: parseFloat(p.amount),
            date: p.payment_date,
          })));
        }
      } catch (err) {
        console.error("Failed to fetch payments:", err);
      } finally {
        setLoadingPayments(false);
      }
    };
    fetchPayments();
  }, [plan.id]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const monthLong = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    if (dateFormat === 'DD/MM/YYYY') return `${day} ${monthLong} ${year}`;
    return `${monthLong} ${day}, ${year}`;
  };

  const handleLogPayment = async () => {
    if (!paymentAmount) return;
    setLoggingPayment(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          amount: paymentAmount,
          paymentDate: paymentDate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const amount = parseFloat(paymentAmount);
        setPaymentHistory(prev => [{ id: data.payment.id, amount, date: paymentDate }, ...prev]);
        onUpdate(plan.id, { paid: data.newPaidTotal.toString() });
        setPaymentAmount("");
        setShowPaymentForm(false);
      }
    } catch (err) {
      console.error("Failed to log payment:", err);
    } finally {
      setLoggingPayment(false);
    }
  };

  const handleCompletePlan = async () => {
    // If outstanding balance, require reason
    if (hasOutstandingBalance && !completionReason.trim()) return;
    setCompleting(true);
    try {
      const updates = hasOutstandingBalance 
        ? { status: "completed", completionReason: completionReason.trim() }
        : { status: "completed" };
      await onUpdate(plan.id, updates);
      setShowCompleteConfirm(false);
      setCompletionReason("");
    } catch (err) {
      console.error("Failed to complete plan:", err);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className={`border rounded-lg p-4 mb-3 ${plan.status === "active" ? "border-accent/20" : "border-white/5"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {plan.goal && <span className="text-white text-sm font-medium">{plan.goal}</span>}
          {!plan.goal && <span className="text-white text-sm font-medium">{formatDate(plan.startDate)} — {formatDate(plan.endDate)}</span>}
          {plan.goal && <span className="text-gray-400 text-xs">{formatDate(plan.startDate)} — {formatDate(plan.endDate)}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${plan.status === "active" ? "bg-green-500/20 text-green-400" : plan.status === "completed" ? "bg-blue-500/20 text-blue-400" : "bg-gray-500/20 text-gray-400"}`}>
            {plan.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === "active" && (
            <>
              <button onClick={() => setEditingPlan(!editingPlan)} className="text-gray-500 text-xs hover:text-accent">{editingPlan ? "Cancel Edit" : "Edit Plan"}</button>
              <button onClick={() => setShowCompleteConfirm(true)} className="text-gray-500 text-xs hover:text-white">Mark Complete</button>
            </>
          )}
          {plan.status === "completed" && (
            <button onClick={() => onUpdate(plan.id, { status: "active" })} className="text-gray-500 text-xs hover:text-blue-400">Reactivate Plan</button>
          )}
        </div>
      </div>

      {/* Edit Plan Form */}
      {editingPlan && plan.status === "active" && (
        <div className="bg-secondary/50 border border-accent/20 rounded-lg p-4 mb-3">
          <p className="text-accent text-xs font-heading uppercase mb-3">Edit Plan</p>
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Goal</label>
              <input type="text" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. War Eagle 50K" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Target Distance</label>
              <select value={editTargetDistance} onChange={(e) => setEditTargetDistance(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="">Select...</option><option value="5K">5K</option><option value="10K">10K</option><option value="Half Marathon">Half Marathon</option><option value="Marathon">Marathon</option><option value="Ultra">Ultra</option><option value="No Race">No Race / General Fitness</option></select>
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Race Date</label>
              <input type="date" value={editRaceDate} onChange={(e) => setEditRaceDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Start Date</label>
              <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">End Date</label>
              <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Plan Cost ($)</label>
              <input type="number" value={editOwed} onChange={(e) => setEditOwed(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Goal Race Pace</label>
              <input type="text" value={editGoalPace} onChange={(e) => setEditGoalPace(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="8:45/mi" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Injuries / Important Notes</label>
              <input type="text" value={editInjuryNotes} onChange={(e) => setEditInjuryNotes(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. History of shin splints" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSavePlanEdit} disabled={savingPlanEdit} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg text-xs disabled:opacity-50">{savingPlanEdit ? "Saving..." : "Save Changes"}</button>
            <button onClick={() => { setEditingPlan(false); setEditGoal(plan.goal); setEditStartDate(plan.startDate); setEditEndDate(plan.endDate); setEditOwed(plan.owed.toString()); setEditTargetDistance(plan.targetDistance || ""); setEditRaceDate(plan.raceDate || ""); setEditGoalPace(plan.goalPace || ""); setEditInjuryNotes(plan.injuryNotes || ""); setEditProgramId((plan as any).programTemplateId || ""); setEditRaceDateSameAsEnd((plan as any).raceDateSameAsEnd !== false); }} className="text-gray-400 text-xs hover:text-white">Cancel</button>
          </div>
          {/* Program Assignment (Edit) */}
          {programTemplates && programTemplates.length > 0 && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 mt-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-purple-300 text-xs block mb-1">Training Program (optional)</label>
                  <select value={editProgramId} onChange={(e) => setEditProgramId(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                    <option value="">No Program</option>
                    {programTemplates.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ''} — {p.data.totalWeeks} weeks</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-purple-300 text-xs block mb-1">Race Date Setting</label>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editRaceDateSameAsEnd} onChange={(e) => setEditRaceDateSameAsEnd(e.target.checked)} className="rounded border-white/20 bg-primary/50 text-purple-500 focus:ring-purple-500" />
                    <span className="text-gray-400 text-xs">Race date same as plan end date</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion confirmation dialog */}
      {showCompleteConfirm && (
        <div className="bg-secondary/50 border border-white/10 rounded-lg p-4 mb-3">
          {hasOutstandingBalance ? (
            <>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                <p className="text-yellow-400 text-sm font-medium mb-1">Outstanding Balance: ${(plan.owed - plan.paid).toFixed(2)}</p>
                <p className="text-gray-300 text-xs">This plan has an unpaid balance. Please explain why the plan is being completed with outstanding payment, and why the client didn&apos;t finish (if applicable). This will be saved for your records.</p>
              </div>
              <div className="mb-3">
                <label className="text-gray-400 text-xs block mb-1">Reason for completing with balance due <span className="text-red-400">*</span></label>
                <textarea
                  value={completionReason}
                  onChange={(e) => setCompletionReason(e.target.value)}
                  className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none"
                  rows={3}
                  placeholder="e.g. Client decided to take a break, will resume next quarter. Remaining balance waived / will carry over to next plan."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={handleCompletePlan} disabled={!completionReason.trim() || completing} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-xs disabled:opacity-50">
                  {completing ? "Completing..." : "Complete Plan"}
                </button>
                <button onClick={() => { setShowCompleteConfirm(false); setCompletionReason(""); }} className="text-gray-400 text-xs hover:text-white">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-300 text-sm mb-3">Are you sure you want to mark this plan as complete? This client is paid in full.</p>
              <div className="flex gap-3">
                <button onClick={handleCompletePlan} disabled={completing} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-xs disabled:opacity-50">
                  {completing ? "Completing..." : "Yes, Complete Plan"}
                </button>
                <button onClick={() => setShowCompleteConfirm(false)} className="text-gray-400 text-xs hover:text-white">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <p className="text-gray-500 text-xs">Plan Cost</p>
          <p className="text-white font-medium">${plan.owed.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Total Paid</p>
          <p className="text-white font-medium">${plan.paid.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Balance</p>
          <p className={`font-bold ${(plan.owed - plan.paid) > 0 ? "text-red-400" : "text-green-400"}`}>
            {(plan.owed - plan.paid) > 0 ? `$${(plan.owed - plan.paid).toFixed(2)} due` : "Paid in full"}
          </p>
        </div>
      </div>
      {/* Target Distance & Race Date — always show for active plans */}
      {plan.status === "active" && (
        <div className="grid md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-white/5">
          <div><p className="text-gray-500 text-xs">Target Distance</p><p className="text-white text-sm">{plan.targetDistance || "—"}</p></div>
          <div><p className="text-gray-500 text-xs">Race Date</p><p className="text-white text-sm">{plan.raceDate ? formatDate(plan.raceDate) : "—"}</p></div>
          <div><p className="text-gray-500 text-xs">Goal Race Pace</p><p className="text-white text-sm">{plan.goalPace || "—"}</p></div>
          <div><p className="text-gray-500 text-xs">Injuries / Notes</p><p className="text-white text-sm">{plan.injuryNotes || "—"}</p></div>
        </div>
      )}
      {plan.status !== "active" && (plan.targetDistance || plan.raceDate || plan.goalPace || plan.injuryNotes) && (
        <div className="grid md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5">
          {plan.targetDistance && <div><p className="text-gray-500 text-xs">Target Distance</p><p className="text-white text-sm">{plan.targetDistance}</p></div>}
          {plan.raceDate && <div><p className="text-gray-500 text-xs">Race Date</p><p className="text-white text-sm">{formatDate(plan.raceDate)}</p></div>}
          {plan.goalPace && <div><p className="text-gray-500 text-xs">Goal Race Pace</p><p className="text-white text-sm">{plan.goalPace}</p></div>}
          {plan.injuryNotes && <div className="col-span-2"><p className="text-gray-500 text-xs">Injuries / Notes</p><p className="text-white text-sm">{plan.injuryNotes}</p></div>}
        </div>
      )}
      <div className="w-full bg-primary/50 rounded-full h-1.5 mt-3">
        <div className={`h-1.5 rounded-full ${(plan.owed - plan.paid) > 0 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${plan.owed > 0 ? Math.min(100, (plan.paid / plan.owed) * 100) : 100}%` }} />
      </div>

      {/* Completion info (shown on completed plans) */}
      {plan.status === "completed" && (plan.owed - plan.paid) > 0 && (
        <div className="mt-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-yellow-400 text-xs font-heading uppercase">Completed with Balance Due</p>
            <p className="text-yellow-400 text-xs font-bold">${(plan.owed - plan.paid).toFixed(2)} unpaid</p>
          </div>
          {plan.completionReason && <p className="text-gray-300 text-xs mt-1">{plan.completionReason}</p>}
        </div>
      )}
      {plan.status === "completed" && (plan.owed - plan.paid) <= 0 && plan.completionReason && (
        <div className="mt-3 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
          <p className="text-green-400 text-xs font-heading uppercase mb-1">Completion Notes</p>
          <p className="text-gray-300 text-xs">{plan.completionReason}</p>
        </div>
      )}

      {/* Payment History */}
      {!loadingPayments && paymentHistory.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-gray-500 text-xs mb-2">Payment History</p>
          <div className="space-y-1">
            {paymentHistory.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{formatDate(p.date)}</span>
                <span className="text-green-400 font-medium">+${p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {loadingPayments && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-gray-500 text-xs">Loading payments...</p>
        </div>
      )}

      {/* Log Payment button */}
      {plan.status === "active" && (plan.owed - plan.paid) > 0 && (
        <div className="mt-3">
          {!showPaymentForm ? (
            <button onClick={() => setShowPaymentForm(true)} className="text-accent text-xs hover:underline">+ Log Payment</button>
          ) : (
            <div className="bg-secondary/50 border border-white/10 rounded-lg p-3 mt-2">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Amount ($)</label>
                  <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent" placeholder="0" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Date</label>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleLogPayment} disabled={!paymentAmount || loggingPayment} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded text-xs disabled:opacity-50">{loggingPayment ? "Saving..." : "Log Payment"}</button>
                <button onClick={() => { setShowPaymentForm(false); setPaymentAmount(""); }} className="text-gray-400 text-xs">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
