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
  billingMode?: 'programming_only' | 'per_session' | 'hybrid';
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
  stravaProfileUrl?: string | null;
};

export default function AccountTab({ clientData, onSave, onArchive, onDelete, onPlanChange, dateFormat, programTemplates }: { clientData: ClientData; onSave: () => void; onArchive: () => void; onDelete: () => void; onPlanChange?: () => void; dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY"; programTemplates?: { id: string; name: string; category: string; data: { totalWeeks: number } }[] }) {
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
  
  // Billing mode state
  const [newPlanBillingMode, setNewPlanBillingMode] = useState<'programming_only' | 'per_session' | 'hybrid'>('programming_only');
  const [newPlanSessionCount, setNewPlanSessionCount] = useState("");
  const [newPlanPerSessionCost, setNewPlanPerSessionCost] = useState("");
  const [newPlanProgrammingCost, setNewPlanProgrammingCost] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Cycle tracking consent state
  const [cycleTrackingRequested, setCycleTrackingRequested] = useState(false);
  const [cycleTrackingConsented, setCycleTrackingConsented] = useState<boolean | null>(null);
  const [cycleTrackingSaving, setCycleTrackingSaving] = useState(false);

  // Reset form when client changes
  useEffect(() => {
    setName(clientData.name);
    setEmail(clientData.email);
    setGender(clientData.gender);
    setGoal(clientData.goal);
    setBirthday(clientData.birthday || "");
    setSaveSuccess(false);
  }, [clientData.id]);

  // Fetch cycle tracking status when client changes (only for female clients)
  useEffect(() => {
    if (!clientData.clientId || clientData.gender !== 'female') return;
    const fetchCycleTracking = async () => {
      try {
        const res = await fetch(`/api/cycle-tracking?client_id=${clientData.clientId}`);
        if (res.ok) {
          const data = await res.json();
          setCycleTrackingRequested(data.requested || false);
          setCycleTrackingConsented(data.consented);
        }
      } catch {}
    };
    fetchCycleTracking();
  }, [clientData.clientId, clientData.gender]);

  const toggleCycleTracking = async () => {
    if (!clientData.clientId) return;
    setCycleTrackingSaving(true);
    const newValue = !cycleTrackingRequested;
    try {
      const res = await fetch('/api/cycle-tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientData.clientId, requested: newValue }),
      });
      if (res.ok) {
        setCycleTrackingRequested(newValue);
        if (!newValue) setCycleTrackingConsented(null);
      }
    } catch {}
    setCycleTrackingSaving(false);
  };

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
            billingMode: p.billing_mode || 'programming_only',
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
    // Validation based on billing mode
    if (!newPlanGoal || !clientData.clientId) return;
    if ((newPlanBillingMode === 'programming_only' || newPlanBillingMode === 'hybrid') && (!newPlanStart || !newPlanEnd)) return;
    if ((newPlanBillingMode === 'per_session' || newPlanBillingMode === 'hybrid') && (!newPlanSessionCount || parseInt(newPlanSessionCount) <= 0 || !newPlanPerSessionCost)) return;
    
    setCreatingPlan(true);
    
    // Calculate session total cost (count × per-session cost)
    const sessionTotalCost = (parseInt(newPlanSessionCount) || 0) * (parseFloat(newPlanPerSessionCost) || 0);
    
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientData.clientId,
          startDate: newPlanStart || null,
          endDate: newPlanEnd || null,
          owed: newPlanBillingMode === 'per_session' ? "0" : (newPlanProgrammingCost || "0"),
          goal: newPlanGoal,
          targetDistance: newPlanTargetDistance || null,
          raceDate: newPlanRaceDate || null,
          goalPace: newPlanGoalPace || null,
          injuryNotes: newPlanInjuryNotes || null,
          programTemplateId: (newPlanProgramId && newPlanProgramId !== "__expand__") ? newPlanProgramId : null,
          billingMode: newPlanBillingMode,
          sessionCount: (newPlanBillingMode === 'per_session' || newPlanBillingMode === 'hybrid') ? parseInt(newPlanSessionCount) || 0 : 0,
          sessionCost: (newPlanBillingMode === 'per_session' || newPlanBillingMode === 'hybrid') ? sessionTotalCost.toString() : "0",
          perSessionCost: (newPlanBillingMode === 'per_session' || newPlanBillingMode === 'hybrid') ? newPlanPerSessionCost || "0" : "0",
          programmingCost: (newPlanBillingMode === 'programming_only' || newPlanBillingMode === 'hybrid') ? newPlanProgrammingCost || "0" : "0",
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
            billingMode: data.plan.billing_mode || newPlanBillingMode,
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
        setNewPlanBillingMode('programming_only');
        setNewPlanSessionCount("");
        setNewPlanPerSessionCost("");
        setNewPlanProgrammingCost("");
        // Notify parent so the Sessions tab + active plan banner refresh
        onPlanChange?.();
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
        // Notify parent (status changes like complete/reactivate affect the Sessions tab)
        if (updates.status !== undefined) onPlanChange?.();
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
              {/* Client avatar (view only — only clients can change their own photo) */}
              <AvatarUpload
                currentAvatarUrl={clientData.avatarUrl || clientData.stravaProfileUrl}
                userName={clientData.name}
                userId={clientData.id}
                size="md"
                readOnly={true}
              />
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                  <select value={birthday ? new Date(birthday + 'T00:00:00').getFullYear().toString() : ''} onChange={(e) => { const current = birthday ? new Date(birthday + 'T00:00:00') : new Date(1990, 0, 1); current.setFullYear(parseInt(e.target.value)); setBirthday(current.toISOString().split('T')[0]); }} className="w-24 bg-primary/50 border border-accent/30 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-accent">
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

      {/* Cycle Tracking — only for female clients */}
      {clientData.gender === 'female' && (
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-accent"></span>
            <div>
              <h4 className="text-white text-sm font-medium">Menstrual Cycle Tracking</h4>
              <p className="text-gray-500 text-xs mt-0.5">Track period data to inform training intensity</p>
            </div>
          </div>
          <button onClick={toggleCycleTracking} disabled={cycleTrackingSaving} className={`relative w-11 h-6 rounded-full transition-colors ${cycleTrackingRequested ? 'bg-accent' : 'bg-gray-600'} ${cycleTrackingSaving ? 'opacity-50' : ''}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cycleTrackingRequested ? 'translate-x-5' : 'translate-x-0'}`}></span>
          </button>
        </div>
        {/* Show consent status — client is prompted automatically on her next login */}
        <div className="mt-3 bg-accent/5 border border-accent/20 rounded-lg p-3">
          {cycleTrackingConsented === null && (
            <p className="text-accent text-xs"><span className="font-medium">Consent pending</span> — {clientData.name} will be asked to opt in the next time she logs in. You won&apos;t see any cycle data unless she consents.</p>
          )}
          {cycleTrackingConsented === true && (
            <p className="text-green-600 text-xs"><span className="font-medium">Client has opted in</span> — cycle data will appear on completed workouts when logged.</p>
          )}
          {cycleTrackingConsented === false && (
            <p className="text-gray-400 text-xs"><span className="font-medium">Client has declined</span> — cycle data will not be tracked or visible.</p>
          )}
        </div>
      </div>
      )}

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

            {/* Required Fields */}
            <div className="mb-4">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Goal <span className="text-accent">*</span></label>
                <input type="text" value={newPlanGoal} onChange={(e) => setNewPlanGoal(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Marathon prep, Strength building, Rehab" />
              </div>
            </div>

            {/* Training Program (expandable) */}
            <div className="border border-white/5 rounded-lg mb-3 overflow-hidden">
              <button type="button" onClick={() => setNewPlanProgramId(newPlanProgramId === "__expand__" ? "" : (newPlanProgramId || "__expand__"))} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2">
                  <svg className={`w-3 h-3 text-gray-400 transition-transform ${newPlanProgramId && newPlanProgramId !== "__expand__" ? "rotate-90" : (newPlanProgramId === "__expand__" ? "rotate-90" : "")}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <span className="text-gray-300 text-sm font-medium">Assign Training Program</span>
                  {newPlanProgramId && newPlanProgramId !== "__expand__" && <span className="text-accent text-xs">✓ Set</span>}
                </div>
                <span className="text-gray-500 text-xs">Optional</span>
              </button>
              {(newPlanProgramId === "__expand__" || (newPlanProgramId && newPlanProgramId !== "__expand__" && programTemplates && programTemplates.length > 0)) && programTemplates && programTemplates.length > 0 && (
                <div className="px-4 pb-3 space-y-3 border-t border-white/5 pt-3">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Training Program</label>
                    <select value={newPlanProgramId === "__expand__" ? "" : newPlanProgramId} onChange={(e) => setNewPlanProgramId(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                      <option value="">No Program</option>
                      {programTemplates.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ''} — {p.data.totalWeeks} weeks</option>
                      ))}
                    </select>
                  </div>
                  {newPlanProgramId && newPlanProgramId !== "__expand__" && (
                    <>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Target Distance</label>
                          <select value={newPlanTargetDistance} onChange={(e) => setNewPlanTargetDistance(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="">Select...</option><option value="5K">5K</option><option value="10K">10K</option><option value="Half Marathon">Half Marathon</option><option value="Marathon">Marathon</option><option value="Ultra">Ultra</option><option value="No Race">No Race / General Fitness</option></select>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Race Date</label>
                          <input type="date" value={newPlanRaceDate} onChange={(e) => setNewPlanRaceDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs">Race Date is used to calculate which program week to auto-load when creating training weeks.</p>
                    </>
                  )}
                  {newPlanProgramId === "__expand__" && (
                    <p className="text-gray-500 text-xs">Select a program to auto-populate workouts when creating training weeks.</p>
                  )}
                </div>
              )}
            </div>

            {/* Billing Mode */}
            <div className="border border-white/5 rounded-lg mb-4 overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-gray-300 text-sm font-medium">Set Billing</span>
                </div>
                
                {/* Billing Mode Selector */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button type="button" onClick={() => setNewPlanBillingMode('programming_only')} className={`text-center py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${newPlanBillingMode === 'programming_only' ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                    <span className="block text-sm mb-0.5">📋</span>
                    Programming Only
                  </button>
                  <button type="button" onClick={() => setNewPlanBillingMode('per_session')} className={`text-center py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${newPlanBillingMode === 'per_session' ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                    <span className="block text-sm mb-0.5">🏋️</span>
                    Per Session
                  </button>
                  <button type="button" onClick={() => setNewPlanBillingMode('hybrid')} className={`text-center py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${newPlanBillingMode === 'hybrid' ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                    <span className="block text-sm mb-0.5">📋+🏋️</span>
                    Hybrid
                  </button>
                </div>

                {/* ============ PROGRAMMING ONLY ============ */}
                {newPlanBillingMode === 'programming_only' && (
                  <div className="space-y-3">
                    <p className="text-gray-500 text-xs">Client pays a flat fee for training programming (plans, workouts, adjustments).</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-500 text-xs block mb-1">Start Date <span className="text-accent">*</span></label>
                        <input type="date" value={newPlanStart} onChange={(e) => setNewPlanStart(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs block mb-1">End Date <span className="text-accent">*</span></label>
                        <input type="date" value={newPlanEnd} onChange={(e) => setNewPlanEnd(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs block mb-1">Plan Cost ($) <span className="text-gray-600">(optional)</span></label>
                      <input type="number" value={newPlanProgrammingCost} onChange={(e) => setNewPlanProgrammingCost(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="0" />
                    </div>
                  </div>
                )}

                {/* ============ PER SESSION ============ */}
                {newPlanBillingMode === 'per_session' && (
                  <div className="space-y-3">
                    <p className="text-gray-500 text-xs">Client pays per in-person session. Enter the number of sessions and cost per session.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-500 text-xs block mb-1">Total Sessions <span className="text-accent">*</span></label>
                        <input type="number" value={newPlanSessionCount} onChange={(e) => setNewPlanSessionCount(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="10" min="1" />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs block mb-1">Per Session Cost ($) <span className="text-accent">*</span></label>
                        <input type="number" value={newPlanPerSessionCost} onChange={(e) => setNewPlanPerSessionCost(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="75" />
                      </div>
                    </div>
                    {/* Calculated total */}
                    {newPlanSessionCount && newPlanPerSessionCost && (
                      <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 flex items-center justify-between">
                        <span className="text-gray-400 text-xs">Total ({newPlanSessionCount} × ${newPlanPerSessionCost})</span>
                        <span className="text-accent text-sm font-bold">${(parseInt(newPlanSessionCount) * parseFloat(newPlanPerSessionCost)).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ============ HYBRID ============ */}
                {newPlanBillingMode === 'hybrid' && (
                  <div className="space-y-4">
                    <p className="text-gray-500 text-xs">Client pays for both programming AND in-person sessions separately.</p>
                    
                    {/* Programming section */}
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 space-y-3">
                      <p className="text-purple-400 text-xs font-medium">Programming</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Start Date <span className="text-accent">*</span></label>
                          <input type="date" value={newPlanStart} onChange={(e) => setNewPlanStart(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">End Date <span className="text-accent">*</span></label>
                          <input type="date" value={newPlanEnd} onChange={(e) => setNewPlanEnd(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
                        </div>
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs block mb-1">Programming Cost ($)</label>
                        <input type="number" value={newPlanProgrammingCost} onChange={(e) => setNewPlanProgrammingCost(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="0" />
                      </div>
                    </div>

                    {/* Sessions section */}
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-3">
                      <p className="text-blue-400 text-xs font-medium">In-Person Sessions</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Total Sessions <span className="text-accent">*</span></label>
                          <input type="number" value={newPlanSessionCount} onChange={(e) => setNewPlanSessionCount(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="10" min="1" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Per Session Cost ($) <span className="text-accent">*</span></label>
                          <input type="number" value={newPlanPerSessionCost} onChange={(e) => setNewPlanPerSessionCost(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="75" />
                        </div>
                      </div>
                      {/* Session total */}
                      {newPlanSessionCount && newPlanPerSessionCost && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Sessions Total ({newPlanSessionCount} × ${newPlanPerSessionCost})</span>
                          <span className="text-blue-400 font-bold">${(parseInt(newPlanSessionCount) * parseFloat(newPlanPerSessionCost)).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Grand total */}
                    {(newPlanProgrammingCost || (newPlanSessionCount && newPlanPerSessionCost)) && (
                      <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300 text-xs font-medium">Total Cost</span>
                          <span className="text-accent text-sm font-bold">
                            ${((parseFloat(newPlanProgrammingCost) || 0) + ((parseInt(newPlanSessionCount) || 0) * (parseFloat(newPlanPerSessionCost) || 0))).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-500 text-xs">Programming: ${parseFloat(newPlanProgrammingCost) || 0} + Sessions: ${((parseInt(newPlanSessionCount) || 0) * (parseFloat(newPlanPerSessionCost) || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Optional secondary fields */}
            <div className="mb-4">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Injuries / Important Notes <span className="text-gray-600 text-xs">(optional)</span></label>
                <input type="text" value={newPlanInjuryNotes} onChange={(e) => setNewPlanInjuryNotes(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. History of shin splints, weak left knee" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleCreatePlan} disabled={creatingPlan || !newPlanGoal || (newPlanBillingMode === 'programming_only' && (!newPlanStart || !newPlanEnd)) || (newPlanBillingMode === 'per_session' && (!newPlanSessionCount || parseInt(newPlanSessionCount) <= 0 || !newPlanPerSessionCost)) || (newPlanBillingMode === 'hybrid' && (!newPlanStart || !newPlanEnd || !newPlanSessionCount || parseInt(newPlanSessionCount) <= 0 || !newPlanPerSessionCost))} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">
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
          <PlanCard key={plan.id} plan={plan} onUpdate={handleUpdatePlan} dateFormat={dateFormat} programTemplates={programTemplates} />
        ))}
        {/* Completed Plans - collapsible */}
        {plans.filter(p => p.status !== "active").length > 0 && (
          <details className="mt-4">
            <summary className="text-gray-500 text-xs cursor-pointer hover:text-white">
              Show completed plans ({plans.filter(p => p.status !== "active").length})
            </summary>
            <div className="mt-3 space-y-3">
              {plans.filter(p => p.status !== "active").map((plan) => (
                <PlanCard key={plan.id} plan={plan} onUpdate={handleUpdatePlan} dateFormat={dateFormat} programTemplates={programTemplates} />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Account Actions */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Account Actions</h4>
        <div className="flex flex-wrap gap-3">
          {clientData.status === "active" ? (
            <>
              <button onClick={() => setShowDeleteConfirm(true)} className="border border-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm">Archive Client</button>
              {showDeleteConfirm && (
                <div className="w-full bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 mt-2">
                  <p className="text-yellow-400 text-sm font-medium mb-2">Archive this client?</p>
                  <p className="text-gray-300 text-xs mb-1">This will:</p>
                  <ul className="text-gray-400 text-xs mb-3 list-disc list-inside space-y-0.5">
                    <li>Block them from logging in (they won&apos;t be able to access their dashboard)</li>
                    <li>Disconnect their Strava connection</li>
                    <li>Move them to the Archived tab in your client list</li>
                    <li>Keep all their training data (nothing is deleted)</li>
                  </ul>
                  <p className="text-gray-400 text-xs mb-3">You can reactivate them at any time from the Archived tab to restore access.</p>
                  <div className="flex gap-3">
                    <button onClick={onArchive} className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-bold py-2 px-4 rounded-lg text-xs">Yes, Archive Client</button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 text-xs hover:text-white">Cancel</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-gray-500 text-xs mb-2 w-full">This client is archived. They cannot log in or access their dashboard. Reactivating will restore their access (they&apos;ll need to reconnect Strava if needed).</p>
              <button onClick={onArchive} className="border border-green-500/30 text-green-400 py-2 px-4 rounded-lg text-sm">Reactivate Client</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-component for individual plan card with payment logging
function PlanCard({ plan, onUpdate, dateFormat, programTemplates }: { plan: Plan; onUpdate: (planId: string, updates: any) => void; dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY"; programTemplates?: { id: string; name: string; category: string; data: { totalWeeks: number } }[] }) {
  // Payment form — 'which' tracks which card's form is open (null = closed)
  const [openPaymentForm, setOpenPaymentForm] = useState<null | 'programming' | 'session'>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentHistory, setPaymentHistory] = useState<{id: string; amount: number; date: string; type?: string}[]>([]);
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

  // Session balance state (for per_session and hybrid plans)
  const [sessionBalance, setSessionBalance] = useState<{ used: number; total: number; totalPaid: number; totalOwed: number } | null>(null);
  const [sessionBalanceLoaded, setSessionBalanceLoaded] = useState(false);
  const [sessionBalanceRefresh, setSessionBalanceRefresh] = useState(0);

  const handleSavePlanEdit = async () => {
    setSavingPlanEdit(true);
    try {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, goal: editGoal, startDate: editStartDate, endDate: editEndDate, owed: (editOwed && editOwed !== "__expand__") ? editOwed : "0", targetDistance: editTargetDistance || null, raceDate: editRaceDate || null, goalPace: editGoalPace || null, injuryNotes: editInjuryNotes || null, programTemplateId: (editProgramId && editProgramId !== "__expand__") ? editProgramId : null }),
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
        // For session/hybrid plans, fetch ALL payments (programming + session) by client.
        // For programming-only, fetch by plan.
        const hasSessions = plan.billingMode === 'per_session' || plan.billingMode === 'hybrid';
        const url = hasSessions
          ? `/api/payments?client_id=${plan.clientId}`
          : `/api/payments?plan_id=${plan.id}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPaymentHistory(data.map((p: any) => ({
            id: p.id,
            amount: parseFloat(p.amount),
            date: p.payment_date,
            type: p.payment_type || 'programming',
          })));
        }
      } catch (err) {
        console.error("Failed to fetch payments:", err);
      } finally {
        setLoadingPayments(false);
      }
    };
    fetchPayments();
  }, [plan.id, plan.clientId, plan.billingMode]);

  // Fetch session balance for per_session and hybrid plans
  useEffect(() => {
    if (plan.billingMode !== 'per_session' && plan.billingMode !== 'hybrid') return;
    const fetchSessionBalance = async () => {
      try {
        const res = await fetch(`/api/session-packages?client_id=${plan.clientId}`);
        if (res.ok) {
          const data = await res.json();
          const totalPurchased = (data.packages || []).reduce((sum: number, p: any) => sum + (p.sessions_purchased || 0), 0);
          const totalPaid = (data.packages || []).reduce((sum: number, p: any) => sum + (parseFloat(p.amount_paid) || 0), 0);
          const totalOwed = (data.packages || []).reduce((sum: number, p: any) => sum + (parseFloat(p.amount_owed ?? p.amount_paid) || 0), 0);
          const remaining = data.sessionsRemaining ?? 0;
          setSessionBalance({ used: totalPurchased - remaining, total: totalPurchased, totalPaid, totalOwed });
        } else {
          setSessionBalance({ used: 0, total: 0, totalPaid: 0, totalOwed: 0 });
        }
      } catch (err) {
        console.error("Failed to fetch session balance:", err);
        setSessionBalance({ used: 0, total: 0, totalPaid: 0, totalOwed: 0 });
      } finally {
        setSessionBalanceLoaded(true);
      }
    };
    fetchSessionBalance();
  }, [plan.id, plan.clientId, plan.billingMode, sessionBalanceRefresh]);

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

  const handleLogPayment = async (type: 'programming' | 'session') => {
    if (!paymentAmount) return;
    setLoggingPayment(true);
    try {
      const isSession = type === 'session';
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: type,
          planId: isSession ? null : plan.id,
          clientId: plan.clientId,
          amount: paymentAmount,
          paymentDate: paymentDate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const amount = parseFloat(paymentAmount);
        setPaymentHistory(prev => [{ id: data.payment.id, amount, date: paymentDate, type }, ...prev]);
        if (isSession) {
          setSessionBalanceRefresh(x => x + 1);
        } else {
          onUpdate(plan.id, { paid: data.newPaidTotal.toString() });
        }
        setPaymentAmount("");
        setPaymentDate(new Date().toISOString().split("T")[0]);
        setOpenPaymentForm(null);
      }
    } catch (err) {
      console.error("Failed to log payment:", err);
    } finally {
      setLoggingPayment(false);
    }
  };

  // Reusable inline payment form for a given type
  const renderPaymentForm = (type: 'programming' | 'session', accentClass: string) => (
    <div className="bg-secondary/50 border border-white/10 rounded-lg p-3 mt-2">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-gray-500 text-xs block mb-1">Amount ($)</label>
          <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent" placeholder="0" autoFocus />
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">Date</label>
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleLogPayment(type)} disabled={!paymentAmount || loggingPayment} className={`${accentClass} text-white font-bold py-1.5 px-4 rounded text-xs disabled:opacity-50`}>{loggingPayment ? "Saving..." : "Log Payment"}</button>
        <button onClick={() => { setOpenPaymentForm(null); setPaymentAmount(""); }} className="text-gray-400 text-xs">Cancel</button>
      </div>
    </div>
  );

  // Filtered payment histories
  const programmingPayments = paymentHistory.filter(p => (p.type || 'programming') === 'programming');
  const sessionPayments = paymentHistory.filter(p => p.type === 'session');

  const renderPaymentHistory = (payments: typeof paymentHistory) => (
    payments.length > 0 ? (
      <div className="mt-2 space-y-1">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{formatDate(p.date)}</span>
            <span className="text-green-400 font-medium">+${p.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    ) : null
  );

  const handleCompletePlan = async () => {
    // If outstanding balance, require reason
    if (hasOutstandingBalance && !completionReason.trim()) return;
    setCompleting(true);
    try {
      const updates = hasOutstandingBalance 
        ? { status: "completed", completionReason: completionReason.trim() }
        : { status: "completed" };
      await onUpdate(plan.id, updates);

      // For session/hybrid plans, clean up the recurring schedule + future sessions
      if (plan.billingMode === 'per_session' || plan.billingMode === 'hybrid') {
        try {
          // Delete active recurring schedules (and their future sessions)
          const schedRes = await fetch(`/api/recurring-schedules?client_id=${plan.clientId}`);
          if (schedRes.ok) {
            const schedules = await schedRes.json();
            for (const s of schedules) {
              await fetch(`/api/recurring-schedules?id=${s.id}&clear_future=true`, { method: 'DELETE' });
            }
          }
        } catch (schedErr) {
          console.error("Failed to clean up recurring schedules on plan completion:", schedErr);
        }
      }

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

          {/* Goal — always shown */}
          <div className="mb-4">
            <label className="text-gray-500 text-xs block mb-1">Goal <span className="text-accent">*</span></label>
            <input type="text" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Marathon prep, Strength building, Rehab" />
          </div>

          {/* Dates + Cost — only for programming_only and hybrid */}
          {(!plan.billingMode || plan.billingMode === 'programming_only' || plan.billingMode === 'hybrid') && (
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Start Date <span className="text-accent">*</span></label>
                <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">End Date <span className="text-accent">*</span></label>
                <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">{plan.billingMode === 'hybrid' ? 'Programming Cost ($)' : 'Plan Cost ($)'} <span className="text-gray-600">(optional)</span></label>
                <input type="number" value={editOwed === "__expand__" ? "" : editOwed} onChange={(e) => setEditOwed(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="0" />
              </div>
            </div>
          )}

          {/* Billing mode indicator for per_session */}
          {plan.billingMode === 'per_session' && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-4">
              <p className="text-blue-400 text-xs font-medium">🏋️ Per Session billing — manage session packages from the plan card below.</p>
            </div>
          )}

          {/* Billing mode indicator for hybrid */}
          {plan.billingMode === 'hybrid' && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 mb-4">
              <p className="text-purple-400 text-xs font-medium">📋+🏋️ Hybrid billing — programming cost is editable above. Session packages are managed from the plan card below.</p>
            </div>
          )}

          {/* Training Program (expandable) */}
          {programTemplates && programTemplates.length > 0 && (
            <div className="border border-white/5 rounded-lg mb-3 overflow-hidden">
              <button type="button" onClick={() => { if (!editProgramId) setEditProgramId("__expand__"); else setEditProgramId(""); }} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2">
                  <svg className={`w-3 h-3 text-gray-400 transition-transform ${editProgramId ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <span className="text-gray-300 text-sm font-medium">Training Program</span>
                  {editProgramId && editProgramId !== "__expand__" && <span className="text-accent text-xs">✓ Set</span>}
                </div>
                <span className="text-gray-500 text-xs">Optional</span>
              </button>
              {editProgramId && (
                <div className="px-4 pb-3 space-y-3 border-t border-white/5 pt-3">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Training Program</label>
                    <select value={editProgramId === "__expand__" ? "" : editProgramId} onChange={(e) => setEditProgramId(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
                      <option value="">No Program</option>
                      {programTemplates.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ''} — {p.data.totalWeeks} weeks</option>
                      ))}
                    </select>
                  </div>
                  {editProgramId && editProgramId !== "__expand__" && (
                    <>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Target Distance</label>
                          <select value={editTargetDistance} onChange={(e) => setEditTargetDistance(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="">Select...</option><option value="5K">5K</option><option value="10K">10K</option><option value="Half Marathon">Half Marathon</option><option value="Marathon">Marathon</option><option value="Ultra">Ultra</option><option value="No Race">No Race / General Fitness</option></select>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Race Date</label>
                          <input type="date" value={editRaceDate} onChange={(e) => setEditRaceDate(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent [color-scheme:dark]" />
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs">Race Date is used to calculate which program week to auto-load when creating training weeks.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Optional secondary fields */}
          <div className="mb-4">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Injuries / Important Notes <span className="text-gray-600 text-xs">(optional)</span></label>
              <input type="text" value={editInjuryNotes} onChange={(e) => setEditInjuryNotes(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. History of shin splints" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSavePlanEdit} disabled={savingPlanEdit} className="bg-accent hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg text-xs disabled:opacity-50">{savingPlanEdit ? "Saving..." : "Save Changes"}</button>
            <button onClick={() => { setEditingPlan(false); setEditGoal(plan.goal); setEditStartDate(plan.startDate); setEditEndDate(plan.endDate); setEditOwed(plan.owed.toString()); setEditTargetDistance(plan.targetDistance || ""); setEditRaceDate(plan.raceDate || ""); setEditGoalPace(plan.goalPace || ""); setEditInjuryNotes(plan.injuryNotes || ""); setEditProgramId((plan as any).programTemplateId || ""); setEditRaceDateSameAsEnd((plan as any).raceDateSameAsEnd !== false); }} className="text-gray-400 text-xs hover:text-white">Cancel</button>
          </div>
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

      {/* ============ FINANCIAL CARDS ============ */}
      {/* Billing mode badge */}
      <div className="flex items-center gap-2 mb-3">
        {(!plan.billingMode || plan.billingMode === 'programming_only') && (
          <span className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5 text-xs text-purple-400">📋 Programming Only</span>
        )}
        {plan.billingMode === 'per_session' && (
          <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5 text-xs text-blue-400">🏋️ Per Session</span>
        )}
        {plan.billingMode === 'hybrid' && (
          <span className="inline-flex items-center gap-1 bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5 text-xs text-accent">📋+🏋️ Hybrid</span>
        )}
      </div>

      {/* Card layout: programming card and/or sessions card, side by side for hybrid */}
      <div className={`grid gap-3 ${plan.billingMode === 'hybrid' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>

        {/* ---- PROGRAMMING CARD (programming_only + hybrid) ---- */}
        {(!plan.billingMode || plan.billingMode === 'programming_only' || plan.billingMode === 'hybrid') && (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-purple-400 text-xs font-heading uppercase">📋 Programming</p>
              {plan.status === 'active' && openPaymentForm !== 'programming' && (
                <button onClick={() => { setOpenPaymentForm('programming'); setPaymentAmount(""); setPaymentDate(new Date().toISOString().split("T")[0]); }} className="text-purple-400 text-xs hover:underline">+ Log Payment</button>
              )}
            </div>
            {plan.owed > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-gray-500 text-[11px]">Cost</p><p className="text-white text-sm font-medium">${plan.owed.toFixed(2)}</p></div>
                  <div><p className="text-gray-500 text-[11px]">Paid</p><p className="text-white text-sm font-medium">${plan.paid.toFixed(2)}</p></div>
                  <div><p className="text-gray-500 text-[11px]">Balance</p><p className={`text-sm font-bold ${(plan.owed - plan.paid) > 0 ? "text-red-400" : "text-green-400"}`}>{(plan.owed - plan.paid) > 0 ? `$${(plan.owed - plan.paid).toFixed(2)}` : "Paid ✓"}</p></div>
                </div>
                <div className="w-full bg-primary/50 rounded-full h-1.5 mt-2">
                  <div className={`h-1.5 rounded-full ${(plan.owed - plan.paid) > 0 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, (plan.paid / plan.owed) * 100)}%` }} />
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-xs">No programming cost set.</p>
            )}
            {/* Programming payment form */}
            {openPaymentForm === 'programming' && renderPaymentForm('programming', 'bg-purple-600 hover:bg-purple-700')}
            {/* Programming payment history */}
            {!loadingPayments && programmingPayments.length > 0 && (
              <details className="mt-2">
                <summary className="text-gray-500 text-xs cursor-pointer hover:text-white">Payment history ({programmingPayments.length})</summary>
                {renderPaymentHistory(programmingPayments)}
              </details>
            )}
          </div>
        )}

        {/* ---- SESSIONS CARD (per_session + hybrid) ---- */}
        {(plan.billingMode === 'per_session' || plan.billingMode === 'hybrid') && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-400 text-xs font-heading uppercase">🏋️ In-Person Sessions</p>
              {plan.status === 'active' && openPaymentForm !== 'session' && (
                <button onClick={() => { setOpenPaymentForm('session'); setPaymentAmount(""); setPaymentDate(new Date().toISOString().split("T")[0]); }} className="text-blue-400 text-xs hover:underline">+ Log Payment</button>
              )}
            </div>
            {sessionBalance && sessionBalance.total > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-gray-500 text-[11px]">Sessions</p><p className="text-white text-sm font-medium">{sessionBalance.used}/{sessionBalance.total}</p></div>
                  <div><p className="text-gray-500 text-[11px]">Paid</p><p className="text-white text-sm font-medium">${sessionBalance.totalPaid.toFixed(0)}/${sessionBalance.totalOwed.toFixed(0)}</p></div>
                  <div><p className="text-gray-500 text-[11px]">Balance</p><p className={`text-sm font-bold ${(sessionBalance.totalOwed - sessionBalance.totalPaid) > 0 ? "text-red-400" : "text-green-400"}`}>{(sessionBalance.totalOwed - sessionBalance.totalPaid) > 0 ? `$${(sessionBalance.totalOwed - sessionBalance.totalPaid).toFixed(2)}` : "Paid ✓"}</p></div>
                </div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className={`text-xs font-medium ${(sessionBalance.total - sessionBalance.used) <= 3 ? "text-red-400" : "text-green-400"}`}>{sessionBalance.total - sessionBalance.used} sessions remaining</span>
                </div>
              </>
            ) : sessionBalanceLoaded ? (
              <p className="text-gray-400 text-xs">No session packages yet. Add one below.</p>
            ) : (
              <p className="text-gray-400 text-xs">Loading session data...</p>
            )}
            {/* Session payment form */}
            {openPaymentForm === 'session' && renderPaymentForm('session', 'bg-blue-600 hover:bg-blue-700')}
            {/* Session payment history */}
            {!loadingPayments && sessionPayments.length > 0 && (
              <details className="mt-2">
                <summary className="text-gray-500 text-xs cursor-pointer hover:text-white">Payment history ({sessionPayments.length})</summary>
                {renderPaymentHistory(sessionPayments)}
              </details>
            )}
          </div>
        )}
      </div>

      {/* Target Distance & Race Date — only show if values are set */}
      {plan.status === "active" && (
        <div className="grid md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-white/5">
          {(plan as any).programTemplateId && programTemplates && <div><p className="text-gray-500 text-xs">Training Program</p><p className="text-accent text-sm font-medium">{programTemplates.find(p => p.id === (plan as any).programTemplateId)?.name || "Assigned"}</p></div>}
          {plan.targetDistance && <div><p className="text-gray-500 text-xs">Target Distance</p><p className="text-white text-sm">{plan.targetDistance}</p></div>}
          {plan.raceDate && <div><p className="text-gray-500 text-xs">Race Date</p><p className="text-white text-sm">{formatDate(plan.raceDate)}</p></div>}
          {plan.goalPace && <div><p className="text-gray-500 text-xs">Goal Race Pace</p><p className="text-white text-sm">{plan.goalPace}</p></div>}
          {plan.injuryNotes && <div><p className="text-gray-500 text-xs">Injuries / Notes</p><p className="text-white text-sm">{plan.injuryNotes}</p></div>}
        </div>
      )}
      {plan.status !== "active" && ((plan as any).programTemplateId || plan.targetDistance || plan.raceDate || plan.goalPace || plan.injuryNotes) && (
        <div className="grid md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5">
          {(plan as any).programTemplateId && programTemplates && <div><p className="text-gray-500 text-xs">Training Program</p><p className="text-accent text-sm">{programTemplates.find(p => p.id === (plan as any).programTemplateId)?.name || "Assigned"}</p></div>}
          {plan.targetDistance && <div><p className="text-gray-500 text-xs">Target Distance</p><p className="text-white text-sm">{plan.targetDistance}</p></div>}
          {plan.raceDate && <div><p className="text-gray-500 text-xs">Race Date</p><p className="text-white text-sm">{formatDate(plan.raceDate)}</p></div>}
          {plan.goalPace && <div><p className="text-gray-500 text-xs">Goal Race Pace</p><p className="text-white text-sm">{plan.goalPace}</p></div>}
          {plan.injuryNotes && <div className="col-span-2"><p className="text-gray-500 text-xs">Injuries / Notes</p><p className="text-white text-sm">{plan.injuryNotes}</p></div>}
        </div>
      )}
      {/* Progress bar — only for plans with a cost set */}
      {plan.owed > 0 && (!plan.billingMode || plan.billingMode === 'programming_only' || plan.billingMode === 'hybrid') && (
        <div className="w-full bg-primary/50 rounded-full h-1.5 mt-3">
          <div className={`h-1.5 rounded-full ${(plan.owed - plan.paid) > 0 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${plan.owed > 0 ? Math.min(100, (plan.paid / plan.owed) * 100) : 100}%` }} />
        </div>
      )}

      {/* Completion info (shown on completed plans) */}
      {plan.status === "completed" && plan.billingMode !== 'per_session' && (plan.owed - plan.paid) > 0 && (
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

      {/* Loading payments indicator */}
      {loadingPayments && (
        <p className="text-gray-500 text-xs mt-2">Loading payments...</p>
      )}

      {/* Add Session Package — for plans with per_session or hybrid billing */}
      {(plan.billingMode === 'per_session' || plan.billingMode === 'hybrid') && (
        <AddSessionPackage clientId={plan.clientId} planId={plan.id} readOnly={plan.status !== 'active'} onBalanceChange={() => setSessionBalanceRefresh(x => x + 1)} />
      )}
    </div>
  );
}

// Sub-component for adding session packages (top-ups)
function AddSessionPackage({ clientId, planId, readOnly, onBalanceChange }: { clientId: string; planId: string; readOnly?: boolean; onBalanceChange?: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [sessionCount, setSessionCount] = useState("");
  const [amountOwed, setAmountOwed] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<{ id: string; sessions_purchased: number; amount_paid: number; amount_owed?: number; purchased_at: string; notes?: string }[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null);

  // Fetch existing packages and balance
  const fetchPackages = async () => {
    try {
      const res = await fetch(`/api/session-packages?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages || []);
        setSessionsRemaining(data.sessionsRemaining ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch session packages:", err);
    } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [clientId]);

  const handleAddPackage = async () => {
    if (!sessionCount || parseInt(sessionCount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/session-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          sessionsPurchased: parseInt(sessionCount),
          amountOwed: amountOwed || "0",
          amountPaid: amountPaid || "0",
          notes: notes || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPackages(prev => [data.package, ...prev]);
        setSessionsRemaining(prev => (prev ?? 0) + parseInt(sessionCount));
        setSessionCount("");
        setAmountOwed("");
        setAmountPaid("");
        setNotes("");
        setShowForm(false);
        onBalanceChange?.(); // Refresh the parent's session balance card
      }
    } catch (err) {
      console.error("Failed to add session package:", err);
    } finally {
      setSaving(false);
    }
  };

  // Calculate totals
  const totalOwed = packages.reduce((sum, p) => sum + (p.amount_owed ?? p.amount_paid ?? 0), 0);
  const totalPaid = packages.reduce((sum, p) => sum + (p.amount_paid ?? 0), 0);
  const totalDue = totalOwed - totalPaid;

  return (
    <div className="mt-3">
      {/* Add package header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-xs font-heading uppercase">Session Packages</span>
        {!readOnly && !showForm && (
          <button onClick={() => setShowForm(true)} className="text-blue-400 text-xs hover:underline">+ Add Package</button>
        )}
      </div>

      {/* Add package form */}
      {!readOnly && showForm && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-2">
          <p className="text-blue-400 text-xs font-medium mb-2">Add Session Package</p>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Sessions <span className="text-accent">*</span></label>
              <input type="number" value={sessionCount} onChange={(e) => setSessionCount(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent" placeholder="10" min="1" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Total Cost ($)</label>
              <input type="number" value={amountOwed} onChange={(e) => setAmountOwed(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent" placeholder="750" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Paid Now ($)</label>
              <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent" placeholder="0" />
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-2">Enter the total cost owed and how much has been paid so far. You can log more payments later.</p>
          <div className="mb-2">
            <label className="text-gray-500 text-xs block mb-1">Notes <span className="text-gray-600">(optional)</span></label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Monthly package renewal" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddPackage} disabled={!sessionCount || parseInt(sessionCount) <= 0 || saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded text-xs disabled:opacity-50">{saving ? "Adding..." : "Add Package"}</button>
            <button onClick={() => { setShowForm(false); setSessionCount(""); setAmountOwed(""); setAmountPaid(""); setNotes(""); }} className="text-gray-400 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Package history (payments are logged in the main Log Payment area above) */}
      {!loadingPackages && packages.length > 0 && (
        <details className="mt-2">
          <summary className="text-gray-500 text-xs cursor-pointer hover:text-white">Package history ({packages.length})</summary>
          <div className="mt-2 space-y-2">
            {packages.map((pkg) => {
              const owed = pkg.amount_owed ?? pkg.amount_paid ?? 0;
              const paid = pkg.amount_paid ?? 0;
              const due = owed - paid;
              return (
                <div key={pkg.id} className="bg-primary/20 border border-white/5 rounded-lg p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{new Date(pkg.purchased_at).toLocaleDateString()}{pkg.notes ? ` — ${pkg.notes}` : ''}</span>
                    <span className="text-blue-400 font-medium">{pkg.sessions_purchased} sessions</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-gray-500">${paid.toFixed(2)} / ${owed.toFixed(2)} paid</span>
                    {due > 0 ? (
                      <span className="text-red-400">${due.toFixed(2)} due</span>
                    ) : (
                      <span className="text-green-400">Paid ✓</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
