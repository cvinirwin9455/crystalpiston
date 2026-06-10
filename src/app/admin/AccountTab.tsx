"use client";

import { useState, useEffect } from "react";

type Plan = {
  id: string;
  clientId: string;
  startDate: string;
  endDate: string;
  owed: number;
  paid: number;
  status: string;
};

type ClientData = {
  id: string;
  clientId: string | null;
  name: string;
  email: string;
  gender: string;
  goal: string;
  status: string;
};

export default function AccountTab({ clientData, onSave, onArchive }: { clientData: ClientData; onSave: () => void; onArchive: () => void }) {
  const [name, setName] = useState(clientData.name);
  const [email, setEmail] = useState(clientData.email);
  const [gender, setGender] = useState(clientData.gender);
  const [goal, setGoal] = useState(clientData.goal);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanStart, setNewPlanStart] = useState("");
  const [newPlanEnd, setNewPlanEnd] = useState("");
  const [newPlanOwed, setNewPlanOwed] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when client changes
  useEffect(() => {
    setName(clientData.name);
    setEmail(clientData.email);
    setGender(clientData.gender);
    setGoal(clientData.goal);
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
            owed: parseFloat(p.owed) || 0,
            paid: parseFloat(p.paid) || 0,
            status: p.status,
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
        body: JSON.stringify({ name, email, gender, goal }),
      });
      if (res.ok) {
        setSaveSuccess(true);
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
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlans(prev => [{
          id: data.plan.id,
          clientId: data.plan.client_id,
          startDate: data.plan.start_date,
          endDate: data.plan.end_date,
          owed: parseFloat(data.plan.owed) || 0,
          paid: parseFloat(data.plan.paid) || 0,
          status: data.plan.status,
        }, ...prev]);
        setShowNewPlan(false);
        setNewPlanStart("");
        setNewPlanEnd("");
        setNewPlanOwed("");
      }
    } catch (err) {
      console.error("Failed to create plan:", err);
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleUpdatePlan = async (planId: string, updates: { paid?: string; status?: string }) => {
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
            };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error("Failed to update plan:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Client Details */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <h4 className="text-gray-400 text-xs font-heading uppercase mb-4">Client Details</h4>
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-gray-500 text-xs block mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent">
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Goal</label>
            <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveDetails} disabled={saving} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">
            {saving ? "Saving..." : "Save Details"}
          </button>
          {saveSuccess && <span className="text-green-400 text-xs">Saved!</span>}
        </div>
      </div>

      {/* Plans & Payments */}
      <div className="bg-primary/30 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-gray-400 text-xs font-heading uppercase">Plans & Payments</h4>
          <button onClick={() => setShowNewPlan(!showNewPlan)} className="text-accent text-xs hover:underline">+ New Plan</button>
        </div>

        {/* New Plan Form */}
        {showNewPlan && (
          <div className="bg-secondary/50 border border-accent/20 rounded-lg p-4 mb-4">
            <p className="text-accent text-xs font-heading uppercase mb-3">Create New Plan</p>
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
            <div className="flex gap-3">
              <button onClick={handleCreatePlan} disabled={creatingPlan || !newPlanStart || !newPlanEnd} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">
                {creatingPlan ? "Creating..." : "Create Plan"}
              </button>
              <button onClick={() => setShowNewPlan(false)} className="text-gray-400 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Plans List */}
        {loadingPlans && <p className="text-gray-500 text-sm">Loading plans...</p>}
        {!loadingPlans && plans.length === 0 && <p className="text-gray-500 text-sm">No plans yet. Create one above.</p>}
        {plans.map((plan) => (
          <div key={plan.id} className={`border rounded-lg p-4 mb-3 ${plan.status === "active" ? "border-accent/20" : "border-white/5 opacity-70"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">{formatDate(plan.startDate)} — {formatDate(plan.endDate)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${plan.status === "active" ? "bg-green-500/20 text-green-400" : plan.status === "completed" ? "bg-blue-500/20 text-blue-400" : "bg-gray-500/20 text-gray-400"}`}>
                  {plan.status}
                </span>
              </div>
              {plan.status === "active" && (
                <button onClick={() => handleUpdatePlan(plan.id, { status: "completed" })} className="text-gray-500 text-xs hover:text-white">Mark Complete</button>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-xs">Plan Cost</p>
                <p className="text-white font-medium">${plan.owed.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Paid</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={plan.paid}
                    onBlur={(e) => handleUpdatePlan(plan.id, { paid: e.target.value })}
                    className="w-24 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Balance</p>
                <p className={`font-bold ${(plan.owed - plan.paid) > 0 ? "text-red-400" : "text-green-400"}`}>
                  {(plan.owed - plan.paid) > 0 ? `$${(plan.owed - plan.paid).toFixed(2)} due` : "Paid in full"}
                </p>
              </div>
            </div>
            <div className="w-full bg-primary/50 rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full ${(plan.owed - plan.paid) > 0 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${plan.owed > 0 ? Math.min(100, (plan.paid / plan.owed) * 100) : 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="bg-primary/30 border border-red-500/20 rounded-xl p-5">
        <h4 className="text-red-400 text-xs font-heading uppercase mb-4">Account Actions</h4>
        <p className="text-gray-500 text-xs mb-3">Archiving hides the client but keeps their data.</p>
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
