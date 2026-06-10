"use client";

import { useState, useEffect } from "react";

type Plan = {
  id: string;
  clientId: string;
  startDate: string;
  endDate: string;
  goal: string;
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

export default function AccountTab({ clientData, onSave, onArchive, onDelete }: { clientData: ClientData; onSave: () => void; onArchive: () => void; onDelete: () => void }) {
  const [name, setName] = useState(clientData.name);
  const [email, setEmail] = useState(clientData.email);
  const [gender, setGender] = useState(clientData.gender);
  const [goal, setGoal] = useState(clientData.goal);
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
            goal: p.goal || '',
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
      // Auto-complete any existing active plan
      const activePlan = plans.find(p => p.status === "active");
      if (activePlan) {
        await fetch("/api/plans", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: activePlan.id, status: "completed" }),
        });
      }

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientData.clientId,
          startDate: newPlanStart,
          endDate: newPlanEnd,
          owed: newPlanOwed,
          goal: newPlanGoal,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state: mark old active as completed, add new one
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
          },
          ...prev.map(p => p.status === "active" ? { ...p, status: "completed" } : p),
        ]);
        setShowNewPlan(false);
        setNewPlanStart("");
        setNewPlanEnd("");
        setNewPlanOwed("");
        setNewPlanGoal("");
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
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-gray-400 text-xs font-heading uppercase">Client Details</h4>
          {!editing && <button onClick={() => setEditing(true)} className="text-accent text-xs hover:underline">Edit</button>}
        </div>

        {!editing ? (
          /* View Mode */
          <div className="grid md:grid-cols-3 gap-4">
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
          </div>
        ) : (
          /* Edit Mode */
          <>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
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
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveDetails} disabled={saving} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => { setEditing(false); setName(clientData.name); setEmail(clientData.email); setGender(clientData.gender); setGoal(clientData.goal); }} className="text-gray-400 text-sm hover:text-white">Cancel</button>
              {saveSuccess && <span className="text-green-400 text-xs">Saved!</span>}
            </div>
          </>
        )}
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
            {plans.some(p => p.status === "active") && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                <p className="text-yellow-400 text-xs">The current active plan will be marked as completed when you create a new one.</p>
              </div>
            )}
            <div className="grid md:grid-cols-4 gap-4 mb-3">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Goal</label>
                <input type="text" value={newPlanGoal} onChange={(e) => setNewPlanGoal(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. War Eagle 50K" />
              </div>
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
        {/* Active Plan */}
        {plans.filter(p => p.status === "active").map((plan) => (
          <PlanCard key={plan.id} plan={plan} onUpdate={handleUpdatePlan} />
        ))}
        {/* Completed Plans - collapsible */}
        {plans.filter(p => p.status !== "active").length > 0 && (
          <details className="mt-4">
            <summary className="text-gray-500 text-xs cursor-pointer hover:text-white">
              Show completed plans ({plans.filter(p => p.status !== "active").length})
            </summary>
            <div className="mt-3 space-y-3">
              {plans.filter(p => p.status !== "active").map((plan) => (
                <PlanCard key={plan.id} plan={plan} onUpdate={handleUpdatePlan} />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-primary/30 border border-red-500/20 rounded-xl p-5">
        <h4 className="text-red-400 text-xs font-heading uppercase mb-4">Account Actions</h4>
        <p className="text-gray-500 text-xs mb-3">Archiving hides the client but keeps their data. They can no longer log in.</p>
        <div className="flex flex-wrap gap-3">
          {clientData.status === "active" ? (
            <button onClick={onArchive} className="border border-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm">Archive Client</button>
          ) : (
            <button onClick={onArchive} className="border border-green-500/30 text-green-400 py-2 px-4 rounded-lg text-sm">Reactivate Client</button>
          )}
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="border border-red-500/30 text-red-400 py-2 px-4 rounded-lg text-sm">Delete Client Permanently</button>
          ) : (
            <div className="w-full mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm font-bold mb-2">Are you absolutely sure?</p>
              <p className="text-gray-400 text-xs mb-1">This will permanently delete:</p>
              <ul className="text-gray-400 text-xs mb-3 list-disc list-inside">
                <li>All training plans and workout data</li>
                <li>All messages between you and this client</li>
                <li>All payment history</li>
                <li>The client&apos;s account and login access</li>
              </ul>
              <p className="text-red-400 text-xs font-bold mb-3">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={onDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-xs">Yes, Permanently Delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 text-xs hover:text-white">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-component for individual plan card with payment logging
function PlanCard({ plan, onUpdate }: { plan: Plan; onUpdate: (planId: string, updates: any) => void }) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentHistory, setPaymentHistory] = useState<{amount: number; date: string}[]>([]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleLogPayment = () => {
    if (!paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    const newPaid = plan.paid + amount;
    onUpdate(plan.id, { paid: newPaid.toString() });
    setPaymentHistory(prev => [...prev, { amount, date: paymentDate }]);
    setPaymentAmount("");
    setShowPaymentForm(false);
  };

  return (
    <div className={`border rounded-lg p-4 mb-3 ${plan.status === "active" ? "border-accent/20" : "border-white/5 opacity-80"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">{plan.goal || formatDate(plan.startDate) + " — " + formatDate(plan.endDate)}</span>
                {plan.goal && <span className="text-gray-500 text-xs ml-2">{formatDate(plan.startDate)} — {formatDate(plan.endDate)}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${plan.status === "active" ? "bg-green-500/20 text-green-400" : plan.status === "completed" ? "bg-blue-500/20 text-blue-400" : "bg-gray-500/20 text-gray-400"}`}>
            {plan.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === "active" && (
            <button onClick={() => onUpdate(plan.id, { status: "completed" })} className="text-gray-500 text-xs hover:text-white">Mark Complete</button>
          )}
          {plan.status === "completed" && (
            <button onClick={() => onUpdate(plan.id, { status: "active" })} className="text-gray-500 text-xs hover:text-blue-400">Reactivate Plan</button>
          )}
        </div>
      </div>
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
      <div className="w-full bg-primary/50 rounded-full h-1.5 mt-3">
        <div className={`h-1.5 rounded-full ${(plan.owed - plan.paid) > 0 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${plan.owed > 0 ? Math.min(100, (plan.paid / plan.owed) * 100) : 100}%` }} />
      </div>

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-gray-500 text-xs mb-2">Recent Payments</p>
          <div className="space-y-1">
            {paymentHistory.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{formatDate(p.date)}</span>
                <span className="text-green-400 font-medium">+${p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
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
                <button onClick={handleLogPayment} disabled={!paymentAmount} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded text-xs disabled:opacity-50">Log Payment</button>
                <button onClick={() => { setShowPaymentForm(false); setPaymentAmount(""); }} className="text-gray-400 text-xs">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
