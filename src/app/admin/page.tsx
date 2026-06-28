"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import AccountTab from "./AccountTab";
import Changelog from "./Changelog";
import StructuredRunBuilder, { calculateTotalDistance, formatStructureForDisplay } from "./StructuredRunBuilder";
import type { WorkoutStructure, WorkBlock } from "./StructuredRunBuilder";

type WorkoutLog = { rpe: string; stress: string; notes: string; energy: string; motivation: string; sleep: string; strength: string; recovery: string; mood: string; hunger: string; actualMiles?: string; actualPace?: string; onPeriod?: string; duration?: string; avgHeartrate?: number | null; maxHeartrate?: number | null; };
type WorkoutDay = { id: string; day: string; date: string; type: "run" | "cross" | "rest"; trainingType: string; title: string; miles: number | null; distanceUnit?: "mi" | "km"; description: string; paceTarget?: string; location?: string; coachNotes?: string; completed: boolean; stravaSynced?: boolean; stravaActivityName?: string | null; log?: WorkoutLog; };
type ClientWorkout = { id: string; day: string; type: string; trainingType: string | null; miles: number | null; notes: string | null; createdAt: string; isClientAdded: true; source?: string; duration?: string | null; averagePace?: string | null; activityName?: string | null; avgHeartrate?: number | null; maxHeartrate?: number | null; completed?: boolean; completedNotes?: string | null; };
type WeekData = { weekId: string; label: string; dateRange: string; focus: string; coachMessage: string; status: "published" | "draft"; workouts: WorkoutDay[]; clientWorkouts: ClientWorkout[]; };
type CoachMessage = { id: string; date: string; from: string; message: string; };
type CoachAssignment = { coachId: string; coachName: string; isDefault: boolean; };
type Client = { id: string; clientId: string | null; name: string; email: string; gender: "female" | "male"; goal: string; startDate: string; planDuration: string; owed: number; paid: number; status: "active" | "archived"; inviteStatus: "accepted" | "pending" | "expired"; stravaProfileUrl?: string | null; stravaConnected?: boolean; weeks: WeekData[]; messages: CoachMessage[]; birthday?: string | null; coaches: CoachAssignment[]; };

export default function AdminPage() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<"plan" | "create" | "messages" | "drafts" | "account">("plan");
  const [editingWeek, setEditingWeek] = useState(false);
  const [editedWorkouts, setEditedWorkouts] = useState<Record<string, { type: string; trainingType: string; miles: string; title: string; description: string; paceTarget: string; location: string; coachNotes: string }>>({});
  const [editDistanceUnits, setEditDistanceUnits] = useState<Record<string, "mi" | "km">>({});
  const [editedCoachMessage, setEditedCoachMessage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showTemplatesView, setShowTemplatesView] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showManageCoaches, setShowManageCoaches] = useState(false);
  const [showNewUpdatesBadge, setShowNewUpdatesBadge] = useState(false);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  // AI Coach Assistant state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiPromptUsed, setAiPromptUsed] = useState("");
  const [aiSelectedClient, setAiSelectedClient] = useState<string>("all");
  const [aiDataDepth, setAiDataDepth] = useState<"light" | "standard" | "deep">("standard");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiFeedbackGiven, setAiFeedbackGiven] = useState<"up" | "down" | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  // Check if there are new updates the admin hasn't seen
  useEffect(() => {
    const lastSeen = localStorage.getItem("changelog_last_seen");
    if (!lastSeen || lastSeen < "2026-06-28T01:00:00Z") {
      setShowNewUpdatesBadge(true);
    }
  }, []);
  const [notifEmail, setNotifEmail] = useState("");
  const [notifEmailSaved, setNotifEmailSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    workoutCompleted: "immediate",
    workoutSkipped: "immediate",
    workoutPartial: "immediate",
    clientMessage: "immediate",
    dailySummary: "off",
  });
  const [adminNotifLoaded, setAdminNotifLoaded] = useState(false);
  const [adminDistanceUnit, setAdminDistanceUnit] = useState<"mi" | "km">("mi");
  const [adminExpandedDays, setAdminExpandedDays] = useState<Record<string, boolean>>({});
  const [adminDefaultExpanded, setAdminDefaultExpanded] = useState(true);

  // Fetch admin notification preferences
  useEffect(() => {
    const fetchAdminNotifPrefs = async () => {
      try {
        const res = await fetch('/api/notification-preferences');
        if (res.ok) {
          const data = await res.json();
          setNotifications({
            workoutCompleted: data.workoutCompleted || 'immediate',
            workoutSkipped: data.workoutSkipped || 'immediate',
            workoutPartial: data.workoutPartial || 'immediate',
            clientMessage: data.clientMessage || 'immediate',
            dailySummary: data.dailySummary || 'off',
          });
          setNotifEmail(data.notificationEmails || '');
          if (data.distanceUnit) setAdminDistanceUnit(data.distanceUnit);
          if (data.defaultExpanded !== undefined) setAdminDefaultExpanded(data.defaultExpanded);
        }
      } catch (err) {
        console.error('Failed to fetch admin notification prefs:', err);
      } finally {
        setAdminNotifLoaded(true);
      }
    };
    fetchAdminNotifPrefs();
  }, []);

  // Save admin notification preferences (called on every change)
  const saveAdminNotifPrefs = async (updatedNotifs: typeof notifications, email?: string, unit?: string, expanded?: boolean) => {
    try {
      await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutCompleted: updatedNotifs.workoutCompleted,
          workoutSkipped: updatedNotifs.workoutSkipped,
          workoutPartial: updatedNotifs.workoutPartial,
          clientMessage: updatedNotifs.clientMessage,
          dailySummary: updatedNotifs.dailySummary,
          ...(email !== undefined ? { notificationEmails: email } : {}),
          ...(unit !== undefined ? { distanceUnit: unit } : {}),
          ...(expanded !== undefined ? { defaultExpanded: expanded } : {}),
        }),
      });
    } catch (err) {
      console.error('Failed to save admin notification prefs:', err);
    }
  };

  // Helper: update a notification setting and auto-save
  const updateNotifSetting = (key: string, value: string) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    saveAdminNotifPrefs(updated);
  };
  const [clientFilter, setClientFilter] = useState<"active" | "archived" | "all">("active");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth()));
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [deletingWeekId, setDeletingWeekId] = useState<string | null>(null);
  const [newClientForm, setNewClientForm] = useState({ name: "", email: "", gender: "female" as "female" | "male", birthday: "" });

  const [weekPlan, setWeekPlan] = useState({
    dateRange: "", focus: "", coachMessage: "",
    days: [
      { day: "Monday", workouts: [{ type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
      { day: "Tuesday", workouts: [{ type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
      { day: "Wednesday", workouts: [{ type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
      { day: "Thursday", workouts: [{ type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
      { day: "Friday", workouts: [{ type: "cross" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
      { day: "Saturday", workouts: [{ type: "run" as string, trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
      { day: "Sunday", workouts: [{ type: "rest" as string, trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
    ],
  });
  const updateDayPlan = (dayIndex: number, workoutIndex: number, field: string, value: string) => {
    const updated = [...weekPlan.days];
    const workouts = [...updated[dayIndex].workouts];
    (workouts[workoutIndex] as Record<string, string>)[field] = value;
    updated[dayIndex] = { ...updated[dayIndex], workouts };
    setWeekPlan({ ...weekPlan, days: updated });
  };
  const addWorkoutToDay = (dayIndex: number) => {
    const updated = [...weekPlan.days];
    updated[dayIndex] = { ...updated[dayIndex], workouts: [...updated[dayIndex].workouts, { type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] };
    setWeekPlan({ ...weekPlan, days: updated });
  };
  const removeWorkoutFromDay = (dayIndex: number, workoutIndex: number) => {
    const updated = [...weekPlan.days];
    const workouts = updated[dayIndex].workouts.filter((_, wi) => wi !== workoutIndex);
    updated[dayIndex] = { ...updated[dayIndex], workouts: workouts.length > 0 ? workouts : [{ type: "rest", trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] };
    setWeekPlan({ ...weekPlan, days: updated });
  };

  const getMonday = (d: Date) => { const date = new Date(d); const day = date.getDay(); const diff = day === 0 ? -6 : 1 - day; date.setDate(date.getDate() + diff); return date; };
  const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const getWeeksInMonth = (month: Date) => { const weeks: Date[][] = []; const firstDay = new Date(month.getFullYear(), month.getMonth(), 1); const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0); let current = getMonday(firstDay); while (current <= lastDay || weeks.length < 5) { const week: Date[] = []; for (let i = 0; i < 7; i++) { week.push(new Date(current)); current.setDate(current.getDate() + 1); } weeks.push(week); if (current > lastDay && weeks.length >= 4) break; } return weeks; };
  const [weekDateWarning, setWeekDateWarning] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiCoachNotes, setAiCoachNotes] = useState("");
  const [aiCredits, setAiCredits] = useState<{ used: number; total: number } | null>(null);

  // Fetch AI credit balance
  useEffect(() => {
    const fetchAiCredits = async () => {
      try {
        const res = await fetch('/api/ai-credits');
        if (res.ok) {
          const data = await res.json();
          // Try multiple field names since we don't know exact API format
          const used = data.used ?? (data.total != null && data.remaining != null ? data.total - data.remaining : null);
          const total = data.total ?? 5.00;
          if (used !== null && total !== null) {
            setAiCredits({ used: parseFloat(used) || 0, total: parseFloat(total) || 5.00 });
          } else if (data.remaining !== null && data.remaining !== undefined) {
            // If we only have remaining, calculate used from $5 total
            const t = parseFloat(data.total) || 5.00;
            const r = parseFloat(data.remaining) || 0;
            setAiCredits({ used: t - r, total: t });
          }
        }
      } catch {}
    };
    fetchAiCredits();
  }, [aiSuggesting]);
  const selectWeek = (monday: Date) => {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    setSelectedWeekStart(monday);
    const dateRange = `${formatDate(monday)} - ${formatDate(sunday)}`;
    setWeekPlan({ ...weekPlan, dateRange });
    setShowWeekPicker(false);

    // Check if a week already exists for this date range (published or draft)
    const clientData = clients.find(c => c.id === selectedClient);
    const existingWeek = clientData?.weeks.find(w => w.dateRange === dateRange);
    if (existingWeek && existingWeek.weekId !== editingDraftId) {
      setWeekDateWarning(`A week already exists for ${dateRange} (${existingWeek.status}). You cannot create a duplicate. Go to ${existingWeek.status === 'draft' ? 'Drafts' : 'Training & Logs'} to view or edit it.`);
      return;
    }

    // Validate against active plan dates
    if (activePlan && activePlan.startDate && activePlan.endDate) {
      const planStart = new Date(activePlan.startDate);
      const planEnd = new Date(activePlan.endDate);
      planStart.setHours(0, 0, 0, 0);
      planEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(monday);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(sunday);
      weekEnd.setHours(0, 0, 0, 0);
      if (weekStart < planStart || weekEnd > planEnd) {
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        setWeekDateWarning(`This week falls outside the active plan (${fmt(planStart)} – ${fmt(planEnd)}). You won't be able to save until you select a week within the plan dates, or update the plan dates in the Account tab.`);
      } else {
        setWeekDateWarning("");
      }
    } else {
      setWeekDateWarning("");
    }
  };

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loggedInUser, setLoggedInUser] = useState<string>("");
  const [loggedInUserId, setLoggedInUserId] = useState<string>("");

  // All coaches in the system (for multi-coach dropdown)
  type CoachOption = { id: string; name: string; email: string };
  const [allCoaches, setAllCoaches] = useState<CoachOption[]>([]);
  const [showCoachDropdown, setShowCoachDropdown] = useState(false);
  const [coachAssigning, setCoachAssigning] = useState(false);

  // Manage coaches state
  const [newCoachForm, setNewCoachForm] = useState({ name: "", email: "" });
  const [creatingCoach, setCreatingCoach] = useState(false);
  const [createCoachError, setCreateCoachError] = useState("");
  const [createCoachSuccess, setCreateCoachSuccess] = useState("");
  const [deletingCoachId, setDeletingCoachId] = useState<string | null>(null);

  // Fetch all coaches in the system
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const res = await fetch('/api/coaches');
        if (res.ok) {
          const data = await res.json();
          setAllCoaches(data.map((c: any) => ({ id: c.id, name: c.name, email: c.email })));
        }
      } catch (err) { console.error('Failed to fetch coaches:', err); }
    };
    fetchCoaches();
  }, []);

  // Assign a coach to the selected client
  const handleAssignCoach = async (coachId: string) => {
    const client = clients.find(c => c.id === selectedClient);
    if (!client?.clientId) return;
    setCoachAssigning(true);
    try {
      const isFirst = client.coaches.length === 0;
      const res = await fetch('/api/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.clientId, coachId, isDefault: isFirst }),
      });
      if (res.ok) {
        const coachName = allCoaches.find(c => c.id === coachId)?.name || 'Unknown';
        setClients(prev => prev.map(c => c.id === selectedClient ? {
          ...c,
          coaches: [...c.coaches, { coachId, coachName, isDefault: isFirst }],
        } : c));
      }
    } catch (err) { console.error('Failed to assign coach:', err); }
    finally { setCoachAssigning(false); setShowCoachDropdown(false); }
  };

  // Remove a coach from the selected client
  const handleRemoveCoach = async (coachId: string) => {
    const client = clients.find(c => c.id === selectedClient);
    if (!client?.clientId) return;
    try {
      const res = await fetch('/api/coaches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.clientId, coachId }),
      });
      if (res.ok) {
        // If we removed the default, the API auto-promotes the next one
        const wasDefault = client.coaches.find(c => c.coachId === coachId)?.isDefault;
        const remaining = client.coaches.filter(c => c.coachId !== coachId);
        if (wasDefault && remaining.length > 0) remaining[0].isDefault = true;
        setClients(prev => prev.map(c => c.id === selectedClient ? { ...c, coaches: remaining } : c));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to remove coach');
      }
    } catch (err) { console.error('Failed to remove coach:', err); }
  };

  // Set a coach as default for the selected client
  const handleSetDefaultCoach = async (coachId: string) => {
    const client = clients.find(c => c.id === selectedClient);
    if (!client?.clientId) return;
    try {
      const res = await fetch('/api/coaches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.clientId, coachId }),
      });
      if (res.ok) {
        setClients(prev => prev.map(c => c.id === selectedClient ? {
          ...c,
          coaches: c.coaches.map(coach => ({ ...coach, isDefault: coach.coachId === coachId })),
        } : c));
      }
    } catch (err) { console.error('Failed to set default coach:', err); }
  };

  // Invite a new coach to the system
  const handleInviteCoach = async () => {
    if (!newCoachForm.name.trim() || !newCoachForm.email.trim()) return;
    setCreatingCoach(true);
    setCreateCoachError("");
    setCreateCoachSuccess("");
    try {
      const res = await fetch('/api/coaches/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCoachForm.name.trim(), email: newCoachForm.email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateCoachError(data.error || 'Failed to invite coach');
      } else {
        setCreateCoachSuccess(`Invite sent to ${newCoachForm.email}!`);
        setNewCoachForm({ name: "", email: "" });
        // Refresh the coaches list
        const coachRes = await fetch('/api/coaches');
        if (coachRes.ok) {
          const coachData = await coachRes.json();
          setAllCoaches(coachData.map((c: any) => ({ id: c.id, name: c.name, email: c.email })));
        }
        setTimeout(() => setCreateCoachSuccess(""), 5000);
      }
    } catch (err) {
      setCreateCoachError('Network error. Please try again.');
    } finally {
      setCreatingCoach(false);
    }
  };

  // Delete/deactivate a coach from the system
  const handleDeleteCoach = async (coachId: string) => {
    const coach = allCoaches.find(c => c.id === coachId);
    if (!confirm(`Are you sure you want to remove ${coach?.name || 'this coach'}? They will lose admin access. Their existing week plans and comments will remain.`)) return;
    setDeletingCoachId(coachId);
    try {
      const res = await fetch('/api/coaches/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId }),
      });
      if (res.ok) {
        setAllCoaches(prev => prev.filter(c => c.id !== coachId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove coach');
      }
    } catch (err) {
      console.error('Failed to delete coach:', err);
    } finally {
      setDeletingCoachId(null);
    }
  };

  // Fetch logged-in user name
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single();
          setLoggedInUser(profile?.name || user.email || '');
          setLoggedInUserId(user.id);
        }
      } catch (err) { console.error(err); }
    };
    fetchMe();
  }, []);
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [unreadByClient, setUnreadByClient] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);

  // Templates state
  type Template = { id: string; name: string; type: "week" | "day"; category: string; data: any; created_at: string };
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showSaveWeekTemplate, setShowSaveWeekTemplate] = useState(false);
  const [showSaveDayTemplate, setShowSaveDayTemplate] = useState<number | null>(null);
  const [showLoadDayTemplate, setShowLoadDayTemplate] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateCategory, setEditTemplateCategory] = useState("");
  const [editTemplateFocus, setEditTemplateFocus] = useState("");
  const [editTemplateCoachMessage, setEditTemplateCoachMessage] = useState("");
  const [editTemplateDays, setEditTemplateDays] = useState<any[]>([]);
  const [savingTemplateEdit, setSavingTemplateEdit] = useState(false);
  const [editingDayTemplateId, setEditingDayTemplateId] = useState<string | null>(null);
  const [editDayTemplateName, setEditDayTemplateName] = useState("");
  const [editDayTemplateCategory, setEditDayTemplateCategory] = useState("");
  const [editDayTemplateData, setEditDayTemplateData] = useState<any>({});
  const [creatingWeekTemplate, setCreatingWeekTemplate] = useState(false);
  const [creatingDayTemplate, setCreatingDayTemplate] = useState(false);
  const [newWeekTemplateName, setNewWeekTemplateName] = useState("");
  const [newWeekTemplateCategory, setNewWeekTemplateCategory] = useState("");
  const [newWeekTemplateFocus, setNewWeekTemplateFocus] = useState("");
  const [newWeekTemplateCoachMessage, setNewWeekTemplateCoachMessage] = useState("");
  const [newWeekTemplateDays, setNewWeekTemplateDays] = useState([
    { day: "Monday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
    { day: "Tuesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
    { day: "Wednesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
    { day: "Thursday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
    { day: "Friday", workouts: [{ type: "cross", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
    { day: "Saturday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
    { day: "Sunday", workouts: [{ type: "rest", trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
  ]);
  const [newDayTemplateName, setNewDayTemplateName] = useState("");
  const [newDayTemplateCategory, setNewDayTemplateCategory] = useState("");
  const [newDayTemplateData, setNewDayTemplateData] = useState<any>({ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" });
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const weekTemplates = templates.filter(t => t.type === 'week').sort((a, b) => a.name.localeCompare(b.name));
  const dayTemplates = templates.filter(t => t.type === 'day').sort((a, b) => a.name.localeCompare(b.name));

  // Save week as template
  const saveTemplateRef = useRef<HTMLDivElement>(null);
  const createWeekRef = useRef<HTMLDivElement>(null);
  const handleSaveWeekTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          type: 'week',
          category: templateCategory.trim() || null,
          data: {
            focus: weekPlan.focus,
            coachMessage: weekPlan.coachMessage,
            days: weekPlan.days,
          },
        }),
      });
      if (res.ok) {
        setShowSaveWeekTemplate(false);
        setTemplateName("");
        setTemplateCategory("");
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Save individual day as template (saves the first workout of that day)
  const handleSaveDayTemplate = async (dayIndex: number) => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    const day = weekPlan.days[dayIndex];
    const firstWorkout = day.workouts[0];
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          type: 'day',
          category: templateCategory.trim() || null,
          data: firstWorkout,
        }),
      });
      if (res.ok) {
        setShowSaveDayTemplate(null);
        setTemplateName("");
        setTemplateCategory("");
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to save day template:', err);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Load week template into form
  const loadWeekTemplate = (template: Template) => {
    const data = template.data;
    // Handle both old format (flat days) and new format (days with workouts array)
    const days = (data.days || []).map((d: any) => {
      if (d.workouts) return d; // Already new format
      return { day: d.day, workouts: [{ type: d.type || 'rest', trainingType: d.trainingType || '', title: d.title || '', miles: d.miles || '', description: d.description || '', paceTarget: d.paceTarget || '', location: d.location || '', coachNotes: d.coachNotes || '', distanceUnit: d.distanceUnit || 'mi' }] };
    });
    setWeekPlan({
      ...weekPlan,
      focus: data.focus || '',
      coachMessage: data.coachMessage || '',
      days: days.length === 7 ? days : weekPlan.days,
    });
  };

  // Load day template into a specific day (replaces first workout or adds)
  const loadDayTemplate = (dayIndex: number, template: Template) => {
    const data = template.data;
    const updated = [...weekPlan.days];
    // Replace the first workout with the template data
    const newWorkout = { type: data.type || 'run', trainingType: data.trainingType || '', title: data.title || '', miles: data.miles || '', description: data.description || '', paceTarget: data.paceTarget || '', location: data.location || '', coachNotes: data.coachNotes || '', distanceUnit: data.distanceUnit || 'mi' };
    if (updated[dayIndex].workouts.length === 1 && !updated[dayIndex].workouts[0].title) {
      // Replace the empty default
      updated[dayIndex] = { ...updated[dayIndex], workouts: [newWorkout] };
    } else {
      // Add as additional workout
      updated[dayIndex] = { ...updated[dayIndex], workouts: [...updated[dayIndex].workouts, newWorkout] };
    }
    setWeekPlan({ ...weekPlan, days: updated });
    setShowLoadDayTemplate(null);
  };

  // AI Suggest Week Plan
  const handleAiSuggest = async () => {
    const client = clients.find(c => c.id === selectedClient);
    if (!client || !client.clientId) return;

    setAiSuggesting(true);
    setAiReasoning("");
    setAiError("");

    try {
      const res = await fetch('/api/ai-suggest-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.clientId,
          dateRange: weekPlan.dateRange || null,
          coachNotes: aiCoachNotes || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setAiError(errData.error || 'Failed to generate suggestion');
        return;
      }

      const data = await res.json();
      const suggestion = data.suggestion;

      // Map AI suggestion into the weekPlan state format
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const mappedDays = dayNames.map(dayName => {
        const aiDay = suggestion.days.find((d: any) => d.day === dayName);
        if (!aiDay || !aiDay.workouts || aiDay.workouts.length === 0) {
          return { day: dayName, workouts: [{ type: 'rest', trainingType: 'Rest', title: '', miles: '', description: '', paceTarget: '', location: '', coachNotes: '', distanceUnit: 'mi' }] };
        }
        return {
          day: dayName,
          workouts: aiDay.workouts.map((w: any) => ({
            type: w.type || 'rest',
            trainingType: w.trainingType || (w.type === 'rest' ? 'Rest' : ''),
            title: w.title || '',
            miles: w.miles?.toString() || '',
            description: w.description || '',
            paceTarget: w.paceTarget || '',
            location: w.location || '',
            coachNotes: w.coachNotes || '',
            distanceUnit: w.distanceUnit || 'mi',
          })),
        };
      });

      setWeekPlan({
        ...weekPlan,
        focus: suggestion.focus || weekPlan.focus,
        coachMessage: suggestion.coachMessage || weekPlan.coachMessage,
        days: mappedDays,
      });

      setAiReasoning(suggestion.reasoning || '');
    } catch (err: any) {
      setAiError(err.message || 'Failed to connect to AI service');
    } finally {
      setAiSuggesting(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  // Start editing a week template inline
  const startEditingTemplate = (template: Template) => {
    setEditingTemplateId(template.id);
    setEditTemplateName(template.name);
    setEditTemplateCategory(template.category || '');
    setEditTemplateFocus(template.data.focus || '');
    setEditTemplateCoachMessage(template.data.coachMessage || '');
    // Normalize days to new format
    const days = (template.data.days || []).map((d: any) => {
      if (d.workouts) return d;
      return { day: d.day, workouts: [{ type: d.type || 'rest', trainingType: d.trainingType || '', title: d.title || '', miles: d.miles || '', description: d.description || '', paceTarget: d.paceTarget || '', location: d.location || '', coachNotes: d.coachNotes || '', distanceUnit: d.distanceUnit || 'mi' }] };
    });
    setEditTemplateDays(days);
  };

  // Save edited week template
  const handleSaveEditedTemplate = async () => {
    if (!editingTemplateId || !editTemplateName.trim()) return;
    setSavingTemplateEdit(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: editingTemplateId,
          name: editTemplateName.trim(),
          category: editTemplateCategory.trim() || null,
          data: {
            focus: editTemplateFocus,
            coachMessage: editTemplateCoachMessage,
            days: editTemplateDays,
          },
        }),
      });
      if (res.ok) {
        setEditingTemplateId(null);
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to update template:', err);
    } finally {
      setSavingTemplateEdit(false);
    }
  };

  // Start editing a day template inline
  const startEditingDayTemplate = (template: Template) => {
    setEditingDayTemplateId(template.id);
    setEditDayTemplateName(template.name);
    setEditDayTemplateCategory(template.category || '');
    setEditDayTemplateData({ ...template.data });
  };

  // Save edited day template
  const handleSaveEditedDayTemplate = async () => {
    if (!editingDayTemplateId || !editDayTemplateName.trim()) return;
    setSavingTemplateEdit(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: editingDayTemplateId,
          name: editDayTemplateName.trim(),
          category: editDayTemplateCategory.trim() || null,
          data: editDayTemplateData,
        }),
      });
      if (res.ok) {
        setEditingDayTemplateId(null);
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to update day template:', err);
    } finally {
      setSavingTemplateEdit(false);
    }
  };

  // Create a new week template from scratch
  const handleCreateWeekTemplate = async () => {
    if (!newWeekTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWeekTemplateName.trim(),
          type: 'week',
          category: newWeekTemplateCategory.trim() || null,
          data: {
            focus: newWeekTemplateFocus,
            coachMessage: newWeekTemplateCoachMessage,
            days: newWeekTemplateDays,
          },
        }),
      });
      if (res.ok) {
        setCreatingWeekTemplate(false);
        setNewWeekTemplateName("");
        setNewWeekTemplateCategory("");
        setNewWeekTemplateFocus("");
        setNewWeekTemplateCoachMessage("");
        setNewWeekTemplateDays([
          { day: "Monday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
          { day: "Tuesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
          { day: "Wednesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
          { day: "Thursday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
          { day: "Friday", workouts: [{ type: "cross", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
          { day: "Saturday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
          { day: "Sunday", workouts: [{ type: "rest", trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
        ]);
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to create week template:', err);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Create a new day template from scratch
  const handleCreateDayTemplate = async () => {
    if (!newDayTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDayTemplateName.trim(),
          type: 'day',
          category: newDayTemplateCategory.trim() || null,
          data: newDayTemplateData,
        }),
      });
      if (res.ok) {
        setCreatingDayTemplate(false);
        setNewDayTemplateName("");
        setNewDayTemplateCategory("");
        setNewDayTemplateData({ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" });
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to create day template:', err);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Fetch unread message counts
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages/unread');
        if (res.ok) {
          const data = await res.json();
          setUnreadByClient(data.byClient || {});
          setTotalUnread(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread counts:', err);
      }
    };
    fetchUnread();
    // Poll every 30 seconds for new messages
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch clients from API
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (res.ok) {
        const mapped: Client[] = data.map((c: any) => ({
          id: c.userId,
          clientId: c.clientId || null,
          name: c.name || '',
          email: c.email || '',
          gender: c.gender || 'female',
          goal: c.goal || '',
          startDate: c.startDate || '',
          planDuration: c.planEnd || '',
          owed: c.owed || 0,
          paid: c.paid || 0,
          status: c.status === 'inactive' ? 'archived' : 'active',
          inviteStatus: c.inviteStatus || 'accepted',
          stravaProfileUrl: c.stravaProfileUrl || null,
          stravaConnected: c.stravaConnected || false,
          weeks: [],
          messages: [],
          birthday: c.birthday || null,
          coaches: (c.coaches || []).map((coach: any) => ({
            coachId: coach.coachId,
            coachName: coach.coachName || 'Unknown',
            isDefault: coach.isDefault || false,
          })),
        }));
        setClients(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Fetch all drafts on initial load so dashboard shows them immediately
  const draftsLoadedRef = useRef(false);
  useEffect(() => {
    if (draftsLoadedRef.current) return;
    const fetchAllDrafts = async () => {
      if (clients.length === 0) return;
      draftsLoadedRef.current = true;
      const clientsWithIds = clients.filter(c => c.clientId && c.weeks.length === 0);
      if (clientsWithIds.length === 0) return;
      for (const client of clientsWithIds) {
        try {
          const res = await fetch(`/api/weeks?client_id=${client.clientId}`);
          if (res.ok) {
            const data = await res.json();
            const drafts = data.filter((w: any) => w.status === 'draft');
            if (drafts.length > 0) {
              const mapped = drafts.map((w: any) => ({
                weekId: w.weekId,
                label: w.dateRange,
                dateRange: w.dateRange,
                focus: w.focus || '',
                coachMessage: w.coachMessage || '',
                status: 'draft' as const,
                clientWorkouts: [],
                workouts: (w.workouts || []).map((wo: any) => ({
                  id: wo.id, day: wo.day || '', date: '', type: wo.type || 'run',
                  trainingType: wo.trainingType || '', title: wo.title || '',
                  miles: wo.miles, distanceUnit: wo.distanceUnit || 'mi',
                  description: wo.description || '', paceTarget: wo.paceTarget || '',
                  location: wo.location || '', coachNotes: wo.coachNotes || '',
                  completed: wo.completed || false, stravaSynced: wo.stravaSynced || false,
                  stravaActivityName: wo.stravaActivityName || null,
                  status: wo.status || undefined,
                  skipReason: wo.skipReason || undefined, log: wo.log || undefined,
                  structure: wo.structure || null,
                })),
              }));
              setClients(prev => prev.map(c => c.id === client.id ? { ...c, weeks: [...c.weeks, ...mapped] } : c));
            }
          }
        } catch (err) { console.error('Failed to fetch drafts for', client.name, err); }
      }
    };
    fetchAllDrafts();
  }, [clients.length]);

  // Create new client via API
  const handleCreateClient = async () => {
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientForm.name,
          email: newClientForm.email,
          gender: newClientForm.gender,
          birthday: newClientForm.birthday || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create client');
      } else {
        setShowCreateClient(false);
        setNewClientForm({ name: "", email: "", gender: "female", birthday: "" });
        fetchClients(); // Refresh the list
      }
    } catch (err) {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Archive client via API
  const handleArchiveClient = async (userId: string) => {
    try {
      const res = await fetch(`/api/clients/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchClients();
        setSelectedClient(null);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error('Failed to archive client:', err);
    }
  };

  // Resend invite email
  const handleResendInvite = async (userId: string) => {
    setResendingInvite(true);
    setResendSuccess(false);
    try {
      const res = await fetch(`/api/clients/${userId}`, { method: 'POST' });
      if (res.ok) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
        fetchClients(); // Refresh to update invite status
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resend invite');
      }
    } catch (err) {
      console.error('Failed to resend invite:', err);
    } finally {
      setResendingInvite(false);
    }
  };

  const selectedClientData = clients.find((c) => c.id === selectedClient);

  // Distance conversion helper - converts from sourceUnit to admin's preferred unit
  const convertDist = (value: number, sourceUnit?: "mi" | "km") => {
    const from = sourceUnit || "mi";
    const to = adminDistanceUnit;
    if (from === to) return +value.toFixed(2);
    if (from === "mi" && to === "km") return +(value * 1.60934).toFixed(2);
    if (from === "km" && to === "mi") return +(value / 1.60934).toFixed(2);
    return +value.toFixed(2);
  };
  const distUnitLabel = adminDistanceUnit === "km" ? "KM" : "Miles";
  const distUnitShort = adminDistanceUnit === "km" ? "km" : "mi";

  const selectedClientWeeks = selectedClientData?.weeks || [];
  const publishedWeeks = selectedClientWeeks.filter(w => w.status === "published");
  const draftWeeks = selectedClientWeeks.filter(w => w.status === "draft").sort((a, b) => {
    const dateA = new Date(a.dateRange.split(' - ')[0] + ', ' + new Date().getFullYear());
    const dateB = new Date(b.dateRange.split(' - ')[0] + ', ' + new Date().getFullYear());
    return dateA.getTime() - dateB.getTime();
  });
  const allClientWorkouts = publishedWeeks.flatMap((w) => w.workouts);
  const completedWorkouts = allClientWorkouts.filter((w) => w.completed);
  const totalMilesCompleted = allClientWorkouts.filter(w => w.log && (w.type === 'run' || w.type === 'walk')).reduce((s, w) => s + convertDist(Number(w.log?.actualMiles) || convertDist(w.miles || 0, w.distanceUnit), "mi"), 0);
  const totalMilesProgrammed = allClientWorkouts.filter(w => w.type === 'run' || w.type === 'walk').reduce((s, w) => s + convertDist(w.miles || 0, w.distanceUnit), 0);
  const [adminMessages, setAdminMessages] = useState<{id: string; date: string; from: string; message: string; fromName?: string}[]>([]);
  const [sendingAdminMessage, setSendingAdminMessage] = useState(false);
  const adminMessagesEndRef = useRef<HTMLDivElement>(null);

  // Workout comments state (declared here, useEffect placed after selectedWeek)
  const [workoutComments, setWorkoutComments] = useState<Record<string, {id: string; workoutId: string; userId: string; userName: string; message: string; createdAt: string; isCoach: boolean}[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    adminMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adminMessages]);
  // AI Coach handler
  const handleAiQuery = async (prompt: string) => {
    setAiLoading(true);
    setAiResponse(null);
    setAiPromptUsed(prompt);
    setAiFeedbackGiven(null);
    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          clientId: aiSelectedClient === 'all' ? null : aiSelectedClient,
          dataDepth: aiDataDepth,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.response);
        setAiProvider(data.provider || null);
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.isRateLimit) {
          setAiResponse(null);
          setAiProvider('rate-limited');
        } else {
          setAiResponse(`Error: ${err.error || 'Something went wrong. Try again.'}`);
        }
      }
    } catch (err) {
      setAiResponse('Error: Failed to connect. Check your internet connection.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiFeedback = async (rating: 'up' | 'down') => {
    setAiFeedbackGiven(rating);
    try {
      await fetch('/api/ai-coach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPromptUsed, response: aiResponse?.slice(0, 1000), rating, clientId: aiSelectedClient === 'all' ? null : aiSelectedClient }),
      });
    } catch (err) { /* silent */ }
  };

  const filteredClients = clients.filter(c => (clientFilter === "all" || c.status === clientFilter) && c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  // Fetch messages when Messages tab is opened for a client
  useEffect(() => {
    if (selectedClient && clientTab === "messages") {
      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/messages?with_user_id=${selectedClient}`);
          if (res.ok) {
            const data = await res.json();
            setAdminMessages(data);
          }
        } catch (err) {
          console.error('Failed to fetch messages:', err);
        }
      };
      fetchMessages();
    }
  }, [selectedClient, clientTab]);

  const handleSendAdminMessage = async () => {
    if (!newMessage.trim() || !selectedClient) return;
    setSendingAdminMessage(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: selectedClient, message: newMessage }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminMessages(prev => [...prev, {
          id: data.messageId,
          date: new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          from: 'crystal',
          message: newMessage.trim(),
          fromName: loggedInUser?.split(' ')[0] || 'Coach',
        }]);
        setNewMessage("");
        setShowMessageForm(false);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingAdminMessage(false);
    }
  };

  // Calendar-based week navigation for admin (same as client)
  const [adminWeekOffset, setAdminWeekOffset] = useState(0);
  const [adminMinOffset, setAdminMinOffset] = useState(0);
  const [adminMaxOffset, setAdminMaxOffset] = useState(0);

  const getAdminMondayForOffset = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const targetMonday = new Date(thisMonday);
    targetMonday.setDate(thisMonday.getDate() + (offset * 7));
    return targetMonday;
  };

  const getAdminWeekLabel = (offset: number) => {
    const monday = getAdminMondayForOffset(offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)} - ${fmt(sunday)}`;
  };

  const getAdminWeekPlan = (offset: number): WeekData | null => {
    const monday = getAdminMondayForOffset(offset);
    const mondayStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const exact = publishedWeeks.find(w => w.dateRange.startsWith(mondayStr));
    if (exact) return exact;
    // Try day before (week might start on Sunday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() - 1);
    const sundayStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return publishedWeeks.find(w => w.dateRange.startsWith(sundayStr)) || null;
  };

  const selectedWeek = getAdminWeekPlan(adminWeekOffset);

  // Fetch workout comments when viewed week changes
  useEffect(() => {
    if (!selectedWeek) return;
    const completedIds = [
      ...selectedWeek.workouts.filter(w => w.completed).map(w => w.id),
      ...(selectedWeek.clientWorkouts || []).filter(cw => cw.completed).map(cw => cw.id),
    ];
    if (completedIds.length === 0) return;
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/workout-comments?workout_ids=${completedIds.join(',')}`);
        if (res.ok) {
          const data = await res.json();
          setWorkoutComments(prev => ({ ...prev, ...data }));
        }
      } catch (err) { console.error('Failed to fetch workout comments:', err); }
    };
    fetchComments();
  }, [selectedWeek?.weekId]);

  const handleSendWorkoutComment = async (workoutId: string) => {
    const msg = commentInput[workoutId]?.trim();
    if (!msg) return;
    setSendingComment(workoutId);
    try {
      const res = await fetch('/api/workout-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId, message: msg }),
      });
      if (res.ok) {
        const comment = await res.json();
        setWorkoutComments(prev => ({
          ...prev,
          [workoutId]: [...(prev[workoutId] || []), comment],
        }));
        setCommentInput(prev => ({ ...prev, [workoutId]: '' }));
      }
    } catch (err) { console.error('Failed to send comment:', err); }
    finally { setSendingComment(null); }
  };

  // Fetch weeks for a client from the API
  // resetIndex: if true, jump to current week. If false, keep current position.
  const fetchWeeks = useCallback(async (clientId: string, resetIndex = false) => {
    try {
      const res = await fetch(`/api/weeks?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        const mapped: WeekData[] = data.map((w: any) => ({
          weekId: w.weekId,
          label: w.dateRange,
          dateRange: w.dateRange,
          focus: w.focus || '',
          coachMessage: w.coachMessage || '',
          status: w.status as "published" | "draft",
          clientWorkouts: (w.clientWorkouts || []).map((cw: any) => ({
            id: cw.id,
            day: cw.day,
            type: cw.type,
            trainingType: cw.trainingType || null,
            miles: cw.miles,
            notes: cw.notes,
            createdAt: cw.createdAt,
            isClientAdded: true as const,
            source: cw.source || 'manual',
            duration: cw.duration || null,
            averagePace: cw.averagePace || null,
            activityName: cw.activityName || null,
            avgHeartrate: cw.avgHeartrate || null,
            maxHeartrate: cw.maxHeartrate || null,
            completed: cw.completed || false,
            completedNotes: cw.completedNotes || null,
          })),
          workouts: (w.workouts || []).map((wo: any) => ({
            id: wo.id,
            day: wo.day || '',
            date: '',
            type: wo.type || 'run',
            trainingType: wo.trainingType || '',
            title: wo.title || '',
            miles: wo.miles,
            distanceUnit: wo.distanceUnit || 'mi',
            description: wo.description || '',
            paceTarget: wo.paceTarget || '',
            location: wo.location || '',
            coachNotes: wo.coachNotes || '',
            completed: wo.completed || false,
            stravaSynced: wo.stravaSynced || false,
            stravaActivityName: wo.stravaActivityName || null,
            structure: wo.structure || null,
            status: wo.status || undefined,
            skipReason: wo.skipReason || undefined,
            log: wo.log || undefined,
          })),
        }));
        // Update the client's weeks in state
        setClients(prev => prev.map(c => c.id === selectedClient ? { ...c, weeks: mapped } : c));
        
        // Calculate navigation bounds based on published plans
        if (resetIndex) {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const thisMonday = new Date(today);
          thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          thisMonday.setHours(0, 0, 0, 0);

          // Calculate navigation bounds based on ALL weeks (published + draft)
          let earliest = 0;
          let latest = 0;
          
          for (const w of mapped) {
            const startStr = w.dateRange.split(' - ')[0];
            const weekMonday = new Date(startStr + ', ' + new Date().getFullYear());
            // Handle year boundary
            const monthDiff = weekMonday.getMonth() - today.getMonth();
            if (monthDiff > 6) weekMonday.setFullYear(weekMonday.getFullYear() - 1);
            if (monthDiff < -6) weekMonday.setFullYear(weekMonday.getFullYear() + 1);
            weekMonday.setHours(0, 0, 0, 0);
            const diffDays = Math.round((weekMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24));
            const offset = Math.round(diffDays / 7);
            if (offset < earliest) earliest = offset;
            if (offset > latest) latest = offset;
          }
          
          setAdminMinOffset(earliest);
          setAdminMaxOffset(latest);
          setAdminWeekOffset(0); // Always start on current week
        }
      }
    } catch (err) {
      console.error('Failed to fetch weeks:', err);
    }
  }, [selectedClient]);

  // Active plan for the selected client
  const [activePlan, setActivePlan] = useState<{ id: string; startDate: string; endDate: string; goal: string; owed: number; paid: number; status: string } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Load weeks and active plan once when a client is first selected
  const [weeksLoadedFor, setWeeksLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedClient || weeksLoadedFor === selectedClient) return;
    const client = clients.find(c => c.id === selectedClient);
    if (client && client.clientId) {
      setWeeksLoadedFor(selectedClient);
      fetchWeeks(client.clientId, true);
      // Fetch active plan
      setLoadingPlan(true);
      fetch(`/api/plans?client_id=${client.clientId}`)
        .then(res => res.ok ? res.json() : [])
        .then((plans: any[]) => {
          const active = plans.find((p: any) => p.status === 'active');
          if (active) {
            setActivePlan({
              id: active.id,
              startDate: active.start_date,
              endDate: active.end_date,
              goal: active.goal || '',
              owed: parseFloat(active.owed) || 0,
              paid: parseFloat(active.paid) || 0,
              status: active.status,
            });
          } else {
            setActivePlan(null);
          }
        })
        .catch(() => setActivePlan(null))
        .finally(() => setLoadingPlan(false));
    }
  }, [selectedClient, clients.length]);

  // Reset active plan when switching clients
  useEffect(() => {
    if (!selectedClient) {
      setActivePlan(null);
      setWeeksLoadedFor(null);
    }
  }, [selectedClient]);

  // Plan-period stats filter
  const [adminStatsFilter, setAdminStatsFilter] = useState<"currentWeek" | "currentPlan" | "allTime">("currentWeek");

  // Filter workouts by active plan date range for "Current Plan" stats
  const planFilteredWorkouts = (() => {
    if (!activePlan || !activePlan.startDate || !activePlan.endDate) return allClientWorkouts;
    const planStart = new Date(activePlan.startDate);
    const planEnd = new Date(activePlan.endDate);
    planStart.setHours(0, 0, 0, 0);
    planEnd.setHours(23, 59, 59, 999);
    const planWeeks = publishedWeeks.filter(w => {
      const startStr = w.dateRange.split(' - ')[0];
      const weekMonday = new Date(startStr + ', ' + new Date().getFullYear());
      if (weekMonday > new Date(new Date().getFullYear(), 11, 31)) {
        weekMonday.setFullYear(weekMonday.getFullYear() - 1);
      }
      weekMonday.setHours(0, 0, 0, 0);
      return weekMonday >= planStart && weekMonday <= planEnd;
    });
    return planWeeks.flatMap((w) => w.workouts);
  })();

  // Current week workouts (uses selectedWeek which is based on adminWeekOffset)
  const currentWeekWorkouts = selectedWeek ? selectedWeek.workouts : [];

  // Client-added workout miles (for stats)
  const allClientAddedMiles = publishedWeeks.flatMap(w => w.clientWorkouts || []).filter(cw => cw.type === 'run' || cw.type === 'walk').reduce((s, cw) => s + (cw.miles || 0), 0);
  const planClientAddedMiles = (() => {
    if (!activePlan || !activePlan.startDate || !activePlan.endDate) return allClientAddedMiles;
    const planStart = new Date(activePlan.startDate);
    const planEnd = new Date(activePlan.endDate);
    planStart.setHours(0, 0, 0, 0);
    planEnd.setHours(23, 59, 59, 999);
    const planWeeks = publishedWeeks.filter(w => {
      const startStr = w.dateRange.split(' - ')[0];
      const weekMonday = new Date(startStr + ', ' + new Date().getFullYear());
      if (weekMonday > new Date(new Date().getFullYear(), 11, 31)) weekMonday.setFullYear(weekMonday.getFullYear() - 1);
      weekMonday.setHours(0, 0, 0, 0);
      return weekMonday >= planStart && weekMonday <= planEnd;
    });
    return planWeeks.flatMap(w => w.clientWorkouts || []).filter(cw => cw.type === 'run' || cw.type === 'walk').reduce((s, cw) => s + (cw.miles || 0), 0);
  })();
  const currentWeekClientMiles = selectedWeek ? (selectedWeek.clientWorkouts || []).filter(cw => cw.type === 'run' || cw.type === 'walk').reduce((s, cw) => s + (cw.miles || 0), 0) : 0;

  const displayWorkouts = adminStatsFilter === "currentWeek" ? currentWeekWorkouts.filter(w => w.type !== "rest") : adminStatsFilter === "currentPlan" ? planFilteredWorkouts.filter(w => w.type !== "rest") : allClientWorkouts.filter(w => w.type !== "rest");
  const displayMarked = displayWorkouts.filter((w) => w.completed);
  const displayComplete = displayWorkouts.filter(w => w.status === "complete" || (w.completed && !w.status));
  const displayPartial = displayWorkouts.filter(w => w.status === "partial");
  const displayMilesCompleted = displayComplete.filter(w => w.type === 'run' || w.type === 'walk').reduce((s, w) => s + convertDist(Number(w.log?.actualMiles) || convertDist(w.miles || 0, w.distanceUnit), "mi"), 0) + displayPartial.filter(w => w.type === 'run' || w.type === 'walk').reduce((s, w) => s + convertDist(Number(w.log?.actualMiles) || 0, "mi"), 0) + (adminStatsFilter === "currentWeek" ? currentWeekClientMiles : adminStatsFilter === "currentPlan" ? planClientAddedMiles : allClientAddedMiles);
  const displayMilesProgrammed = displayWorkouts.filter(w => w.type === 'run' || w.type === 'walk').reduce((s, w) => s + (w.miles ? convertDist(w.miles, w.distanceUnit) : 0), 0);
  const displayAvgRpe = (() => { const withRpe = displayMarked.filter(w => w.log?.rpe); if (withRpe.length === 0) return "—"; return (withRpe.reduce((a, w) => a + Number(w.log!.rpe), 0) / withRpe.length).toFixed(1); })();
  const displayCompletion = displayWorkouts.length > 0 ? Math.round(((displayComplete.length * 1 + displayPartial.length * 0.5) / displayWorkouts.length) * 100) : 0;

  // Save a new week plan (draft or published)
  const handleSaveWeek = async (publishStatus: "draft" | "published") => {
    const client = clients.find(c => c.id === selectedClient);
    if (!client || !client.clientId) {
      alert("Error: No client record found. Please refresh and try again.");
      return;
    }

    // Validate active plan exists
    if (!activePlan) {
      alert("Cannot create a week without an active plan. Go to Account tab to create a plan first.");
      return;
    }

    // Validate week date range falls within plan dates
    if (weekPlan.dateRange && activePlan.startDate && activePlan.endDate) {
      const weekStartStr = weekPlan.dateRange.split(' - ')[0];
      const weekEndStr = weekPlan.dateRange.split(' - ')[1];
      const weekStart = new Date(weekStartStr + ', ' + new Date().getFullYear());
      const weekEnd = new Date(weekEndStr + ', ' + new Date().getFullYear());
      const planStart = new Date(activePlan.startDate);
      const planEnd = new Date(activePlan.endDate);
      
      // Allow 1 day buffer for timezone differences
      planStart.setHours(0, 0, 0, 0);
      planEnd.setHours(23, 59, 59, 999);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(0, 0, 0, 0);

      if (weekStart < planStart || weekEnd > planEnd) {
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        alert(`This week (${weekPlan.dateRange}) falls outside the active plan dates (${fmt(planStart)} – ${fmt(planEnd)}). Please select a week within the plan period, or update the plan dates in the Account tab.`);
        return;
      }
    }

    // Validate mandatory fields for types with subtypes
    for (const day of weekPlan.days) {
      for (const w of day.workouts) {
        if (w.type === 'run' || w.type === 'walk') {
          if (!w.trainingType) {
            alert(`${day.day}: ${w.type === 'run' ? 'Run' : 'Walk'} type requires a subtype to be selected.`);
            return;
          }
          if (!w.miles) {
            alert(`${day.day}: ${w.type === 'run' ? 'Run' : 'Walk'} type requires distance (miles/km) to be entered.`);
            return;
          }
        }
        if (w.type === 'stretching' && !w.trainingType) {
          alert(`${day.day}: Stretching type requires a subtype to be selected (Foam Roll, Stretching, or Yoga).`);
          return;
        }
      }
    }

    const workouts = weekPlan.days.flatMap((day) => 
      day.workouts.map((w) => ({
        day: day.day,
        type: w.type,
        trainingType: w.trainingType || null,
        title: w.title || null,
        miles: w.miles || null,
        description: w.description || null,
        paceTarget: w.paceTarget || null,
        location: w.location || null,
        coachNotes: w.coachNotes || null,
        distanceUnit: w.distanceUnit || 'mi',
        structure: (w as any).structure || null,
      }))
    );

    try {
      // If editing an existing draft, delete the old one first
      if (editingDraftId) {
        await fetch(`/api/weeks/${editingDraftId}`, { method: 'DELETE' });
      }

      const res = await fetch('/api/weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.clientId,
          dateRange: weekPlan.dateRange,
          focus: weekPlan.focus,
          coachMessage: weekPlan.coachMessage,
          status: publishStatus,
          workouts,
        }),
      });
      if (res.ok) {
        // Reset form
        setWeekPlan({
          dateRange: "", focus: "", coachMessage: "",
          days: [
            { day: "Monday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
            { day: "Tuesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
            { day: "Wednesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
            { day: "Thursday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
            { day: "Friday", workouts: [{ type: "cross", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
            { day: "Saturday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
            { day: "Sunday", workouts: [{ type: "rest", trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] },
          ],
        });
        setSelectedWeekStart(null);
        setEditingDraftId(null);
        setWeekDateWarning("");
        // Refresh weeks
        fetchWeeks(client.clientId);
        if (publishStatus === "published") {
          // Navigate to the published week's offset so it's immediately visible
          const publishedDateStr = weekPlan.dateRange.split(' - ')[0];
          const publishedMonday = new Date(publishedDateStr + ', ' + new Date().getFullYear());
          publishedMonday.setHours(0, 0, 0, 0);
          const today = new Date();
          const dayOfWeek = today.getDay();
          const thisMonday = new Date(today);
          thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          thisMonday.setHours(0, 0, 0, 0);
          const diffDays = Math.round((publishedMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24));
          const targetOffset = Math.round(diffDays / 7);
          setAdminWeekOffset(targetOffset);
          // Expand bounds if needed
          setAdminMinOffset(prev => Math.min(prev, targetOffset));
          setAdminMaxOffset(prev => Math.max(prev, targetOffset));
        }
        setClientTab(publishStatus === "draft" ? "drafts" : "plan");
      }
    } catch (err) {
      console.error('Failed to save week:', err);
    }
  };

  // Publish/unpublish a week via API
  const publishWeek = async (weekId: string) => {
    try {
      const res = await fetch(`/api/weeks/${weekId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (res.ok) {
        const client = clients.find(c => c.id === selectedClient);
        if (client && client.clientId) {
          await fetchWeeks(client.clientId);
        }
      }
    } catch (err) {
      console.error('Failed to publish week:', err);
    }
  };

  const unpublishWeek = async (weekId: string) => {
    try {
      const res = await fetch(`/api/weeks/${weekId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (res.ok) {
        const client = clients.find(c => c.id === selectedClient);
        if (client && client.clientId) fetchWeeks(client.clientId);
      }
    } catch (err) {
      console.error('Failed to unpublish week:', err);
    }
  };

  // Enter edit mode: populate editedWorkouts from current week data
  const enterEditMode = () => {
    if (!selectedWeek) return;
    const workoutEdits: Record<string, { type: string; trainingType: string; miles: string; title: string; description: string; paceTarget: string; location: string; coachNotes: string }> = {};
    const unitEdits: Record<string, "mi" | "km"> = {};
    for (const w of selectedWeek.workouts) {
      workoutEdits[w.id] = {
        type: w.type,
        trainingType: w.trainingType || '',
        miles: w.miles?.toString() || '',
        title: w.title || '',
        description: w.description || '',
        paceTarget: w.paceTarget || '',
        location: w.location || '',
        coachNotes: w.coachNotes || '',
      };
      unitEdits[w.id] = w.distanceUnit || 'mi';
    }
    setEditedWorkouts(workoutEdits);
    setEditDistanceUnits(unitEdits);
    setEditedCoachMessage(selectedWeek.coachMessage || '');
    setEditingWeek(true);
  };

  const updateEditedWorkout = (workoutId: string, field: string, value: string) => {
    setEditedWorkouts(prev => ({
      ...prev,
      [workoutId]: { ...prev[workoutId], [field]: value },
    }));
  };

  // Save all edited workout changes
  const handleSaveEditedWeek = async () => {
    if (!selectedWeek) return;
    // Validate miles for run/walk types
    for (const w of selectedWeek.workouts) {
      const edited = editedWorkouts[w.id];
      if (!edited) continue;
      if ((edited.type === 'run' || edited.type === 'walk') && edited.miles && !/^\d+(\.\d{1,2})?$/.test(edited.miles)) {
        alert(`${w.day}: Distance must be a number with up to 2 decimal places (e.g. 4.34).`);
        return;
      }
    }
    setSavingEdit(true);
    try {
      // Update the week's coach message
      await fetch(`/api/weeks/${selectedWeek.weekId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachMessage: editedCoachMessage }),
      });

      // Update each workout
      const promises = selectedWeek.workouts.map((w) => {
        const edited = editedWorkouts[w.id];
        if (!edited) return Promise.resolve();
        return fetch(`/api/workouts/${w.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: edited.type,
            trainingType: edited.type === 'rest' ? 'Rest' : edited.trainingType,
            miles: edited.miles || null,
            title: edited.title || null,
            description: edited.description || null,
            paceTarget: edited.paceTarget || null,
            location: edited.location || null,
            coachNotes: edited.coachNotes || null,
            distanceUnit: editDistanceUnits[w.id] || 'mi',
          }),
        });
      });
      await Promise.all(promises);

      // Refresh weeks and exit edit mode
      const client = clients.find(c => c.id === selectedClient);
      if (client && client.clientId) {
        await fetchWeeks(client.clientId);
      }
      setEditingWeek(false);
      setEditedWorkouts({});
    } catch (err) {
      console.error('Failed to save week edits:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Edit a draft: populate the Create Week form with draft data and switch to create tab
  const handleEditDraft = (week: WeekData) => {
    setEditingDraftId(week.weekId);
    setWeekPlan({
      dateRange: week.dateRange,
      focus: week.focus,
      coachMessage: week.coachMessage,
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName) => {
        const dayWorkouts = week.workouts.filter(w => w.day === dayName);
        if (dayWorkouts.length === 0) {
          return { day: dayName, workouts: [{ type: 'rest', trainingType: 'Rest', title: '', miles: '', description: '', paceTarget: '', location: '', coachNotes: '', distanceUnit: 'mi' }] };
        }
        return {
          day: dayName,
          workouts: dayWorkouts.map(w => ({
            type: w.type || 'rest',
            trainingType: w.trainingType || '',
            title: w.title || '',
            miles: w.miles?.toString() || '',
            description: w.description || '',
            paceTarget: w.paceTarget || '',
            location: w.location || '',
            coachNotes: w.coachNotes || '',
            distanceUnit: 'mi',
          })),
        };
      }),
    });
    setClientTab('create');
    setTimeout(() => createWeekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  // Delete a draft week
  const handleDeleteDraft = async (weekId: string) => {
    setDeletingWeekId(weekId);
    try {
      const res = await fetch(`/api/weeks/${weekId}`, { method: 'DELETE' });
      if (res.ok) {
        const client = clients.find(c => c.id === selectedClient);
        if (client && client.clientId) {
          await fetchWeeks(client.clientId);
        }
      }
    } catch (err) {
      console.error('Failed to delete week:', err);
    } finally {
      setDeletingWeekId(null);
    }
  };

  const getTrainingTypeLabel = (tt: string) => { switch (tt) { case "ClosePace": return "Close to Race Pace"; case "Easy": return "Easy Run"; case "Fartlek": return "Fartlek"; case "Hills": return "Hill Repeats"; case "Intervals": return "Intervals (Run/Walk)"; case "LongRun": return "Long Run"; case "Progressive": return "Progressive"; case "RacePace": return "Race Pace"; case "Recovery": return "Recovery Run"; case "SpeedRoad": return "Speed Workout - Road"; case "SpeedTrack": return "Speed Workout - Track"; case "Tempo": return "Tempo Runs"; case "Threshold": return "Threshold Runs"; case "TimeTrial": return "Time Trial"; case "Trail": return "Trail"; case "Treadmill": return "Treadmill"; case "WalkRecovery": return "Walk Recovery"; case "WalkPower": return "Walk Power"; case "Stretching": return "Stretching"; case "FoamRoll": return "Foam Roll"; case "Yoga": return "Yoga"; case "CrossTraining": return "Cross Training"; case "OrangeTheory": return "Cross Training"; case "Rest": return "Rest"; default: return tt; } };
  const getTypeBadge = (type: string) => { switch (type) { case "run": return "bg-accent/20 text-accent"; case "cross": return "bg-gold/20 text-gold"; case "rest": return "bg-green-500/20 text-green-400"; case "walk": return "bg-blue-500/20 text-blue-400"; case "cycling": return "bg-cyan-500/20 text-cyan-400"; case "stretching": return "bg-purple-500/20 text-purple-400"; default: return "bg-gray-500/20 text-gray-400"; } };
  const getTypeLabel = (type: string) => { switch (type) { case "cross": return "Cross Training"; case "cycling": return "Cycling"; case "rest": return "Rest"; case "run": return "Run"; case "stretching": return "Stretching"; case "walk": return "Walk"; default: return type; } };
  const getTrainingTypeBadge = (tt: string) => { switch (tt) { case "SpeedRoad": case "SpeedTrack": return "bg-red-500/20 text-red-400 border-red-500/30"; case "Tempo": case "Threshold": return "bg-orange-500/20 text-orange-400 border-orange-500/30"; case "LongRun": case "Easy": case "Recovery": case "Treadmill": case "Progressive": case "Trail": return "bg-blue-500/20 text-blue-400 border-blue-500/30"; case "Hills": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; case "RacePace": case "ClosePace": return "bg-green-500/20 text-green-300 border-green-500/30"; case "Intervals": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"; case "TimeTrial": case "Fartlek": return "bg-red-500/20 text-red-300 border-red-500/30"; case "WalkRecovery": case "WalkPower": return "bg-blue-500/20 text-blue-300 border-blue-500/30"; case "Stretching": case "FoamRoll": case "Yoga": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; case "CrossTraining": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"; } };

  return (
    <div className="min-h-screen bg-primary md:flex">
      {/* LEFT SIDEBAR - Client List (full screen on mobile, sidebar on desktop) */}
      <aside className={`${selectedClient ? "hidden md:flex" : "flex"} w-full md:w-72 bg-secondary/50 md:border-r border-white/10 flex-col h-screen md:sticky md:top-0`}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Image src="/IMG_5861.PNG" alt="Logo" width={56} height={56} className="rounded-full" />
            <div><p className="text-white font-heading text-sm uppercase">Coach Admin</p><p className="text-gold text-xs">{loggedInUser || "Loading..."}</p></div>
          </div>
          <input type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients..." className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent mb-2" />
          <div className="flex gap-1 mb-2">
            {[{ key: "active", label: "Active" }, { key: "archived", label: "Archived" }, { key: "all", label: "All" }].map((f) => (
              <button key={f.key} onClick={() => setClientFilter(f.key as "active" | "archived" | "all")} className={`px-2 py-1 rounded text-xs transition-colors flex-1 ${clientFilter === f.key ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>{f.label}</button>
            ))}
          </div>
          <button onClick={() => setShowCreateClient(!showCreateClient)} className="w-full bg-accent hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">+ New Client</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Primary clients (this coach is the default) */}
          {(() => {
            const primaryClients = filteredClients.filter(c => c.coaches.some(cc => cc.coachId === loggedInUserId && cc.isDefault));
            const secondaryClients = filteredClients.filter(c => c.coaches.some(cc => cc.coachId === loggedInUserId && !cc.isDefault));
            const otherClients = filteredClients.filter(c => !c.coaches.some(cc => cc.coachId === loggedInUserId));
            const showSecondary = allCoaches.length > 1 && (secondaryClients.length > 0 || otherClients.length > 0);
            return (
              <>
                {primaryClients.length > 0 && (
                  <div className="px-4 py-1.5 bg-primary/30 border-b border-white/5">
                    <p className="text-gold text-[10px] font-heading uppercase tracking-wider">My Clients ({primaryClients.length})</p>
                  </div>
                )}
                {primaryClients.map((client) => {
            const isSelected = selectedClient === client.id;
            return (
              <button key={client.id} onClick={() => { setSelectedClient(client.id); setAdminWeekOffset(0); setClientTab("plan"); setEditingWeek(false); setShowTemplatesView(false); setShowNotificationSettings(false); setShowChangelog(false); setAdminStatsFilter("currentWeek"); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 ${isSelected ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-white/5"}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden relative ${isSelected ? "" : ""}`}>
                  {client.gender === "female" ? (
                    <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#4a3060"/><circle cx="18" cy="13" r="6" fill="#d4a0c0"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#d4a0c0"/><circle cx="18" cy="13" r="4.5" fill="#f0d0e0"/><path d="M13.5 10c0 0 1-3 4.5-3s4.5 3 4.5 3" stroke="#4a3060" strokeWidth="1.5" fill="none"/></svg>
                  ) : (
                    <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#2d4a5a"/><circle cx="18" cy="13" r="6" fill="#a0c4d4"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#a0c4d4"/><circle cx="18" cy="13" r="4.5" fill="#d0e8f0"/><path d="M12 11h12v2c0 1-2 2-6 2s-6-1-6-2v-2z" fill="#2d4a5a" opacity="0.5"/></svg>
                  )}
                  {client.stravaProfileUrl && <img src={client.stravaProfileUrl} alt={client.name} className="w-8 h-8 rounded-full object-cover absolute inset-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white text-xs font-medium truncate">{client.name}</p>
                    {client.stravaConnected && <svg className="w-3 h-3 text-orange-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>}
                  </div>
                  <p className="text-gray-300 text-xs truncate">
                    {client.inviteStatus !== "accepted" 
                      ? <span className={client.inviteStatus === "pending" ? "text-blue-400" : "text-red-400"}>{client.inviteStatus === "pending" ? "Invite pending" : "Invite expired"}</span>
                      : client.goal 
                        ? client.goal 
                        : <span className="text-yellow-400">No active plan</span>
                    }
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {unreadByClient[client.id] > 0 && (
                    <span className="bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center mb-0.5">{unreadByClient[client.id]}</span>
                  )}
                </div>
              </button>
            );
          })}
                {showSecondary && secondaryClients.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-primary/30 border-b border-white/5 mt-1">
                      <p className="text-purple-400 text-[10px] font-heading uppercase tracking-wider">Secondary Coach ({secondaryClients.length})</p>
                    </div>
                    {secondaryClients.map((client) => {
                      const isSelected = selectedClient === client.id;
                      return (
                        <button key={client.id} onClick={() => { setSelectedClient(client.id); setAdminWeekOffset(0); setClientTab("plan"); setEditingWeek(false); setShowTemplatesView(false); setShowNotificationSettings(false); setShowChangelog(false); setAdminStatsFilter("currentWeek"); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 ${isSelected ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-white/5"}`}>
                          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden relative">
                            {client.gender === "female" ? (
                              <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#4a3060"/><circle cx="18" cy="13" r="6" fill="#d4a0c0"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#d4a0c0"/><circle cx="18" cy="13" r="4.5" fill="#f0d0e0"/><path d="M13.5 10c0 0 1-3 4.5-3s4.5 3 4.5 3" stroke="#4a3060" strokeWidth="1.5" fill="none"/></svg>
                            ) : (
                              <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#2d4a5a"/><circle cx="18" cy="13" r="6" fill="#a0c4d4"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#a0c4d4"/><circle cx="18" cy="13" r="4.5" fill="#d0e8f0"/><path d="M12 11h12v2c0 1-2 2-6 2s-6-1-6-2v-2z" fill="#2d4a5a" opacity="0.5"/></svg>
                            )}
                            {client.stravaProfileUrl && <img src={client.stravaProfileUrl} alt={client.name} className="w-8 h-8 rounded-full object-cover absolute inset-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-white text-xs font-medium truncate">{client.name}</p>
                              {client.stravaConnected && <svg className="w-3 h-3 text-orange-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>}
                            </div>
                            <p className="text-gray-300 text-xs truncate">
                              {client.inviteStatus !== "accepted" 
                                ? <span className={client.inviteStatus === "pending" ? "text-blue-400" : "text-red-400"}>{client.inviteStatus === "pending" ? "Invite pending" : "Invite expired"}</span>
                                : client.goal ? client.goal : <span className="text-yellow-400">No active plan</span>
                              }
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {unreadByClient[client.id] > 0 && (
                              <span className="bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center mb-0.5">{unreadByClient[client.id]}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
                {showSecondary && otherClients.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-primary/30 border-b border-white/5 mt-1">
                      <p className="text-gray-500 text-[10px] font-heading uppercase tracking-wider">Other Clients ({otherClients.length})</p>
                    </div>
                    {otherClients.map((client) => {
                      const isSelected = selectedClient === client.id;
                      return (
                        <button key={client.id} onClick={() => { setSelectedClient(client.id); setAdminWeekOffset(0); setClientTab("plan"); setEditingWeek(false); setShowTemplatesView(false); setShowNotificationSettings(false); setShowChangelog(false); setAdminStatsFilter("currentWeek"); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 opacity-60 ${isSelected ? "bg-accent/10 border-l-2 border-l-accent opacity-100" : "hover:bg-white/5"}`}>
                          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden relative">
                            {client.gender === "female" ? (
                              <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#4a3060"/><circle cx="18" cy="13" r="6" fill="#d4a0c0"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#d4a0c0"/><circle cx="18" cy="13" r="4.5" fill="#f0d0e0"/><path d="M13.5 10c0 0 1-3 4.5-3s4.5 3 4.5 3" stroke="#4a3060" strokeWidth="1.5" fill="none"/></svg>
                            ) : (
                              <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#2d4a5a"/><circle cx="18" cy="13" r="6" fill="#a0c4d4"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#a0c4d4"/><circle cx="18" cy="13" r="4.5" fill="#d0e8f0"/><path d="M12 11h12v2c0 1-2 2-6 2s-6-1-6-2v-2z" fill="#2d4a5a" opacity="0.5"/></svg>
                            )}
                            {client.stravaProfileUrl && <img src={client.stravaProfileUrl} alt={client.name} className="w-8 h-8 rounded-full object-cover absolute inset-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-white text-xs font-medium truncate">{client.name}</p>
                            </div>
                            <p className="text-gray-300 text-xs truncate">
                              {client.inviteStatus !== "accepted" 
                                ? <span className={client.inviteStatus === "pending" ? "text-blue-400" : "text-red-400"}>{client.inviteStatus === "pending" ? "Invite pending" : "Invite expired"}</span>
                                : client.goal ? client.goal : <span className="text-yellow-400">No active plan</span>
                              }
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}
        </div>
        <div className="p-3 border-t border-white/10 space-y-2">
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(false); setShowTemplatesView(false); setShowChangelog(true); setShowManageCoaches(false); setShowNewUpdatesBadge(false); localStorage.setItem("changelog_last_seen", "2026-06-25T01:00:00Z"); }} className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors ${showChangelog && !selectedClient ? "text-green-400" : "text-gray-400 hover:text-white"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            What&apos;s New
            {showNewUpdatesBadge && <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto">NEW</span>}
          </button>
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(false); setShowTemplatesView(true); setShowChangelog(false); setShowManageCoaches(false); }} className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors ${showTemplatesView && !selectedClient ? "text-gold" : "text-gray-400 hover:text-white"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            Templates ({templates.length})
          </button>
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(true); setShowTemplatesView(false); setShowChangelog(false); setShowManageCoaches(false); }} className="w-full flex items-center gap-2 text-gray-400 hover:text-white text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Account Preferences
          </button>
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(false); setShowTemplatesView(false); setShowChangelog(false); setShowManageCoaches(true); }} className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors ${showManageCoaches && !selectedClient ? "text-purple-400" : "text-gray-400 hover:text-white"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Manage Coaches ({allCoaches.length})
          </button>
          <a href="/auth/signout" className="w-full flex items-center gap-2 text-gray-400 hover:text-accent text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>Logout</a>
        </div>
      </aside>

      {/* MAIN CONTENT (full screen on mobile when client selected) */}
      <main className={`${!selectedClient ? "hidden md:block" : "block"} flex-1 min-h-screen overflow-y-auto`}>
        {/* Back to Dashboard Button */}
        {selectedClient && (
          <button onClick={() => setSelectedClient(null)} className="flex items-center gap-2 px-4 py-3 text-gray-400 hover:text-white border-b border-white/10 w-full bg-secondary/30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm">Back to Dashboard</span>
          </button>
        )}
        {/* Create Client Modal */}
        {showCreateClient && (
          <div className="p-6 bg-secondary/30 border-b border-white/10">
            <h3 className="font-heading text-lg uppercase text-accent mb-4">Create New Client Account</h3>
            <p className="text-gray-400 text-xs mb-4">This will send an invite email. Once they accept, create a plan for them in the Account tab to set their goal, dates, and payment.</p>
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div><label className="text-gray-400 text-xs block mb-1">Full Name <span className="text-accent">*</span></label><input type="text" value={newClientForm.name} onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Sarah Miller" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Email <span className="text-accent">*</span></label><input type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="client@email.com" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Gender <span className="text-accent">*</span></label><select value={newClientForm.gender} onChange={(e) => setNewClientForm({ ...newClientForm, gender: e.target.value as "female" | "male" })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"><option value="female">Female</option><option value="male">Male</option></select></div>
              <div><label className="text-gray-400 text-xs block mb-1">Birthday <span className="text-accent">*</span></label><input type="date" value={newClientForm.birthday} onChange={(e) => setNewClientForm({ ...newClientForm, birthday: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent [color-scheme:dark]" /></div>
            </div>
            <div className="flex gap-3"><button onClick={handleCreateClient} disabled={createLoading || !newClientForm.name || !newClientForm.email || !newClientForm.birthday} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">{createLoading ? "Creating..." : "Create Account & Send Invite"}</button><button onClick={() => setShowCreateClient(false)} className="text-gray-400 hover:text-white text-sm">Cancel</button></div>
            {createError && <p role="alert" className="text-red-400 text-xs mt-2">{createError}</p>}
          </div>
        )}

        {selectedClientData ? (
          <div className="p-6 space-y-6">
            {/* Client Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 relative">
                  {selectedClientData.gender === "female" ? (
                    <svg className="w-10 h-10" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#4a3060"/><circle cx="18" cy="13" r="6" fill="#d4a0c0"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#d4a0c0"/><circle cx="18" cy="13" r="4.5" fill="#f0d0e0"/><path d="M13.5 10c0 0 1-3 4.5-3s4.5 3 4.5 3" stroke="#4a3060" strokeWidth="1.5" fill="none"/></svg>
                  ) : (
                    <svg className="w-10 h-10" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#2d4a5a"/><circle cx="18" cy="13" r="6" fill="#a0c4d4"/><path d="M8 32c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#a0c4d4"/><circle cx="18" cy="13" r="4.5" fill="#d0e8f0"/><path d="M12 11h12v2c0 1-2 2-6 2s-6-1-6-2v-2z" fill="#2d4a5a" opacity="0.5"/></svg>
                  )}
                  {selectedClientData.stravaProfileUrl && <img src={selectedClientData.stravaProfileUrl} alt={selectedClientData.name} className="w-10 h-10 rounded-full object-cover absolute inset-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                </div>
                <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-heading text-2xl uppercase text-white">{selectedClientData.name}</h2>
                  {/* Coaches badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedClientData.coaches.map(coach => (
                      <span key={coach.coachId} className={`text-xs px-2 py-0.5 rounded-full border ${coach.isDefault ? 'bg-gold/20 border-gold/40 text-gold' : 'bg-purple-500/10 border-purple-500/30 text-purple-300'}`}>
                        {coach.coachName.split(' ')[0]}{coach.isDefault ? ' ★' : ''}
                      </span>
                    ))}
                    {/* Add coach button */}
                    <div className="relative">
                      <button onClick={() => setShowCoachDropdown(!showCoachDropdown)} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-colors">+</button>
                      {showCoachDropdown && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-secondary border border-white/10 rounded-lg shadow-xl p-2 min-w-56">
                          <p className="text-gray-400 text-xs font-heading uppercase mb-2 px-2">Manage Coaches</p>
                          {/* Current coaches with remove/default options */}
                          {selectedClientData.coaches.length > 0 && (
                            <div className="mb-2 pb-2 border-b border-white/5">
                              {selectedClientData.coaches.map(coach => (
                                <div key={coach.coachId} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs ${coach.isDefault ? 'text-gold font-medium' : 'text-gray-300'}`}>{coach.coachName}</span>
                                    {coach.isDefault && <span className="text-[10px] text-gold bg-gold/10 px-1.5 rounded">Default</span>}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {!coach.isDefault && (
                                      <button onClick={() => handleSetDefaultCoach(coach.coachId)} className="text-[10px] text-gray-400 hover:text-gold px-1.5 py-0.5 rounded border border-white/10 hover:border-gold/30">Set Default</button>
                                    )}
                                    {selectedClientData.coaches.length > 1 && (
                                      <button onClick={() => handleRemoveCoach(coach.coachId)} className="text-[10px] text-gray-400 hover:text-red-400 px-1.5 py-0.5 rounded border border-white/10 hover:border-red-500/30">Remove</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Available coaches to add */}
                          {allCoaches.filter(c => !selectedClientData.coaches.some(cc => cc.coachId === c.id)).length > 0 && (
                            <>
                              <p className="text-gray-500 text-[10px] uppercase px-2 mb-1">Add Coach</p>
                              {allCoaches.filter(c => !selectedClientData.coaches.some(cc => cc.coachId === c.id)).map(coach => (
                                <button key={coach.id} onClick={() => handleAssignCoach(coach.id)} disabled={coachAssigning} className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-accent/10 rounded transition-colors disabled:opacity-50">
                                  + {coach.name}
                                </button>
                              ))}
                            </>
                          )}
                          {allCoaches.filter(c => !selectedClientData.coaches.some(cc => cc.coachId === c.id)).length === 0 && selectedClientData.coaches.length > 0 && (
                            <p className="text-gray-500 text-xs px-2 py-1">All coaches assigned</p>
                          )}
                          <button onClick={() => setShowCoachDropdown(false)} className="w-full text-center text-gray-500 hover:text-white text-xs mt-2 pt-2 border-t border-white/5 py-1">Close</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm">
                  {selectedClientData.inviteStatus !== "accepted"
                    ? <span className={selectedClientData.inviteStatus === "pending" ? "text-blue-400" : "text-red-400"}>{selectedClientData.inviteStatus === "pending" ? "Invite pending" : "Invite expired"}</span>
                    : selectedClientData.goal
                      ? <span className="text-gray-400">{selectedClientData.goal}</span>
                      : <span className="text-yellow-400">No active plan</span>
                  }
                </p>
              </div>
              </div>
              {draftWeeks.length > 0 && <div className="text-center"><p className="text-yellow-400 font-heading text-xl">{draftWeeks.length}</p><p className="text-gray-300 text-xs">Drafts</p></div>}
            </div>

            {/* Stats Card (mirrors client dashboard layout) */}
            <div className="bg-secondary/30 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm uppercase text-gray-400">Stats</h3>
                <div className="flex gap-1">
                  <button onClick={() => setAdminStatsFilter("currentWeek")} className={`px-3 py-1 rounded text-xs ${adminStatsFilter === "currentWeek" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>This Week</button>
                  <button onClick={() => setAdminStatsFilter("currentPlan")} className={`px-3 py-1 rounded text-xs ${adminStatsFilter === "currentPlan" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>Current Plan</button>
                  <button onClick={() => setAdminStatsFilter("allTime")} className={`px-3 py-1 rounded text-xs ${adminStatsFilter === "allTime" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>All Time</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="text-center"><p className="font-heading text-xl text-accent">{displayMilesProgrammed > 0 ? displayMilesCompleted.toFixed(2) : "—"}<span className="text-gray-300 text-sm">/{displayMilesProgrammed > 0 ? displayMilesProgrammed.toFixed(2) : "—"}</span></p><p className="text-gray-300 text-xs">{distUnitLabel}</p></div>
                <div className="text-center"><p className="font-heading text-xl text-white">{displayMarked.length}/{displayWorkouts.length}</p><p className="text-gray-300 text-xs">Programmed Workouts</p></div>
                <div className="text-center"><p className="font-heading text-xl text-cyan-400">{(selectedWeek?.clientWorkouts || []).length}</p><p className="text-gray-300 text-xs">Client Workouts</p></div>
                <div className="text-center"><p className="font-heading text-xl text-gold">{displayAvgRpe}</p><p className="text-gray-300 text-xs">Avg Effort</p></div>
                <div className="text-center"><p className="font-heading text-xl text-green-400">{displayCompletion}%</p><p className="text-gray-300 text-xs">Completion</p></div>
              </div>
            </div>

            {/* Invite Status Banner */}
            {selectedClientData.inviteStatus !== "accepted" && (
              <div className={`flex items-center justify-between rounded-xl p-4 ${selectedClientData.inviteStatus === "pending" ? "bg-blue-500/10 border border-blue-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                <div className="flex items-center gap-3">
                  {selectedClientData.inviteStatus === "pending" ? (
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  )}
                  <div>
                    <p className={`text-sm font-medium ${selectedClientData.inviteStatus === "pending" ? "text-blue-400" : "text-red-400"}`}>
                      {selectedClientData.inviteStatus === "pending" ? "Invite Pending" : "Invite Expired"}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {selectedClientData.inviteStatus === "pending" 
                        ? `Invite sent to ${selectedClientData.email}. Waiting for them to set their password.`
                        : `The invite link sent to ${selectedClientData.email} has expired. Resend to give them a new link.`
                      }
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => handleResendInvite(selectedClientData.id)} 
                  disabled={resendingInvite}
                  className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-xs disabled:opacity-50 flex-shrink-0"
                >
                  {resendingInvite ? "Sending..." : resendSuccess ? "Sent ✓" : "Resend Invite"}
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 flex-wrap">
              {[{ key: "plan", label: "Training & Logs" }, { key: "create", label: "Create Week" }, { key: "drafts", label: `Drafts (${draftWeeks.length})` }, { key: "messages", label: "Messages" }, { key: "account", label: "Account" }].map((tab) => (
                <button key={tab.key} onClick={() => { setClientTab(tab.key as typeof clientTab); setEditingWeek(false); if (tab.key === "messages" && selectedClient) { setUnreadByClient(prev => ({ ...prev, [selectedClient]: 0 })); setTotalUnread(prev => prev - (unreadByClient[selectedClient] || 0)); } }} className={`px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-colors relative ${clientTab === tab.key ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                  {tab.label}
                  {tab.key === "messages" && selectedClient && unreadByClient[selectedClient] > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadByClient[selectedClient]}</span>
                  )}
                </button>
              ))}
            </div>

            {/* TRAINING & LOGS */}
            {clientTab === "plan" && (
              <div className="space-y-6">
                {/* Go to current week link (only when not on current week) */}
                {adminWeekOffset !== 0 && (
                  <div className={adminWeekOffset < 0 ? "text-right" : "text-left"}>
                    <button onClick={() => setAdminWeekOffset(0)} className="text-accent text-xs hover:underline">{adminWeekOffset < 0 ? "Go to current week →" : "← Go to current week"}</button>
                  </div>
                )}

                {/* Week Navigation */}
                <div className="flex items-center justify-between">
                  <button onClick={() => setAdminWeekOffset(adminWeekOffset - 1)} aria-label="Previous week" disabled={adminWeekOffset <= adminMinOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                  <div className="text-center">
                    {adminWeekOffset === 0 && <span className="inline-block bg-accent/10 border border-accent/30 rounded py-0.5 px-3 text-accent font-heading text-xs uppercase mb-1">Current Week</span>}
                    <p className="font-heading text-lg uppercase text-white">{getAdminWeekLabel(adminWeekOffset)}</p>
                    {selectedWeek && <p className="text-gray-400 text-xs">{selectedWeek.focus}{selectedWeek.focus && ' — '}<span className="text-white font-medium">{selectedWeek.workouts.reduce((s, w) => s + (w.miles ? convertDist(w.miles, w.distanceUnit) : 0), 0).toFixed(2)} {distUnitShort}</span></p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedWeek && adminWeekOffset >= 0 && <button onClick={() => { if (editingWeek) { setEditingWeek(false); setEditedWorkouts({}); } else { enterEditMode(); } }} className="text-accent text-xs hover:underline">{editingWeek ? "Cancel Edit" : "Edit Week"}</button>}
                    {selectedWeek && adminWeekOffset < 0 && <span className="text-gray-400 text-xs italic">Past week (locked)</span>}
                    <button onClick={() => setAdminWeekOffset(adminWeekOffset + 1)} aria-label="Next week" disabled={adminWeekOffset >= adminMaxOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                  </div>
                </div>

                {/* No plan for this week */}
                {!selectedWeek && (
                  <div className="text-center py-8 bg-secondary/30 border border-white/10 rounded-xl">
                    <p className="text-gray-500">No published plan for this week.</p>
                    <p className="text-gray-400 text-xs mt-1">Create a week plan or navigate to a week that has one.</p>
                  </div>
                )}

                {/* Has a plan — show content */}
                {selectedWeek && (
                  <>

                {/* Coach Message */}
                <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                  <p className="text-gold text-xs font-heading uppercase mb-1">Weekly Message</p>
                  {editingWeek ? <textarea value={editedCoachMessage} onChange={(e) => setEditedCoachMessage(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none" rows={2} /> : <p className="text-gray-300 text-sm">{selectedWeek?.coachMessage || <span className="text-gray-600 italic">No message</span>}</p>}
                </div>

                {/* Workouts */}
                <div className="space-y-3">
                  {/* Expand/Collapse All */}
                  <div className="flex justify-end mb-2">
                    <button onClick={() => { const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']; const newState: Record<string,boolean> = {}; allDays.forEach(d => newState[d] = true); setAdminExpandedDays(newState); }} className="text-gray-400 hover:text-white text-xs mr-2">Expand All</button>
                    <button onClick={() => { const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']; const newState: Record<string,boolean> = {}; allDays.forEach(d => newState[d] = false); setAdminExpandedDays(newState); }} className="text-gray-400 hover:text-white text-xs">Collapse All</button>
                  </div>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const dayWorkouts = selectedWeek?.workouts.filter(w => w.day === day) || [];
                    const dayClientWorkouts = (selectedWeek?.clientWorkouts || []).filter(cw => cw.day === day);
                    if (dayWorkouts.length === 0 && dayClientWorkouts.length === 0) return null;
                    const totalWorkouts = dayWorkouts.filter(w => w.type !== 'rest').length + dayClientWorkouts.length;
                    const daySummary = dayWorkouts.map(w => w.title || getTypeLabel(w.type)).join(', ');
                    const dayMiles = dayWorkouts.reduce((s, w) => s + (w.miles || 0), 0);
                    const isAdminDayExpanded = adminExpandedDays[day] ?? adminDefaultExpanded;
                    const adminDayIndex = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(day);
                    const adminWeekStart = getAdminMondayForOffset(adminWeekOffset);
                    const adminDayDate = new Date(adminWeekStart);
                    adminDayDate.setDate(adminWeekStart.getDate() + adminDayIndex);
                    const adminDayDateStr = adminDayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                    return (
                      <div key={day} className="border border-white/10 rounded-xl overflow-hidden">
                        <button aria-expanded={isAdminDayExpanded} onClick={() => setAdminExpandedDays(prev => ({ ...prev, [day]: !isAdminDayExpanded }))} className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left">
                          <div>
                            <span className="text-white font-heading uppercase text-sm">{day}</span>
                            <span className="text-gray-300 text-xs ml-2">{adminDayDateStr}</span>
                            {!isAdminDayExpanded && <span className="text-gray-400 text-xs ml-3">{daySummary}{dayMiles > 0 ? ` • ${convertDist(dayMiles).toFixed(1)} ${distUnitShort}` : ''}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300 text-xs">{totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''}</span>
                            <svg aria-hidden="true" className={`w-4 h-4 text-gray-400 transition-transform ${isAdminDayExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </button>
                        {isAdminDayExpanded && (
                        <div className="p-3 space-y-3">
                        {dayWorkouts.map((w, wi) => (
                    <div key={w.id} className="bg-primary/30 border border-white/5 rounded-xl p-4">
                      {(!editingWeek || w.completed) ? (
                        <>
                          <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${w.status === "complete" ? "bg-green-500 border-green-500" : w.status === "partial" ? "bg-yellow-500 border-yellow-500" : w.status === "skipped" ? "bg-red-500 border-red-500" : w.completed ? "bg-green-500 border-green-500" : "border-gray-500"}`}>
                              {(w.status === "complete" || (w.completed && !w.status)) && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              {w.status === "partial" && <span className="text-white text-xs font-bold">½</span>}
                              {w.status === "skipped" && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-medium text-sm">{w.day}</span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Programmed</span>
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(w.type)}`}>{getTypeLabel(w.type)}</span>
                                {w.type === "run" && w.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(w.trainingType)}`}>{getTrainingTypeLabel(w.trainingType)}</span>}
                                {w.stravaSynced && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>{w.stravaActivityName || 'Synced'}</span>}
                              </div>
                              <p className="text-gray-300 text-sm mt-0.5">{(w as any).structure ? formatStructureForDisplay((w as any).structure) : `${w.title || ''}${w.description ? ` — ${w.description}` : ''}`}</p>
                              {w.paceTarget && <p className="text-accent text-xs mt-0.5">{w.paceTarget}</p>}
                            </div>
                            {w.miles && <div className="flex items-baseline gap-1.5 flex-shrink-0">
                              {w.completed && w.log?.actualMiles ? (
                                <>
                                  <span className="text-green-400 font-heading text-lg">{convertDist(Number(w.log.actualMiles))}</span>
                                  <span className="text-gray-500 text-xs">/ {convertDist(w.miles, w.distanceUnit)} {distUnitShort}</span>
                                </>
                              ) : (
                                <span className="text-white font-heading text-lg">{convertDist(w.miles, w.distanceUnit)}<span className="text-gray-300 text-xs ml-0.5">{distUnitShort}</span></span>
                              )}
                            </div>}
                          </div>
                          {w.log && (
                            <div className="mt-2 ml-10">
                              <div className="flex flex-wrap gap-1.5">
                                {w.log.rpe && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">RPE</span> <span className="text-white font-medium">{w.log.rpe}/10</span></span>}
                                {w.log.actualMiles && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">{distUnitShort}</span> <span className="text-white font-medium">{convertDist(Number(w.log.actualMiles))}</span></span>}
                                {w.log.actualPace && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Pace</span> <span className="text-white font-medium">{w.log.actualPace}</span></span>}
                                {w.log.duration && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Dur</span> <span className="text-white font-medium">{w.log.duration}</span></span>}
                                {w.log.avgHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">HR</span> <span className="text-red-400 font-medium">{w.log.avgHeartrate}</span></span>}
                                {w.log.maxHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Max</span> <span className="text-red-400 font-medium">{w.log.maxHeartrate}</span></span>}
                                {w.log.sleep && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Sleep</span> <span className="text-white font-medium">{w.log.sleep}/10</span></span>}
                                {w.log.stress && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Stress</span> <span className="text-white font-medium">{w.log.stress}</span></span>}
                                {w.log.onPeriod === "yes" && <span className="text-xs bg-pink-500/10 rounded px-2 py-1 text-pink-400 font-medium">On Period</span>}
                              </div>
                              {w.log.notes && !w.log.notes.startsWith('Synced from Strava:') && <p className="text-gray-400 text-xs mt-1.5">{w.log.notes}</p>}
                              {w.skipReason && <p className="text-yellow-400 text-xs mt-1.5"><span className="font-medium">{w.status === "skipped" ? "Skipped:" : "Partial:"}</span> {w.skipReason}</p>}
                            </div>
                          )}
                          {editingWeek && w.completed && (
                            <p className="text-gray-400 text-xs mt-2 italic">This workout has been completed and cannot be edited.</p>
                          )}
                          {/* Workout Comments Thread */}
                          {w.completed && (
                            <div className="mt-3 ml-7 pl-4 border-l-2 border-purple-500/30">
                              {(workoutComments[w.id] || []).map(c => (
                                <div key={c.id} className={`mb-2 ${c.isCoach ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-primary/30 border border-white/5'} rounded-lg p-2`}>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-xs font-bold ${c.isCoach ? 'text-purple-400' : 'text-accent'}`}>{c.userName}</span>
                                    <span className="text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  </div>
                                  <p className="text-gray-300 text-xs">{c.message}</p>
                                </div>
                              ))}
                              <div className="flex gap-2 mt-2">
                                <input type="text" value={commentInput[w.id] || ''} onChange={(e) => setCommentInput(prev => ({ ...prev, [w.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSendWorkoutComment(w.id); }} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="Add a comment on this workout..." />
                                <button onClick={() => handleSendWorkoutComment(w.id)} disabled={sendingComment === w.id || !commentInput[w.id]?.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs disabled:opacity-50">{sendingComment === w.id ? '...' : 'Send'}</button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        /* EDIT MODE - full workout editing */
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-white font-heading text-sm uppercase w-24">{w.day}</span>
                            <select value={editedWorkouts[w.id]?.type || w.type} onChange={(e) => { const newType = e.target.value; updateEditedWorkout(w.id, 'type', newType); if (newType === 'rest') { updateEditedWorkout(w.id, 'trainingType', 'Rest'); updateEditedWorkout(w.id, 'miles', ''); updateEditedWorkout(w.id, 'title', ''); updateEditedWorkout(w.id, 'description', ''); updateEditedWorkout(w.id, 'paceTarget', ''); } else if (newType !== 'run' && newType !== 'walk') { updateEditedWorkout(w.id, 'trainingType', ''); updateEditedWorkout(w.id, 'miles', ''); updateEditedWorkout(w.id, 'title', ''); updateEditedWorkout(w.id, 'description', ''); updateEditedWorkout(w.id, 'paceTarget', ''); } else { updateEditedWorkout(w.id, 'trainingType', ''); updateEditedWorkout(w.id, 'title', ''); updateEditedWorkout(w.id, 'description', ''); updateEditedWorkout(w.id, 'paceTarget', ''); updateEditedWorkout(w.id, 'miles', ''); } }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent">
                              <option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                            </select>
                            {(editedWorkouts[w.id]?.type || w.type) === "run" && (
                              <>
                                <select value={editedWorkouts[w.id]?.trainingType || ''} onChange={(e) => updateEditedWorkout(w.id, 'trainingType', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent">
                                  <option value="" disabled>Select Run Type *</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals (Run/Walk)</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery Run</option><option value="SpeedRoad">Speed Workout - Road</option><option value="SpeedTrack">Speed Workout - Track</option><option value="Tempo">Tempo Runs</option><option value="Threshold">Threshold Runs</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                                </select>
                                <div className="flex items-center gap-1"><input type="text" value={editedWorkouts[w.id]?.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) updateEditedWorkout(w.id, 'miles', v); }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Dist *" /><button type="button" onClick={() => setEditDistanceUnits(prev => ({ ...prev, [w.id]: (prev[w.id] || "mi") === "km" ? "mi" : "km" }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold hover:border-accent"><span className={(editDistanceUnits[w.id] || "mi") === "km" ? "text-accent" : "text-white"}>{(editDistanceUnits[w.id] || "mi") === "km" ? "km" : "mi"}</span></button><input type="text" value={editedWorkouts[w.id]?.paceTarget || ''} onChange={(e) => updateEditedWorkout(w.id, 'paceTarget', e.target.value)} className="w-20 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder={`Pace /${(editDistanceUnits[w.id] || "mi")}`} /></div>
                              </>
                            )}
                            {(editedWorkouts[w.id]?.type || w.type) === "walk" && (
                              <>
                                <select value={editedWorkouts[w.id]?.trainingType || ''} onChange={(e) => updateEditedWorkout(w.id, 'trainingType', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent">
                                  <option value="" disabled>Walk Type *</option><option value="WalkPower">Walk Power</option><option value="WalkRecovery">Walk Recovery</option>
                                </select>
                                <div className="flex items-center gap-1"><input type="text" value={editedWorkouts[w.id]?.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) updateEditedWorkout(w.id, 'miles', v); }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Dist *" /><button type="button" onClick={() => setEditDistanceUnits(prev => ({ ...prev, [w.id]: (prev[w.id] || "mi") === "km" ? "mi" : "km" }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold hover:border-accent"><span className={(editDistanceUnits[w.id] || "mi") === "km" ? "text-accent" : "text-white"}>{(editDistanceUnits[w.id] || "mi") === "km" ? "km" : "mi"}</span></button><input type="text" value={editedWorkouts[w.id]?.paceTarget || ''} onChange={(e) => updateEditedWorkout(w.id, 'paceTarget', e.target.value)} className="w-20 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder={`Pace /${(editDistanceUnits[w.id] || "mi")}`} /></div>
                              </>
                            )}
                          </div>
                          {(editedWorkouts[w.id]?.type || w.type) !== "rest" && (
                            <div className="grid md:grid-cols-2 gap-2">
                              <input type="text" value={editedWorkouts[w.id]?.title || ''} onChange={(e) => updateEditedWorkout(w.id, 'title', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Title" />
                              <input type="text" value={editedWorkouts[w.id]?.description || ''} onChange={(e) => updateEditedWorkout(w.id, 'description', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Description" />
                            </div>
                          )}
                          {((editedWorkouts[w.id]?.type || w.type) === "run" || (editedWorkouts[w.id]?.type || w.type) === "walk") && (
                            <div className="grid md:grid-cols-2 gap-2">
                              <input type="text" value={editedWorkouts[w.id]?.location || ''} onChange={(e) => updateEditedWorkout(w.id, 'location', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Location" />
                              <input type="text" value={editedWorkouts[w.id]?.coachNotes || ''} onChange={(e) => updateEditedWorkout(w.id, 'coachNotes', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Coach notes" />
                            </div>
                          )}
                          {(editedWorkouts[w.id]?.type || w.type) === "cross" && <textarea value={editedWorkouts[w.id]?.description || ''} onChange={(e) => updateEditedWorkout(w.id, 'description', e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none" rows={2} placeholder="Full workout details..." />}
                        </div>
                      )}
                    </div>
                  ))}

                        {/* Client-Added Workouts for this day */}
                        {dayClientWorkouts.map(cw => (
                          <div key={cw.id} className={`${cw.source === 'strava' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-cyan-500/5 border-cyan-500/20'} border rounded-xl p-4`}>
                            <div className="flex items-start gap-4">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cw.completed ? 'bg-green-500 border-2 border-green-500' : cw.source === 'strava' ? 'bg-orange-500/20 border-2 border-orange-400' : 'bg-cyan-500 border-2 border-cyan-500'}`}>
                                {cw.completed ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : cw.source === 'strava' ? <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg> : <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {cw.source === 'strava' ? (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Extra</span>
                                  ) : (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">Client</span>
                                  )}
                                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(cw.type)}`}>{getTypeLabel(cw.type)}</span>
                                  {cw.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(cw.trainingType)}`}>{getTrainingTypeLabel(cw.trainingType)}</span>}
                                  {cw.source === 'strava' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>{cw.activityName || 'Strava'}</span>}
                                </div>
                                {cw.activityName && <p className="text-white text-sm font-medium mt-1">{cw.activityName}</p>}
                                {cw.notes && !cw.activityName && !cw.notes.startsWith?.('Kept as extra') && <p className="text-gray-400 text-sm mt-0.5">{cw.notes}</p>}
                                {(cw.averagePace || cw.duration || cw.avgHeartrate || cw.miles) && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {cw.miles && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">{distUnitShort}</span> <span className="text-white font-medium">{convertDist(cw.miles)}</span></span>}
                                    {cw.duration && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Dur</span> <span className="text-white font-medium">{cw.duration}</span></span>}
                                    {cw.averagePace && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Pace</span> <span className="text-white font-medium">{cw.averagePace}</span></span>}
                                    {cw.avgHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">HR</span> <span className="text-red-400 font-medium">{cw.avgHeartrate}</span></span>}
                                    {cw.maxHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Max</span> <span className="text-red-400 font-medium">{cw.maxHeartrate}</span></span>}
                                  </div>
                                )}
                              </div>
                              {cw.miles && !cw.averagePace && !cw.duration && <span className="text-white font-heading text-lg flex-shrink-0">{convertDist(cw.miles)}<span className="text-gray-300 text-xs ml-0.5">{distUnitShort}</span></span>}
                            </div>
                            {/* Comments on client workouts */}
                            {cw.completed && (
                              <div className="mt-2 pt-2 border-t border-white/5">
                                {(workoutComments[cw.id] || []).map(c => (
                                  <div key={c.id} className={`mb-1.5 ${c.isCoach ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-primary/30 border border-white/5'} rounded-lg p-2`}>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`text-xs font-bold ${c.isCoach ? 'text-purple-400' : 'text-accent'}`}>{c.userName}</span>
                                      <span className="text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    <p className="text-gray-300 text-xs">{c.message}</p>
                                  </div>
                                ))}
                                <div className="flex gap-2 mt-1.5">
                                  <input type="text" value={commentInput[cw.id] || ''} onChange={(e) => setCommentInput(prev => ({ ...prev, [cw.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSendWorkoutComment(cw.id); }} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="Add a comment on this workout..." />
                                  <button onClick={() => handleSendWorkoutComment(cw.id)} disabled={sendingComment === cw.id || !commentInput[cw.id]?.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs disabled:opacity-50">{sendingComment === cw.id ? '...' : 'Send'}</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Add workout to day button (edit mode) */}
                        {editingWeek && (
                          <button onClick={async () => { if (!selectedWeek) return; const client = clients.find(c => c.id === selectedClient); if (!client?.clientId) return; const res = await fetch('/api/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekId: selectedWeek.weekId, day, type: 'run', trainingType: '', title: '', miles: null, description: '', paceTarget: '', location: '', coachNotes: '', sortOrder: 99 }) }); if (res.ok) { setEditingWeek(false); setEditedWorkouts({}); await fetchWeeks(client.clientId); setTimeout(() => enterEditMode(), 100); } }} className="w-full border border-dashed border-accent/30 rounded-xl py-2 text-accent hover:text-white hover:border-accent/50 text-xs transition-colors flex items-center justify-center gap-1.5 mt-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add workout to {day}
                          </button>
                        )}
                      </div>
                    )}
                      </div>
                    );
                  })}
                </div>
                {editingWeek && <div className="flex gap-3"><button onClick={handleSaveEditedWeek} disabled={savingEdit} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">{savingEdit ? "Saving..." : "Save Changes"}</button><button onClick={() => { setEditingWeek(false); setEditedWorkouts({}); setEditDistanceUnits({}); }} className="border border-white/10 text-gray-400 hover:text-white py-2 px-6 rounded-lg text-sm">Cancel</button><button onClick={() => { if (selectedWeek) unpublishWeek(selectedWeek.weekId); }} className="border border-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm">Unpublish (move to drafts)</button></div>}
                </>)}
              </div>
            )}

            {/* DRAFTS */}
            {clientTab === "drafts" && (
              <div className="space-y-4">
                <h3 className="font-heading text-lg uppercase text-white">Unpublished Week Plans</h3>
                <p className="text-gray-400 text-sm">These are hidden from {selectedClientData.name.split(" ")[0]}. Publish when ready.</p>
                {draftWeeks.length === 0 && <p className="text-gray-500 text-center py-8">No drafts. Create a new week to get started.</p>}
                {draftWeeks.map((week) => (
                  <div key={week.weekId} className="bg-primary/30 border border-yellow-500/20 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2"><h4 className="text-white font-medium">{week.dateRange}</h4><span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Draft</span></div>
                        <p className="text-gray-400 text-xs">{week.focus} &bull; {week.workouts.length} workouts &bull; <span className="text-white">{week.workouts.reduce((s, w) => s + (w.miles ? convertDist(w.miles, w.distanceUnit) : 0), 0).toFixed(2)} {distUnitShort}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => publishWeek(week.weekId)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-xs">Publish</button>
                        <button onClick={() => handleEditDraft(week)} className="text-gray-400 hover:text-white text-xs border border-white/10 py-2 px-3 rounded-lg">Edit</button>
                        <button onClick={() => handleDeleteDraft(week.weekId)} disabled={deletingWeekId === week.weekId} className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50">{deletingWeekId === week.weekId ? "Deleting..." : "Delete"}</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {week.workouts.map((w) => (
                        <div key={w.id} className="bg-primary/50 rounded p-2 text-center">
                          <p className="text-gray-300 text-xs">{w.day.slice(0,3)}</p>
                          <p className="text-white text-xs font-medium truncate">{w.title || getTypeLabel(w.type)}</p>
                          {w.miles && <p className="text-accent text-xs">{convertDist(w.miles, w.distanceUnit)}{distUnitShort}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CREATE WEEK */}
            {clientTab === "create" && (
              <div className="space-y-4">
                {/* Block if no active plan */}
                {!activePlan && !loadingPlan && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                    <svg className="w-12 h-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    <h3 className="font-heading text-lg uppercase text-yellow-400 mb-2">No Active Plan</h3>
                    <p className="text-gray-300 text-sm mb-3">You need to create an active plan for {selectedClientData?.name.split(" ")[0]} before you can build weekly training.</p>
                    <p className="text-gray-400 text-xs mb-4">A plan defines the training period (start & end dates), goal, and payment terms. Weeks must fall within the plan dates.</p>
                    <button onClick={() => setClientTab("account")} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm">Go to Account → Create Plan</button>
                  </div>
                )}
                {loadingPlan && (
                  <div className="text-center py-8"><p className="text-gray-400">Loading plan data...</p></div>
                )}
                {/* Show create form only when active plan exists */}
                {activePlan && (
                  <>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-400 text-xs font-heading uppercase">Active Plan: {activePlan.goal || 'No goal set'}</p>
                      <p className="text-gray-400 text-xs">{new Date(activePlan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(activePlan.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <p className="text-gray-400 text-xs">${activePlan.paid}/${activePlan.owed} paid</p>
                  </div>
                </div>
                <h3 ref={createWeekRef} className="font-heading text-lg uppercase text-white">{editingDraftId ? "Edit Week Plan" : "Create Week Plan"}</h3>
                <p className="text-gray-400 text-sm">{editingDraftId ? "Editing existing draft. Save to update." : "Save as a draft to review later, or publish directly to make it visible to your client."}</p>
                <p className="text-gray-300 text-xs"><span className="text-accent">*</span> Required fields: Week Date Range. At least one workout day should have a type selected.</p>
                {/* Load from Week Template */}
                {weekTemplates.length > 0 && (
                  <div className="bg-secondary/30 border border-white/10 rounded-lg p-3 flex items-center gap-3 flex-wrap">
                    <span className="text-gray-400 text-xs font-heading uppercase">Load Template:</span>
                    {weekTemplates.map((t) => (
                      <button key={t.id} onClick={() => loadWeekTemplate(t)} className="bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 text-xs px-3 py-1.5 rounded-lg transition-colors">
                        {t.name}{t.category && <span className="text-gray-500 ml-1">({t.category})</span>}
                      </button>
                    ))}
                  </div>
                )}
                {/* AI Suggest Week Plan */}
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-300 text-xs font-heading uppercase">AI Week Planner</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">BETA</span>
                    <span className="text-gray-500 text-xs">— Suggestions may not be fully accurate. Always review before publishing.</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleAiSuggest}
                      disabled={aiSuggesting || !selectedClient || !weekPlan.dateRange}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-5 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                    >
                      {aiSuggesting ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          Analyzing Client History...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                          AI Suggest Week
                        </>
                      )}
                    </button>
                    {!weekPlan.dateRange && <span className="text-purple-300/60 text-xs">Select a week date range first</span>}
                    {weekPlan.dateRange && <span className="text-gray-400 text-xs">Analyzes {clients.find(c => c.id === selectedClient)?.name?.split(' ')[0] || 'client'}'s history, metrics, goals & feedback to suggest a plan</span>}
                    {aiCredits && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${aiCredits.used >= aiCredits.total ? 'bg-red-500/10 border-red-500/30 text-red-400' : aiCredits.used >= aiCredits.total * 0.8 ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-purple-500/10 border-purple-500/30 text-purple-300'}`}>
                        ${aiCredits.used.toFixed(2)} / ${aiCredits.total.toFixed(2)} used
                      </span>
                    )}
                  </div>
                  {weekPlan.dateRange && (
                    <div className="mt-2">
                      <label className="text-purple-300 text-xs block mb-1">Anything you want AI to consider? (optional but recommended)</label>
                      <textarea
                        value={aiCoachNotes}
                        onChange={(e) => setAiCoachNotes(e.target.value)}
                        className="w-full bg-primary/50 border border-purple-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 resize-none placeholder-gray-500"
                        rows={3}
                        placeholder={"The more you tell it, the better the plan. Examples:\n• Easy pace 10:30-11:00, tempo pace 9:00-9:15, long run pace 10:45\n• Focus on speed this week, race is Aug 15\n• He's been dealing with shin pain, avoid back-to-back run days\n• Currently running 20mpw, ready to bump to 22-23\n• Keep Tuesday and Thursday as hard days, easy the rest"}
                      />
                    </div>
                  )}
                  {aiError && (
                    <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                      <p className="text-red-400 text-xs">{aiError}</p>
                    </div>
                  )}
                  {aiReasoning && (
                    <div className="mt-2 bg-purple-500/10 border border-purple-500/30 rounded-lg p-2">
                      <p className="text-purple-300 text-xs font-heading uppercase mb-1">AI Reasoning (only you see this):</p>
                      <p className="text-gray-300 text-xs leading-relaxed">{aiReasoning}</p>
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-gray-400 text-xs block mb-1">Week Date Range <span className="text-accent">*</span></label>
                    <button onClick={() => setShowWeekPicker(!showWeekPicker)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between hover:border-white/30"><span className={weekPlan.dateRange ? "text-white" : "text-gray-500"}>{weekPlan.dateRange || "Select a week..."}</span><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                    {showWeekPicker && (
                      <div className="absolute top-full left-0 mt-2 z-50 bg-secondary border border-white/10 rounded-xl p-4 shadow-2xl w-80">
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1))} className="text-gray-400 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                          <span className="text-white text-sm">{pickerMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                          <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1))} className="text-gray-400 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-1">{["M","T","W","T","F","S","S"].map((d,i) => <div key={i} className="text-center text-gray-300 text-xs py-1">{d}</div>)}</div>
                        {getWeeksInMonth(pickerMonth).map((week, wi) => { const monday = week[0]; const sunday = week[6]; const isSelected = selectedWeekStart && monday.getTime() === selectedWeekStart.getTime(); const weekDateRange = `${formatDate(monday)} - ${formatDate(sunday)}`; const clientData = clients.find(c => c.id === selectedClient); const existingWeek = clientData?.weeks.find(w => w.dateRange === weekDateRange); const weekStatus = existingWeek?.status || null; return (
                          <button key={wi} onClick={() => selectWeek(monday)} className={`w-full grid grid-cols-7 gap-1 rounded-lg py-1 transition-colors relative ${isSelected ? "bg-accent/20" : weekStatus ? "bg-white/3" : "hover:bg-white/5"}`}>
                            {week.map((day, di) => <div key={di} className={`text-center text-xs py-1 rounded ${day.getMonth() === pickerMonth.getMonth() ? (isSelected ? "text-accent font-bold" : "text-white") : "text-gray-600"}`}>{day.getDate()}</div>)}
                            {weekStatus === "published" && <span className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-400" title="Published" />}
                            {weekStatus === "draft" && <span className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-yellow-400" title="Draft" />}
                          </button>); })}
                        <div className="flex items-center gap-3 mt-2 justify-center">
                          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>Published</span>
                          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>Draft</span>
                          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-transparent border border-gray-500 inline-block"></span>Empty</span>
                        </div>
                        <p className="text-gray-300 text-xs mt-1 text-center">Click a row to select Mon-Sun</p>
                      </div>
                    )}
                  </div>
                  <div><label className="text-gray-400 text-xs block mb-1">Week Focus</label><input type="text" value={weekPlan.focus} onChange={(e) => setWeekPlan({ ...weekPlan, focus: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. Speed & Long Run" /></div>
                </div>
                {/* Week date validation warning */}
                {weekDateWarning && (
                  <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    <p className="text-red-400 text-xs">{weekDateWarning}</p>
                  </div>
                )}
                <div><label className="text-gold text-xs font-heading uppercase block mb-1">Weekly Message to Client</label><textarea value={weekPlan.coachMessage} onChange={(e) => setWeekPlan({ ...weekPlan, coachMessage: e.target.value })} className="w-full bg-primary/50 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold resize-none" rows={2} placeholder="Shown at top of client's plan when published..." /></div>

                {/* Mon-Sun */}
                <div className="space-y-3">
                  {weekPlan.days.map((day, i) => (
                    <div key={day.day} className={`bg-primary/30 border border-white/5 rounded-xl p-4 ${day.workouts[0]?.type === "rest" && day.workouts.length === 1 ? "opacity-70" : ""}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-heading text-sm uppercase">{day.day}</span>
                        <span className="text-gray-400 text-xs">({day.workouts.length} workout{day.workouts.length > 1 ? 's' : ''})</span>
                      </div>
                      {/* Workouts for this day */}
                      {day.workouts.map((wo, wi) => (
                        <div key={wi} className={`${wi > 0 ? "mt-3 pt-3 border-t border-white/5" : ""}`}>
                          <div className="flex items-center gap-3">
                            {day.workouts.length > 1 && <span className="text-gray-400 text-xs w-4">{wi + 1}.</span>}
                            <select value={wo.type || ""} onChange={(e) => { const newType = e.target.value; updateDayPlan(i, wi, "type", newType); if (newType === "rest") { updateDayPlan(i, wi, "trainingType", "Rest"); updateDayPlan(i, wi, "title", ""); updateDayPlan(i, wi, "miles", ""); updateDayPlan(i, wi, "description", ""); updateDayPlan(i, wi, "paceTarget", ""); } else { updateDayPlan(i, wi, "trainingType", ""); updateDayPlan(i, wi, "title", ""); updateDayPlan(i, wi, "miles", ""); updateDayPlan(i, wi, "description", ""); updateDayPlan(i, wi, "paceTarget", ""); } }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent">
                              <option value="" disabled>Type</option><option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                            </select>
                            {wo.type === "rest" && <span className="text-green-400 text-xs">Rest Day</span>}
                            {wo.type === "run" && (
                              <>
                                <select value={wo.trainingType || ""} onChange={(e) => updateDayPlan(i, wi, "trainingType", e.target.value)} className={`bg-primary/50 border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent ${!wo.trainingType ? "border-accent/50" : "border-white/10"}`}>
                                  <option value="" disabled>Run Type *</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals (Run/Walk)</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery Run</option><option value="SpeedRoad">Speed - Road</option><option value="SpeedTrack">Speed - Track</option><option value="Tempo">Tempo</option><option value="Threshold">Threshold</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                                </select>
                                <div className="flex items-center gap-1">
                                  <input type="text" value={wo.miles} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) updateDayPlan(i, wi, "miles", v); }} className={`w-14 bg-primary/50 border rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent ${!wo.miles ? "border-accent/50" : "border-white/10"}`} placeholder="Dist *" />
                                  <button type="button" onClick={() => updateDayPlan(i, wi, "distanceUnit", wo.distanceUnit === "km" ? "mi" : "km")} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold hover:border-accent"><span className={wo.distanceUnit === "km" ? "text-accent" : "text-white"}>{wo.distanceUnit === "km" ? "km" : "mi"}</span></button>
                                  <input type="text" value={wo.paceTarget} onChange={(e) => updateDayPlan(i, wi, "paceTarget", e.target.value)} className="w-20 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder={`Pace /${wo.distanceUnit === "km" ? "km" : "mi"}`} />
                                </div>
                              </>
                            )}
                            {wo.type === "walk" && (
                              <>
                                <select value={wo.trainingType || ""} onChange={(e) => updateDayPlan(i, wi, "trainingType", e.target.value)} className={`bg-primary/50 border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent ${!wo.trainingType ? "border-accent/50" : "border-white/10"}`}>
                                  <option value="" disabled>Walk Type *</option><option value="WalkPower">Walk Power</option><option value="WalkRecovery">Walk Recovery</option>
                                </select>
                                <div className="flex items-center gap-1">
                                  <input type="text" value={wo.miles} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) updateDayPlan(i, wi, "miles", v); }} className={`w-14 bg-primary/50 border rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent ${!wo.miles ? "border-accent/50" : "border-white/10"}`} placeholder="Dist *" />
                                  <button type="button" onClick={() => updateDayPlan(i, wi, "distanceUnit", wo.distanceUnit === "km" ? "mi" : "km")} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold hover:border-accent"><span className={wo.distanceUnit === "km" ? "text-accent" : "text-white"}>{wo.distanceUnit === "km" ? "km" : "mi"}</span></button>
                                  <input type="text" value={wo.paceTarget} onChange={(e) => updateDayPlan(i, wi, "paceTarget", e.target.value)} className="w-20 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder={`Pace /${wo.distanceUnit === "km" ? "km" : "mi"}`} />
                                </div>
                              </>
                            )}
                            {wo.type === "stretching" && (
                              <select value={wo.trainingType || ""} onChange={(e) => updateDayPlan(i, wi, "trainingType", e.target.value)} className={`bg-primary/50 border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent ${!wo.trainingType ? "border-accent/50" : "border-white/10"}`}>
                                <option value="" disabled>Type *</option><option value="FoamRoll">Foam Roll</option><option value="Stretching">Stretching</option><option value="Yoga">Yoga</option>
                              </select>
                            )}
                            {day.workouts.length > 1 && <button type="button" onClick={() => removeWorkoutFromDay(i, wi)} className="text-red-400 hover:text-red-300 text-xs ml-auto">Remove</button>}
                          </div>
                          {wo.type === "run" && (
                            <>
                              <StructuredRunBuilder
                                structure={(wo as any).structure || { warmUp: null, blocks: [{ blockType: "intervals", reps: "", work: { type: "distance", value: "", unit: "meters" }, intensity: "", recovery: { type: "distance", value: "", unit: "meters", recoveryType: "Jog" } }], coolDown: null }}
                                onChange={(structure) => {
                                  const updated = [...weekPlan.days];
                                  const workouts = [...updated[i].workouts];
                                  (workouts[wi] as any).structure = structure;
                                  // Auto-calculate distance
                                  const autoMiles = calculateTotalDistance(structure);
                                  if (autoMiles > 0) (workouts[wi] as any).miles = autoMiles.toString();
                                  updated[i] = { ...updated[i], workouts };
                                  setWeekPlan({ ...weekPlan, days: updated });
                                }}
                              />
                              <div className="mt-2">
                                <input type="text" value={wo.coachNotes} onChange={(e) => updateDayPlan(i, wi, "coachNotes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Coach notes (free text — e.g. Keep effort controlled, Stay conversational, Run by feel)" />
                              </div>
                            </>
                          )}
                          {wo.type === "walk" && (<div className="grid md:grid-cols-2 gap-2 mt-2"><input type="text" value={wo.title} onChange={(e) => updateDayPlan(i, wi, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Title" /><input type="text" value={wo.coachNotes} onChange={(e) => updateDayPlan(i, wi, "coachNotes", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Coach notes" /></div>)}
                          {wo.type === "cross" && (<><div className="grid md:grid-cols-2 gap-2 mt-2"><input type="text" value={wo.title} onChange={(e) => updateDayPlan(i, wi, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Title" /><input type="text" value={wo.location} onChange={(e) => updateDayPlan(i, wi, "location", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Location" /></div><textarea value={wo.description} onChange={(e) => updateDayPlan(i, wi, "description", e.target.value)} className="w-full mt-2 bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none" rows={2} placeholder="Full workout details..." /></>)}
                          {(wo.type === "cycling" || wo.type === "stretching") && (<textarea value={wo.description} onChange={(e) => updateDayPlan(i, wi, "description", e.target.value)} className="w-full mt-2 bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none" rows={2} placeholder="Full workout details..." />)}
                          {wo.type === "rest" && <div className="mt-2"><input type="text" value={wo.coachNotes} onChange={(e) => updateDayPlan(i, wi, "coachNotes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Coach notes (optional)" /></div>}
                        </div>
                      ))}
                      {/* Add another workout + template actions */}
                      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/5">
                        <button type="button" onClick={() => addWorkoutToDay(i)} className="text-accent text-xs hover:underline">+ Add another workout</button>
                        {dayTemplates.length > 0 && (
                          <div className="relative">
                            <button type="button" onClick={() => setShowLoadDayTemplate(showLoadDayTemplate === i ? null : i)} className="text-gray-500 hover:text-white text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Load Template</button>
                            {showLoadDayTemplate === i && (
                              <div className="absolute bottom-full left-0 mb-2 z-50 bg-secondary border border-white/10 rounded-lg p-2 shadow-xl min-w-48">
                                {dayTemplates.map((t) => (
                                  <button key={t.id} type="button" onClick={() => loadDayTemplate(i, t)} className="block w-full text-left text-xs text-gray-300 hover:text-white hover:bg-white/5 px-2 py-1.5 rounded transition-colors">
                                    {t.name}{t.category && <span className="text-gray-600 ml-1">({t.category})</span>}
                                  </button>
                                ))}
                                <button type="button" onClick={() => setShowLoadDayTemplate(null)} className="block w-full text-left text-xs text-gray-500 hover:text-white px-2 py-1.5 rounded mt-1 border-t border-white/5">Cancel</button>
                              </div>
                            )}
                          </div>
                        )}
                        {day.workouts[0]?.type !== "rest" && day.workouts[0]?.title && (
                          showSaveDayTemplate === i ? (
                            <div className="flex items-center gap-2">
                              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs w-32 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Template name" />
                              <input type="text" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs w-24 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Category" />
                              <button type="button" onClick={() => handleSaveDayTemplate(i)} disabled={!templateName.trim() || savingTemplate} className="text-green-400 text-xs hover:text-green-300 disabled:opacity-50">{savingTemplate ? "..." : "Save"}</button>
                              <button type="button" onClick={() => { setShowSaveDayTemplate(null); setTemplateName(""); setTemplateCategory(""); }} className="text-gray-300 text-xs hover:text-white">Cancel</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setShowSaveDayTemplate(i); setTemplateName(day.workouts[0]?.title || `${day.day} ${day.workouts[0]?.trainingType || day.workouts[0]?.type}`); }} className="text-gray-500 hover:text-gold text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save as Template</button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Weekly Mileage Total */}
                <div className="bg-primary/30 border border-white/5 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Weekly Mileage Total:</span>
                  <span className="text-accent font-heading text-lg">{weekPlan.days.reduce((total, day) => total + day.workouts.reduce((dayTotal, wo) => dayTotal + (wo.miles && (wo.type === 'run' || wo.type === 'walk') ? parseFloat(wo.miles) || 0 : 0), 0), 0).toFixed(2)} {weekPlan.days.some(d => d.workouts.some(wo => wo.distanceUnit === 'km')) ? 'km' : 'mi'}</span>
                </div>
                <div className="flex gap-3 flex-wrap items-center"><button onClick={() => handleSaveWeek("draft")} disabled={!!weekDateWarning || !weekPlan.dateRange} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">Save as Draft</button><button onClick={() => handleSaveWeek("published")} disabled={!!weekDateWarning || !weekPlan.dateRange} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">Save & Publish</button><button type="button" onClick={() => { setShowSaveWeekTemplate(true); setTimeout(() => saveTemplateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }} className="border border-gold/30 text-gold hover:bg-gold/10 font-bold py-2 px-4 rounded-lg text-sm">Save as Template</button><button type="button" onClick={() => { setWeekPlan({ dateRange: "", focus: "", coachMessage: "", days: [ { day: "Monday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] }, { day: "Tuesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] }, { day: "Wednesday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] }, { day: "Thursday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] }, { day: "Friday", workouts: [{ type: "cross", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] }, { day: "Saturday", workouts: [{ type: "run", trainingType: "", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] }, { day: "Sunday", workouts: [{ type: "rest", trainingType: "Rest", title: "", miles: "", description: "", paceTarget: "", location: "", coachNotes: "", distanceUnit: "mi" }] } ] }); setSelectedWeekStart(null); setEditingDraftId(null); setWeekDateWarning(""); setClientTab("plan"); }} className="text-gray-400 hover:text-white text-sm ml-2">Cancel</button></div>
                {!weekPlan.dateRange && <p className="text-accent text-xs mt-2">Select a week date range to save.</p>}
                {/* Save Week Template Dialog */}
                {showSaveWeekTemplate && (
                  <div ref={saveTemplateRef} className="bg-gold/5 border border-gold/20 rounded-lg p-4 mt-3">
                    <p className="text-gold text-xs font-heading uppercase mb-3">Save Week as Template</p>
                    <p className="text-gray-400 text-xs mb-3">This saves the current week layout (workouts, focus, coach message) as a reusable template. You can load it for any client in the future.</p>
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <div><label className="text-gray-400 text-xs block mb-1">Template Name *</label><input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold" placeholder="e.g. 5K Base Week 3" /></div>
                      <div><label className="text-gray-400 text-xs block mb-1">Category (optional)</label><input type="text" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold" placeholder="e.g. Base Building, Race Prep, Recovery" /></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleSaveWeekTemplate} disabled={!templateName.trim() || savingTemplate} className="bg-gold hover:bg-yellow-600 text-primary font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">{savingTemplate ? "Saving..." : "Save Template"}</button>
                      <button onClick={() => { setShowSaveWeekTemplate(false); setTemplateName(""); setTemplateCategory(""); }} className="text-gray-400 text-sm">Cancel</button>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            )}

            {/* MESSAGES - Chat Style */}
            {clientTab === "messages" && (
              <div className="flex flex-col h-[calc(100vh-280px)] bg-secondary/20 border border-white/10 rounded-2xl overflow-hidden">
                {/* Chat Header */}
                <div className="px-5 py-3 border-b border-white/10 bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><span className="text-white text-xs font-bold">{selectedClientData.name.charAt(0)}</span></div>
                    <div><p className="text-white text-sm font-medium">{selectedClientData.name}</p><p className="text-gray-300 text-xs">{selectedClientData.goal || "No active plan"}</p></div>
                  </div>
                </div>

                {/* Messages Area - scrollable */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {adminMessages.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-sm">No messages yet.</p>
                      <p className="text-xs mt-1">Start the conversation below!</p>
                    </div>
                  )}
                  {adminMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.from === "crystal" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] ${msg.from === "crystal" ? "bg-accent rounded-2xl rounded-br-md" : "bg-secondary/80 border border-white/10 rounded-2xl rounded-bl-md"} px-4 py-2.5`}>
                        {msg.from === "crystal" && msg.fromName && selectedClientData && selectedClientData.coaches.length > 1 && (
                          <p className="text-white/70 text-[10px] font-medium mb-0.5">{msg.fromName}</p>
                        )}
                        <p className={`text-sm ${msg.from === "crystal" ? "text-white" : "text-gray-200"}`}>{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.from === "crystal" ? "text-white/60" : "text-gray-500"}`}>{msg.date}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={adminMessagesEndRef} />
                </div>

                {/* Input Area - fixed at bottom */}
                <div className="px-4 py-3 border-t border-white/10 bg-secondary/50">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendAdminMessage(); } }}
                      className="flex-1 bg-primary/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none max-h-32"
                      rows={1}
                      placeholder={`Message ${selectedClientData.name.split(" ")[0]}...`}
                    />
                    <button
                      onClick={handleSendAdminMessage}
                      disabled={sendingAdminMessage || !newMessage.trim()}
                      className="bg-accent hover:bg-red-700 text-white p-2.5 rounded-xl disabled:opacity-30 transition-colors flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT */}
            {clientTab === "account" && (
              <AccountTab 
                clientData={selectedClientData} 
                onSave={() => fetchClients()} 
                onArchive={() => handleArchiveClient(selectedClientData.id)}
                onDelete={async () => {
                  try {
                    const res = await fetch(`/api/clients/${selectedClientData.id}`, { method: 'DELETE' });
                    if (res.ok) {
                      fetchClients();
                      setSelectedClient(null);
                    }
                  } catch (err) {
                    console.error('Failed to delete client:', err);
                  }
                }}
              />
            )}
          </div>
        ) : (
          /* COACH DASHBOARD or SETTINGS */
          <div className="p-6 space-y-6">
            {showNotificationSettings ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-2xl uppercase text-white">Account Preferences</h2>
                  <button onClick={() => setShowNotificationSettings(false)} className="text-gray-400 hover:text-white text-sm">Back to Dashboard</button>
                </div>

                <p className="text-gray-400 text-sm">Choose how often you want to be notified for each type of activity. Changes save automatically.</p>
                <div className="bg-primary/30 border border-white/5 rounded-lg p-3 mb-2">
                  <p className="text-gray-400 text-xs"><strong className="text-white">Immediately</strong> — You get an individual email each time any client triggers this event.</p>
                  <p className="text-gray-400 text-xs mt-1"><strong className="text-white">Off</strong> — No emails. You&apos;ll only see this activity when you log in to the dashboard.</p>
                </div>

                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6 space-y-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400">Workout Activity</h3>

                  <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="text-green-400">&#10003;</span><p className="text-white text-sm font-medium">Client completes a workout</p></div>
                    <p className="text-gray-300 text-xs mb-3">Get an email each time any client completes a workout with their effort, miles, pace, and notes</p>
                    <div className="flex gap-2">
                      <button onClick={() => updateNotifSetting("workoutCompleted", "immediate")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutCompleted === "immediate" ? "bg-green-500/20 border border-green-500/40 text-green-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Immediately</button>
                      <button onClick={() => updateNotifSetting("workoutCompleted", "off")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutCompleted === "off" ? "bg-green-500/20 border border-green-500/40 text-green-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Off</button>
                    </div>
                  </div>

                  <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="text-red-400">&#10007;</span><p className="text-white text-sm font-medium">Client skips a workout</p></div>
                    <p className="text-gray-300 text-xs mb-3">Get an email each time any client skips a workout with their reason</p>
                    <div className="flex gap-2">
                      <button onClick={() => updateNotifSetting("workoutSkipped", "immediate")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutSkipped === "immediate" ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Immediately</button>
                      <button onClick={() => updateNotifSetting("workoutSkipped", "off")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutSkipped === "off" ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Off</button>
                    </div>
                  </div>

                  <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="text-yellow-400">&#189;</span><p className="text-white text-sm font-medium">Client partially completes a workout</p></div>
                    <p className="text-gray-300 text-xs mb-3">Get an email each time any client partially completes a workout with what they did and why they stopped</p>
                    <div className="flex gap-2">
                      <button onClick={() => updateNotifSetting("workoutPartial", "immediate")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutPartial === "immediate" ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Immediately</button>
                      <button onClick={() => updateNotifSetting("workoutPartial", "off")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutPartial === "off" ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Off</button>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6 space-y-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400">Messages</h3>

                  <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="text-accent">&#9993;</span><p className="text-white text-sm font-medium">Client sends you a message</p></div>
                    <p className="text-gray-300 text-xs mb-3">Get an email each time a client sends you a message</p>
                    <div className="flex gap-2">
                      <button onClick={() => updateNotifSetting("clientMessage", "immediate")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).clientMessage === "immediate" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Immediately</button>
                      <button onClick={() => updateNotifSetting("clientMessage", "off")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).clientMessage === "off" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Off</button>
                    </div>
                  </div>
                </div>

                {/* Distance Unit Preference */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400 mb-2">Distance Unit</h3>
                  <p className="text-gray-300 text-xs mb-4">Choose how distances are displayed across your dashboard when viewing clients.</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setAdminDistanceUnit("mi"); saveAdminNotifPrefs(notifications, undefined, "mi"); }} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${adminDistanceUnit === "mi" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Miles (mi)</button>
                    <button onClick={() => { setAdminDistanceUnit("km"); saveAdminNotifPrefs(notifications, undefined, "km"); }} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${adminDistanceUnit === "km" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Kilometers (km)</button>
                  </div>
                </div>

                {/* Default Week View Preference */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400 mb-2">Default Week View</h3>
                  <p className="text-gray-300 text-xs mb-4">Choose whether day blocks start expanded or collapsed when viewing a published week.</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setAdminDefaultExpanded(true); setAdminExpandedDays({}); saveAdminNotifPrefs(notifications, undefined, undefined, true); }} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${adminDefaultExpanded ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Expanded</button>
                    <button onClick={() => { setAdminDefaultExpanded(false); setAdminExpandedDays({}); saveAdminNotifPrefs(notifications, undefined, undefined, false); }} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${!adminDefaultExpanded ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Collapsed</button>
                  </div>
                </div>

                {/* Email Destination */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400 mb-2">Send Notifications To</h3>
                  <p className="text-gray-300 text-xs mb-4">Where should notification emails be sent? You can add multiple email addresses separated by commas.</p>
                  <div className="flex gap-3">
                    <input type="text" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="crystal@pistolpc.com, backup@gmail.com" />
                    <button onClick={() => { saveAdminNotifPrefs(notifications, notifEmail); setNotifEmailSaved(true); setTimeout(() => setNotifEmailSaved(false), 3000); }} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm">{notifEmailSaved ? "Saved ✓" : "Save"}</button>
                  </div>
                  <p className="text-gray-400 text-xs mt-2">Separate multiple addresses with a comma.</p>
                </div>
              </>
            ) : showChangelog ? (
              <Changelog />
            ) : showTemplatesView ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-2xl uppercase text-white">Training Templates</h2>
                  <button onClick={() => setShowTemplatesView(false)} className="text-gray-400 hover:text-white text-sm">Back to Dashboard</button>
                </div>

                <p className="text-gray-400 text-sm">Save and reuse workout plans. Load templates when creating a week for any client.</p>

                {/* Week Templates */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading text-sm uppercase text-gold">Week Templates ({weekTemplates.length})</h3>
                    <button onClick={() => { setCreatingWeekTemplate(!creatingWeekTemplate); setCreatingDayTemplate(false); }} className="bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 text-xs px-3 py-1.5 rounded-lg transition-colors">{creatingWeekTemplate ? "Cancel" : "+ Create Week Template"}</button>
                  </div>
                  {/* Create Week Template Form */}
                  {creatingWeekTemplate && (
                    <div className="bg-primary/30 border border-gold/20 rounded-xl p-4 mb-4 space-y-4">
                      <div className="grid md:grid-cols-3 gap-3">
                        <div><label className="text-gray-400 text-xs block mb-1">Template Name *</label><input type="text" value={newWeekTemplateName} onChange={(e) => setNewWeekTemplateName(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. 5K Base Week 3" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Category</label><input type="text" value={newWeekTemplateCategory} onChange={(e) => setNewWeekTemplateCategory(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. Base Building" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Week Focus</label><input type="text" value={newWeekTemplateFocus} onChange={(e) => setNewWeekTemplateFocus(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. Speed & Long Run" /></div>
                      </div>
                      <div><label className="text-gold text-xs font-heading uppercase block mb-1">Coach Message</label><textarea value={newWeekTemplateCoachMessage} onChange={(e) => setNewWeekTemplateCoachMessage(e.target.value)} className="w-full bg-primary/50 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold resize-none" rows={2} placeholder="Message shown to client when this template is used..." /></div>
                      {/* Day-by-day */}
                      <div className="space-y-2">
                        {newWeekTemplateDays.map((day, i) => (
                          <div key={day.day} className={`bg-primary/50 border border-white/5 rounded-xl p-3 ${day.workouts[0]?.type === "rest" && day.workouts.length === 1 ? "opacity-70" : ""}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-heading text-xs uppercase w-20">{day.day}</span>
                              {day.workouts.map((wo, wi) => (
                                <div key={wi} className="flex items-center gap-2 flex-1 flex-wrap">
                                  <select value={wo.type || ""} onChange={(e) => { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], type: e.target.value }; if (e.target.value === 'rest') { nw[wi] = { ...nw[wi], trainingType: 'Rest', title: '', miles: '', description: '', paceTarget: '' }; } else { nw[wi] = { ...nw[wi], trainingType: '', title: '', miles: '', description: '', paceTarget: '' }; } nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                    <option value="" disabled>Type</option><option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                                  </select>
                                  {wo.type === "run" && (
                                    <>
                                      <select value={wo.trainingType || ""} onChange={(e) => { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], trainingType: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                        <option value="" disabled>Run Type</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery</option><option value="SpeedRoad">Speed - Road</option><option value="SpeedTrack">Speed - Track</option><option value="Tempo">Tempo</option><option value="Threshold">Threshold</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                                      </select>
                                      <input type="text" value={wo.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], miles: v }; nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); } }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                                      <input type="text" value={wo.title || ''} onChange={(e) => { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], title: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs flex-1 min-w-24 focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Title" />
                                    </>
                                  )}
                                  {wo.type === "walk" && (
                                    <>
                                      <select value={wo.trainingType || ""} onChange={(e) => { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], trainingType: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                        <option value="" disabled>Walk Type</option><option value="WalkPower">Walk Power</option><option value="WalkRecovery">Walk Recovery</option>
                                      </select>
                                      <input type="text" value={wo.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], miles: v }; nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); } }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                                      <input type="text" value={wo.title || ''} onChange={(e) => { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], title: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs flex-1 min-w-24 focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Title" />
                                    </>
                                  )}
                                  {wo.type === "stretching" && (
                                    <select value={wo.trainingType || ""} onChange={(e) => { const nd = [...newWeekTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], trainingType: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setNewWeekTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                      <option value="" disabled>Type</option><option value="FoamRoll">Foam Roll</option><option value="Stretching">Stretching</option><option value="Yoga">Yoga</option>
                                    </select>
                                  )}
                                  {wo.type === "rest" && <span className="text-green-400 text-xs">Rest Day</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleCreateWeekTemplate} disabled={!newWeekTemplateName.trim() || savingTemplate} className="bg-gold hover:bg-yellow-600 text-primary font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">{savingTemplate ? "Saving..." : "Save Template"}</button>
                        <button onClick={() => setCreatingWeekTemplate(false)} className="text-gray-400 text-sm">Cancel</button>
                      </div>
                    </div>
                  )}
                  {weekTemplates.length === 0 ? (
                    <p className="text-gray-300 text-sm">No week templates saved yet. Build a week plan for a client and click &ldquo;Save as Template&rdquo; to create one.</p>
                  ) : (
                    <div className="space-y-3">
                      {weekTemplates.map((t) => {
                        // Normalize days: support both old flat format and new workouts-array format
                        const normDays = (t.data.days || []).map((d: any) => {
                          if (d.workouts && d.workouts.length > 0) {
                            const wo = d.workouts[0];
                            return { day: d.day, type: wo.type || 'rest', trainingType: wo.trainingType || '', title: wo.title || '', miles: wo.miles || '', workouts: d.workouts };
                          }
                          return { day: d.day, type: d.type || 'rest', trainingType: d.trainingType || '', title: d.title || '', miles: d.miles || '' };
                        });
                        const runCount = normDays.filter((d: any) => d.type === 'run').length;
                        const crossCount = normDays.filter((d: any) => d.type === 'cross').length;
                        const restCount = normDays.filter((d: any) => d.type === 'rest').length;
                        const walkCount = normDays.filter((d: any) => d.type === 'walk').length;
                        const isEditing = editingTemplateId === t.id;
                        return (
                        <div key={t.id} className="bg-primary/30 border border-white/5 rounded-xl p-4">
                          {!isEditing ? (
                            <>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="text-white font-medium">{t.name}</h4>
                              <p className="text-gray-300 text-xs">{t.category && <span className="text-gold">{t.category} · </span>}{runCount} run{runCount !== 1 ? 's' : ''}{crossCount > 0 ? `, ${crossCount} cross` : ''}{walkCount > 0 ? `, ${walkCount} walk` : ''}, {restCount} rest{t.data.focus && ` · Focus: ${t.data.focus}`}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => startEditingTemplate(t)} className="text-gray-500 hover:text-white text-xs transition-colors border border-white/10 px-3 py-1 rounded">Edit</button>
                              <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-500 hover:text-red-400 text-xs transition-colors border border-white/10 px-3 py-1 rounded">Delete</button>
                            </div>
                          </div>
                          {/* Preview grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {normDays.map((d: any, i: number) => (
                              <div key={i} className={`rounded p-2 text-center ${d.type === 'run' ? 'bg-accent/10' : d.type === 'cross' ? 'bg-gold/10' : d.type === 'walk' ? 'bg-blue-500/10' : d.type === 'cycling' ? 'bg-cyan-500/10' : d.type === 'stretching' ? 'bg-purple-500/10' : 'bg-green-500/10'}`}>
                                <p className="text-gray-300 text-xs">{d.day?.slice(0, 3)}</p>
                                <p className="text-white text-xs font-medium truncate">{d.title || d.trainingType || getTypeLabel(d.type)}</p>
                                {d.miles && <p className="text-accent text-xs">{convertDist(Number(d.miles))}{distUnitShort}</p>}
                              </div>
                            ))}
                          </div>
                          {t.data.coachMessage && (
                            <div className="mt-2 bg-gold/5 border border-gold/10 rounded-lg p-2">
                              <p className="text-gold text-xs">Coach message: {t.data.coachMessage}</p>
                            </div>
                          )}
                            </>
                          ) : (
                            /* INLINE EDIT MODE for week template */
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-white font-heading text-sm uppercase">Editing: {t.name}</h4>
                                <div className="flex items-center gap-2">
                                  <button onClick={handleSaveEditedTemplate} disabled={savingTemplateEdit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs disabled:opacity-50">{savingTemplateEdit ? "Saving..." : "Save"}</button>
                                  <button onClick={() => setEditingTemplateId(null)} className="text-gray-400 hover:text-white text-xs border border-white/10 px-3 py-1.5 rounded-lg">Cancel</button>
                                </div>
                              </div>
                              <div className="grid md:grid-cols-3 gap-3">
                                <div><label className="text-gray-400 text-xs block mb-1">Template Name</label><input type="text" value={editTemplateName} onChange={(e) => setEditTemplateName(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" /></div>
                                <div><label className="text-gray-400 text-xs block mb-1">Category</label><input type="text" value={editTemplateCategory} onChange={(e) => setEditTemplateCategory(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. Base Building" /></div>
                                <div><label className="text-gray-400 text-xs block mb-1">Week Focus</label><input type="text" value={editTemplateFocus} onChange={(e) => setEditTemplateFocus(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. Speed & Long Run" /></div>
                              </div>
                              <div><label className="text-gold text-xs font-heading uppercase block mb-1">Coach Message</label><textarea value={editTemplateCoachMessage} onChange={(e) => setEditTemplateCoachMessage(e.target.value)} className="w-full bg-primary/50 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold resize-none" rows={2} placeholder="Message shown to client..." /></div>
                              {/* Day-by-day editing */}
                              <div className="space-y-2">
                                {editTemplateDays.map((day, i) => (
                                  <div key={day.day} className={`bg-primary/50 border border-white/5 rounded-xl p-3 ${day.workouts[0]?.type === "rest" && day.workouts.length === 1 ? "opacity-70" : ""}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-white font-heading text-xs uppercase w-20">{day.day}</span>
                                      {day.workouts.map((wo, wi) => (
                                        <div key={wi} className="flex items-center gap-2 flex-1 flex-wrap">
                                          <select value={wo.type || ""} onChange={(e) => { const nd = [...editTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], type: e.target.value }; if (e.target.value === 'rest') { nw[wi] = { ...nw[wi], trainingType: 'Rest', title: '', miles: '', description: '', paceTarget: '' }; } else { nw[wi] = { ...nw[wi], trainingType: '', title: '', miles: '', description: '', paceTarget: '' }; } nd[i] = { ...nd[i], workouts: nw }; setEditTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                            <option value="" disabled>Type</option><option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                                          </select>
                                          {wo.type === "run" && (
                                            <>
                                              <select value={wo.trainingType || ""} onChange={(e) => { const nd = [...editTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], trainingType: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setEditTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                                <option value="" disabled>Run Type</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery</option><option value="SpeedRoad">Speed - Road</option><option value="SpeedTrack">Speed - Track</option><option value="Tempo">Tempo</option><option value="Threshold">Threshold</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                                              </select>
                                              <input type="text" value={wo.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) { const nd = [...editTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], miles: v }; nd[i] = { ...nd[i], workouts: nw }; setEditTemplateDays(nd); } }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                                            </>
                                          )}
                                          {wo.type === "walk" && (
                                            <>
                                              <select value={wo.trainingType || ""} onChange={(e) => { const nd = [...editTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], trainingType: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setEditTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                                <option value="" disabled>Walk Type</option><option value="WalkPower">Walk Power</option><option value="WalkRecovery">Walk Recovery</option>
                                              </select>
                                              <input type="text" value={wo.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) { const nd = [...editTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], miles: v }; nd[i] = { ...nd[i], workouts: nw }; setEditTemplateDays(nd); } }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                                            </>
                                          )}
                                          {wo.type === "stretching" && (
                                            <select value={wo.trainingType || ""} onChange={(e) => { const nd = [...editTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], trainingType: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setEditTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                              <option value="" disabled>Type</option><option value="FoamRoll">Foam Roll</option><option value="Stretching">Stretching</option><option value="Yoga">Yoga</option>
                                            </select>
                                          )}
                                          {wo.type === "rest" && <span className="text-green-400 text-xs">Rest Day</span>}
                                          {(wo.type === "run" || wo.type === "walk") && <input type="text" value={wo.title || ''} onChange={(e) => { const nd = [...editTemplateDays]; const nw = [...nd[i].workouts]; nw[wi] = { ...nw[wi], title: e.target.value }; nd[i] = { ...nd[i], workouts: nw }; setEditTemplateDays(nd); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs flex-1 min-w-24 focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Title" />}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );})}
                    </div>
                  )}
                </div>

                {/* Day Templates */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading text-sm uppercase text-gold">Day Templates ({dayTemplates.length})</h3>
                    <button onClick={() => { setCreatingDayTemplate(!creatingDayTemplate); setCreatingWeekTemplate(false); }} className="bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 text-xs px-3 py-1.5 rounded-lg transition-colors">{creatingDayTemplate ? "Cancel" : "+ Create Day Template"}</button>
                  </div>
                  {/* Create Day Template Form */}
                  {creatingDayTemplate && (
                    <div className="bg-primary/30 border border-gold/20 rounded-xl p-4 mb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-gray-400 text-xs block mb-1">Template Name *</label><input type="text" value={newDayTemplateName} onChange={(e) => setNewDayTemplateName(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. Easy 4 Miler" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Category</label><input type="text" value={newDayTemplateCategory} onChange={(e) => setNewDayTemplateCategory(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. Easy Days" /></div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select value={newDayTemplateData.type || ""} onChange={(e) => { const newType = e.target.value; setNewDayTemplateData((prev: any) => ({ ...prev, type: newType, trainingType: newType === 'rest' ? 'Rest' : '', title: '', miles: '', description: '', paceTarget: '' })); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                          <option value="" disabled>Type</option><option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                        </select>
                        {newDayTemplateData.type === "run" && (
                          <>
                            <select value={newDayTemplateData.trainingType || ""} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, trainingType: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                              <option value="" disabled>Run Type</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery</option><option value="SpeedRoad">Speed - Road</option><option value="SpeedTrack">Speed - Track</option><option value="Tempo">Tempo</option><option value="Threshold">Threshold</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                            </select>
                            <input type="text" value={newDayTemplateData.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setNewDayTemplateData((prev: any) => ({ ...prev, miles: v })); }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                          </>
                        )}
                        {newDayTemplateData.type === "walk" && (
                          <>
                            <select value={newDayTemplateData.trainingType || ""} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, trainingType: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                              <option value="" disabled>Walk Type</option><option value="WalkPower">Walk Power</option><option value="WalkRecovery">Walk Recovery</option>
                            </select>
                            <input type="text" value={newDayTemplateData.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setNewDayTemplateData((prev: any) => ({ ...prev, miles: v })); }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                          </>
                        )}
                        {newDayTemplateData.type === "stretching" && (
                          <select value={newDayTemplateData.trainingType || ""} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, trainingType: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                            <option value="" disabled>Type</option><option value="FoamRoll">Foam Roll</option><option value="Stretching">Stretching</option><option value="Yoga">Yoga</option>
                          </select>
                        )}
                      </div>
                      {(newDayTemplateData.type === "run" || newDayTemplateData.type === "walk") && (
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={newDayTemplateData.title || ''} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, title: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Title" />
                          <input type="text" value={newDayTemplateData.paceTarget || ''} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, paceTarget: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Pace target" />
                          <input type="text" value={newDayTemplateData.description || ''} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, description: e.target.value }))} className="col-span-2 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Description" />
                          <input type="text" value={newDayTemplateData.location || ''} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, location: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Location" />
                          <input type="text" value={newDayTemplateData.coachNotes || ''} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, coachNotes: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Coach notes" />
                        </div>
                      )}
                      {(newDayTemplateData.type === "cross" || newDayTemplateData.type === "cycling" || newDayTemplateData.type === "stretching") && (
                        <div className="space-y-2">
                          <input type="text" value={newDayTemplateData.title || ''} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, title: e.target.value }))} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Title" />
                          <textarea value={newDayTemplateData.description || ''} onChange={(e) => setNewDayTemplateData((prev: any) => ({ ...prev, description: e.target.value }))} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent resize-none" rows={2} placeholder="Description" />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button onClick={handleCreateDayTemplate} disabled={!newDayTemplateName.trim() || savingTemplate} className="bg-gold hover:bg-yellow-600 text-primary font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">{savingTemplate ? "Saving..." : "Save Template"}</button>
                        <button onClick={() => setCreatingDayTemplate(false)} className="text-gray-400 text-sm">Cancel</button>
                      </div>
                    </div>
                  )}
                  {dayTemplates.length === 0 ? (
                    <p className="text-gray-300 text-sm">No day templates saved yet. When creating a week, click &ldquo;Save Day as Template&rdquo; on any workout to save it.</p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                      {dayTemplates.map((t) => {
                        const isDayEditing = editingDayTemplateId === t.id;
                        return (
                        <div key={t.id} className={`border rounded-xl p-4 ${t.data.type === 'run' ? 'border-accent/20 bg-accent/5' : t.data.type === 'cross' ? 'border-gold/20 bg-gold/5' : t.data.type === 'walk' ? 'border-blue-500/20 bg-blue-500/5' : t.data.type === 'stretching' ? 'border-purple-500/20 bg-purple-500/5' : 'border-green-500/20 bg-green-500/5'}`}>
                          {!isDayEditing ? (
                            <>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white text-sm font-medium">{t.name}</h4>
                            <div className="flex items-center gap-2">
                              <button onClick={() => startEditingDayTemplate(t)} className="text-gray-500 hover:text-white text-xs transition-colors">Edit</button>
                              <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs">
                            {t.category && <p className="text-gold">{t.category}</p>}
                            <p className="text-gray-400">
                              <span className={`font-bold ${t.data.type === 'run' ? 'text-accent' : t.data.type === 'cross' ? 'text-gold' : t.data.type === 'walk' ? 'text-blue-400' : t.data.type === 'stretching' ? 'text-purple-400' : 'text-green-400'}`}>{getTypeLabel(t.data.type)}</span>
                              {t.data.trainingType && t.data.trainingType !== 'Rest' && <span> · {getTrainingTypeLabel(t.data.trainingType)}</span>}
                              {t.data.miles && <span> · {convertDist(Number(t.data.miles))} {distUnitShort}</span>}
                            </p>
                            {t.data.title && <p className="text-white">{t.data.title}</p>}
                            {t.data.description && <p className="text-gray-400">{t.data.description}</p>}
                            {t.data.paceTarget && <p className="text-accent">Target: {t.data.paceTarget}</p>}
                            {t.data.location && <p className="text-gray-500">Location: {t.data.location}</p>}
                            {t.data.coachNotes && <p className="text-gold">Notes: {t.data.coachNotes}</p>}
                          </div>
                            </>
                          ) : (
                            /* INLINE EDIT MODE for day template */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-white text-xs font-heading uppercase">Edit Day Template</span>
                                <div className="flex items-center gap-2">
                                  <button onClick={handleSaveEditedDayTemplate} disabled={savingTemplateEdit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-xs disabled:opacity-50">{savingTemplateEdit ? "..." : "Save"}</button>
                                  <button onClick={() => setEditingDayTemplateId(null)} className="text-gray-400 hover:text-white text-xs">Cancel</button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={editDayTemplateName} onChange={(e) => setEditDayTemplateName(e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Name" />
                                <input type="text" value={editDayTemplateCategory} onChange={(e) => setEditDayTemplateCategory(e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Category" />
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <select value={editDayTemplateData.type || ""} onChange={(e) => { const newType = e.target.value; setEditDayTemplateData((prev: any) => ({ ...prev, type: newType, trainingType: newType === 'rest' ? 'Rest' : '', title: '', miles: '', description: '', paceTarget: '' })); }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                  <option value="" disabled>Type</option><option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                                </select>
                                {editDayTemplateData.type === "run" && (
                                  <>
                                    <select value={editDayTemplateData.trainingType || ""} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, trainingType: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                      <option value="" disabled>Run Type</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery</option><option value="SpeedRoad">Speed - Road</option><option value="SpeedTrack">Speed - Track</option><option value="Tempo">Tempo</option><option value="Threshold">Threshold</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                                    </select>
                                    <input type="text" value={editDayTemplateData.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setEditDayTemplateData((prev: any) => ({ ...prev, miles: v })); }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                                  </>
                                )}
                                {editDayTemplateData.type === "walk" && (
                                  <>
                                    <select value={editDayTemplateData.trainingType || ""} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, trainingType: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent">
                                      <option value="" disabled>Walk Type</option><option value="WalkPower">Walk Power</option><option value="WalkRecovery">Walk Recovery</option>
                                    </select>
                                    <input type="text" value={editDayTemplateData.miles || ''} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setEditDayTemplateData((prev: any) => ({ ...prev, miles: v })); }} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Miles" />
                                  </>
                                )}
                              </div>
                              {(editDayTemplateData.type === "run" || editDayTemplateData.type === "walk") && (
                                <div className="grid grid-cols-2 gap-2">
                                  <input type="text" value={editDayTemplateData.title || ''} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, title: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Title" />
                                  <input type="text" value={editDayTemplateData.paceTarget || ''} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, paceTarget: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Pace target" />
                                  <input type="text" value={editDayTemplateData.description || ''} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, description: e.target.value }))} className="col-span-2 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Description" />
                                  <input type="text" value={editDayTemplateData.location || ''} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, location: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Location" />
                                  <input type="text" value={editDayTemplateData.coachNotes || ''} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, coachNotes: e.target.value }))} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Coach notes" />
                                </div>
                              )}
                              {(editDayTemplateData.type === "cross" || editDayTemplateData.type === "cycling" || editDayTemplateData.type === "stretching") && (
                                <div className="space-y-2">
                                  <input type="text" value={editDayTemplateData.title || ''} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, title: e.target.value }))} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Title" />
                                  <textarea value={editDayTemplateData.description || ''} onChange={(e) => setEditDayTemplateData((prev: any) => ({ ...prev, description: e.target.value }))} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent resize-none" rows={2} placeholder="Description" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              </>
            ) : showManageCoaches ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-2xl uppercase text-white">Manage Coaches</h2>
                  <button onClick={() => setShowManageCoaches(false)} className="text-gray-400 hover:text-white text-sm">Back to Dashboard</button>
                </div>

                <p className="text-gray-400 text-sm">Add new coaches and manage who has admin access to the platform.</p>

                {/* Invite New Coach */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-purple-400 mb-4">Invite New Coach</h3>
                  <p className="text-gray-300 text-xs mb-4">Send an invite email to a new coach. They&apos;ll set their password and get full admin access to manage clients, create weeks, send messages, etc.</p>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Full Name <span className="text-accent">*</span></label>
                      <input type="text" value={newCoachForm.name} onChange={(e) => setNewCoachForm({ ...newCoachForm, name: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="Coach Name" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Email <span className="text-accent">*</span></label>
                      <input type="email" value={newCoachForm.email} onChange={(e) => setNewCoachForm({ ...newCoachForm, email: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="coach@email.com" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleInviteCoach} disabled={creatingCoach || !newCoachForm.name.trim() || !newCoachForm.email.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50 transition-colors">{creatingCoach ? "Sending Invite..." : "Send Invite"}</button>
                    {createCoachError && <p className="text-red-400 text-xs">{createCoachError}</p>}
                    {createCoachSuccess && <p className="text-green-400 text-xs">{createCoachSuccess}</p>}
                  </div>
                </div>

                {/* Existing Coaches */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400 mb-4">Current Coaches ({allCoaches.length})</h3>
                  {allCoaches.length === 0 ? (
                    <p className="text-gray-500 text-sm">No coaches found. This shouldn&apos;t happen — you should see yourself here.</p>
                  ) : (
                    <div className="space-y-3">
                      {allCoaches.map(coach => {
                        const isYou = coach.id === loggedInUserId;
                        const clientCount = clients.filter(c => c.coaches.some(cc => cc.coachId === coach.id)).length;
                        const defaultCount = clients.filter(c => c.coaches.some(cc => cc.coachId === coach.id && cc.isDefault)).length;
                        return (
                          <div key={coach.id} className="flex items-center justify-between bg-primary/30 border border-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <span className="text-purple-400 font-bold text-sm">{coach.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-white text-sm font-medium">{coach.name}</p>
                                  {isYou && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">You</span>}
                                </div>
                                <p className="text-gray-400 text-xs">{coach.email}</p>
                                <p className="text-gray-500 text-xs mt-0.5">
                                  {clientCount > 0 ? `${clientCount} client${clientCount !== 1 ? 's' : ''} assigned` : 'No clients assigned'}
                                  {defaultCount > 0 && ` (${defaultCount} as default)`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isYou && (
                                <button onClick={() => handleDeleteCoach(coach.id)} disabled={deletingCoachId === coach.id} className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                                  {deletingCoachId === coach.id ? "Removing..." : "Remove"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Info box */}
                <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                  <p className="text-gray-400 text-xs leading-relaxed">
                    <strong className="text-white">How coaches work:</strong> When a coach is assigned to a client, they can create weekly plans, send messages, and add comments. Each coach has their own preferences (MI/KM, notifications). 
                    The <span className="text-gold">default coach</span> is the name shown to the client throughout their dashboard and in emails. You can change the default per-client from the client&apos;s header area.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-2xl uppercase text-white">Dashboard</h2>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-accent">{clients.filter(c => c.status === "active").length}</p><p className="text-gray-400 text-xs">Active Clients</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-yellow-400">{clients.reduce((s, c) => s + c.weeks.filter(w => w.status === "draft").length, 0)}</p><p className="text-gray-400 text-xs">Drafts to Publish</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-green-400">${clients.reduce((s, c) => s + c.paid, 0)}</p><p className="text-gray-400 text-xs">Total Collected</p></div>
              <div className="bg-secondary/50 border border-white/10 rounded-xl p-4 text-center"><p className="font-heading text-2xl text-white">${clients.reduce((s, c) => s + (c.owed - c.paid), 0)}</p><p className="text-gray-400 text-xs">Outstanding</p></div>
            </div>

            {/* Action Items */}
            {(() => {
              const allDrafts = clients.filter(c => c.status === "active").flatMap(c => c.weeks.filter(w => w.status === "draft").map(w => ({ client: c, week: w }))).sort((a, b) => {
                // Sort by date first
                const dateA = new Date(a.week.dateRange.split(' - ')[0] + ', ' + new Date().getFullYear());
                const dateB = new Date(b.week.dateRange.split(' - ')[0] + ', ' + new Date().getFullYear());
                if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
                // Then alphabetically by client first name
                return a.client.name.localeCompare(b.client.name);
              });
              const unpaidClients = clients.filter(c => c.status === "active" && c.owed - c.paid > 0);
              return (
                <>
                  {/* Drafts Ready to Publish */}
                  {allDrafts.length > 0 && (
                    <div className="bg-secondary/50 border border-yellow-500/20 rounded-xl p-5">
                      <h3 className="font-heading text-sm uppercase text-yellow-400 mb-3">Drafts Ready to Publish ({allDrafts.length})</h3>
                      <div className="space-y-2">
                        {(showAllDrafts ? allDrafts : allDrafts.slice(0, 3)).map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-primary/30 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{item.client.name.charAt(0)}</div>
                              <div><p className="text-white text-sm">{item.client.name}</p><p className="text-gray-300 text-xs">{item.week.dateRange} &mdash; {item.week.focus} &bull; <span className="text-white">{item.week.workouts.reduce((s: number, w: any) => s + (w.miles ? convertDist(w.miles, w.distanceUnit) : 0), 0).toFixed(2)} {distUnitShort}</span></p></div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setSelectedClient(item.client.id); setClientTab("drafts"); }} className="text-gray-400 hover:text-white text-xs border border-white/10 px-3 py-1 rounded">View</button>
                              <button onClick={() => { const updated = clients.map(c => { if (c.id === item.client.id) { return { ...c, weeks: c.weeks.map(w => w.weekId === item.week.weekId ? { ...w, status: "published" as const } : w) }; } return c; }); setClients(updated); }} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded font-bold">Publish</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {allDrafts.length > 3 && !showAllDrafts && (
                        <button onClick={() => setShowAllDrafts(true)} className="w-full mt-3 text-yellow-400 hover:text-yellow-300 text-xs font-medium py-2 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/5 transition-colors">Show all {allDrafts.length} drafts</button>
                      )}
                      {showAllDrafts && allDrafts.length > 3 && (
                        <button onClick={() => setShowAllDrafts(false)} className="w-full mt-3 text-gray-400 hover:text-white text-xs py-2 transition-colors">Show less</button>
                      )}
                    </div>
                  )}



                  {/* Unread Messages */}
                  {totalUnread > 0 && (
                    <div className="bg-secondary/50 border border-accent/20 rounded-xl p-5">
                      <h3 className="font-heading text-sm uppercase text-accent mb-3">Unread Messages ({totalUnread})</h3>
                      <div className="space-y-2">
                        {clients.filter(c => unreadByClient[c.id] > 0).map((c) => (
                          <button key={c.id} onClick={() => { setSelectedClient(c.id); setClientTab("messages"); }} className="w-full flex items-center justify-between bg-primary/30 rounded-lg p-3 hover:bg-white/5 transition-colors text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">{c.name.charAt(0)}</div>
                              <p className="text-white text-sm">{c.name}</p>
                            </div>
                            <span className="bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadByClient[c.id]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Overview */}
                  {unpaidClients.length > 0 && (
                    <div className="bg-secondary/50 border border-white/10 rounded-xl p-5">
                      <h3 className="font-heading text-sm uppercase text-gray-400 mb-3">Outstanding Payments ({unpaidClients.length})</h3>
                      <div className="space-y-2">
                        {(showAllPayments ? unpaidClients : unpaidClients.slice(0, 3)).map((c) => (
                          <button key={c.id} onClick={() => { setSelectedClient(c.id); setClientTab("account"); }} className="w-full flex items-center justify-between bg-primary/30 rounded-lg p-3 hover:bg-white/5 transition-colors text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{c.name.charAt(0)}</div>
                              <p className="text-white text-sm">{c.name}</p>
                            </div>
                            <div className="text-right"><p className="text-white text-sm font-medium">${(c.owed - c.paid).toFixed(0)} due</p><p className="text-gray-300 text-xs">${c.paid}/${c.owed} paid</p></div>
                          </button>
                        ))}
                      </div>
                      {unpaidClients.length > 3 && !showAllPayments && (
                        <button onClick={() => setShowAllPayments(true)} className="w-full mt-3 text-gray-400 hover:text-white text-xs font-medium py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Show all {unpaidClients.length} outstanding</button>
                      )}
                      {showAllPayments && unpaidClients.length > 3 && (
                        <button onClick={() => setShowAllPayments(false)} className="w-full mt-3 text-gray-400 hover:text-white text-xs py-2 transition-colors">Show less</button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}


              </>
            )}
          </div>
        )}
      </main>

      {/* AI Coach Assistant — Floating Button + Panel */}
      <button onClick={() => setShowAiPanel(!showAiPanel)} className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${showAiPanel ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gradient-to-r from-purple-600 to-accent hover:scale-105'}`} title="AI Coach Assistant">
        {showAiPanel ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        )}
      </button>

      {showAiPanel && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] max-h-[70vh] bg-secondary border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-accent/10">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-heading text-sm uppercase flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                AI Coach Assistant
              </h3>
              {aiCredits && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${aiCredits.used >= aiCredits.total ? 'bg-red-500/10 border-red-500/30 text-red-400' : aiCredits.used >= aiCredits.total * 0.8 ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-purple-500/10 border-purple-500/30 text-purple-300'}`}>
                  ${aiCredits.used.toFixed(2)} / ${aiCredits.total.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs mt-0.5">Ask me about your clients</p>
          </div>

          {/* Client & Data Depth Selector */}
          <div className="px-5 py-3 border-b border-white/5 space-y-2">
            <div className="flex gap-2">
              <select value={aiSelectedClient} onChange={(e) => { setAiSelectedClient(e.target.value); setAiResponse(null); setAiCustomPrompt(''); setAiFeedbackGiven(null); }} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500">
                <option value="all">All Active Clients</option>
                {clients.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select value={aiDataDepth} onChange={(e) => { setAiDataDepth(e.target.value as any); setAiResponse(null); }} className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500">
                <option value="light">Light (2 wks)</option>
                <option value="standard">Standard (4 wks)</option>
                <option value="deep">Deep (all)</option>
              </select>
            </div>
            <p className="text-gray-500 text-[10px]">{aiDataDepth === 'light' ? 'Fastest, least detail' : aiDataDepth === 'standard' ? 'Balanced speed + detail' : 'Most detail, slower'} — {aiSelectedClient === 'all' ? 'All clients' : clients.find(c => c.id === aiSelectedClient)?.name}</p>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!aiResponse && !aiLoading && (
              <div className="space-y-2">
                <p className="text-gray-400 text-xs mb-3 font-medium">Quick Actions:</p>
                <button onClick={() => handleAiQuery(aiSelectedClient !== 'all' ? "Give me a progress summary for this client. How are they tracking this week? Any patterns or concerns?" : "Give me a summary of all my clients' progress this week. Who completed their workouts, who's behind, and what's the overall compliance rate?")} className="w-full text-left bg-primary/30 hover:bg-primary/50 border border-white/5 hover:border-purple-500/30 rounded-lg p-3 transition-colors group">
                  <p className="text-white text-xs font-medium group-hover:text-purple-300">{aiSelectedClient !== 'all' ? 'Progress summary' : 'Weekly client summary'}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{aiSelectedClient !== 'all' ? 'How are they tracking, patterns, concerns' : 'Who completed what, compliance rates, overall status'}</p>
                </button>
                <button onClick={() => handleAiQuery(aiSelectedClient !== 'all' ? "What should I focus on with this client right now? Any adjustments needed to their plan?" : "What are my immediate action items? Which clients need attention — skipped workouts, behind on plan, haven't logged recently, or have declining trends?")} className="w-full text-left bg-primary/30 hover:bg-primary/50 border border-white/5 hover:border-purple-500/30 rounded-lg p-3 transition-colors group">
                  <p className="text-white text-xs font-medium group-hover:text-purple-300">{aiSelectedClient !== 'all' ? 'What to focus on' : 'Immediate action items'}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{aiSelectedClient !== 'all' ? 'Adjustments, conversations, plan changes' : 'Clients who need your attention right now'}</p>
                </button>
                <button onClick={() => handleAiQuery(aiSelectedClient !== 'all' ? "Is this client on track for their goal? Compare their plan vs actual performance and flag any gaps." : "Are any of my clients struggling that I should focus on? Look at skip rates, declining RPE, missed workouts, low energy/sleep scores, or comments that suggest frustration.")} className="w-full text-left bg-primary/30 hover:bg-primary/50 border border-white/5 hover:border-purple-500/30 rounded-lg p-3 transition-colors group">
                  <p className="text-white text-xs font-medium group-hover:text-purple-300">{aiSelectedClient !== 'all' ? 'Goal vs progress' : 'Clients who may be struggling'}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{aiSelectedClient !== 'all' ? 'Are they on track for their goal?' : 'Declining trends, high skip rates, low morale'}</p>
                </button>
                {aiSelectedClient !== 'all' && (
                  <>
                    <button onClick={() => handleAiQuery(`Based on the workout data, what conversation should I have with this client? What questions should I ask them?`)} className="w-full text-left bg-primary/30 hover:bg-primary/50 border border-white/5 hover:border-purple-500/30 rounded-lg p-3 transition-colors group">
                      <p className="text-white text-xs font-medium group-hover:text-purple-300">Conversation starters</p>
                      <p className="text-gray-500 text-[10px] mt-0.5">What to say in your next check-in</p>
                    </button>
                  </>
                )}
                <div className="pt-2 border-t border-white/5">
                  <p className="text-gray-400 text-xs mb-2 font-medium">Ask anything:</p>
                  <div className="flex gap-2">
                    <input type="text" value={aiCustomPrompt} onChange={(e) => setAiCustomPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && aiCustomPrompt.trim()) handleAiQuery(aiCustomPrompt.trim()); }} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500" placeholder="Type your question..." />
                    <button onClick={() => { if (aiCustomPrompt.trim()) handleAiQuery(aiCustomPrompt.trim()); }} disabled={!aiCustomPrompt.trim()} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors">Ask</button>
                  </div>
                </div>
              </div>
            )}

            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-gray-400 text-xs">Analyzing {aiSelectedClient === 'all' ? 'all clients' : 'client data'}...</p>
              </div>
            )}

            {!aiResponse && !aiLoading && aiProvider === 'rate-limited' && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 text-center">
                <svg className="w-8 h-8 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-yellow-400 text-sm font-medium mb-1">Rate limit reached</p>
                <p className="text-gray-400 text-xs mb-4">Too many requests in a short time. Wait 1-2 minutes and try again — the limit resets automatically.</p>
                <button onClick={() => { setAiProvider(null); }} className="text-yellow-400 hover:text-yellow-300 text-xs font-medium py-2 px-4 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/5 transition-colors">Try again</button>
              </div>
            )}

            {aiResponse && !aiLoading && (
              <div>
                <div className="bg-primary/30 border border-purple-500/20 rounded-xl p-4 mb-4">
                  <div className="space-y-2">
                    {aiResponse.split('\n').filter(line => line.trim()).map((line, i) => (
                      <p key={i} className="text-gray-200 text-sm leading-relaxed flex gap-2">
                        {line.trim().startsWith('•') || line.trim().startsWith('-') ? (
                          <><span className="text-purple-400 flex-shrink-0 mt-0.5">•</span><span>{line.replace(/^[•\-]\s*/, '')}</span></>
                        ) : (
                          <span>{line}</span>
                        )}
                      </p>
                    ))}
                  </div>
                  {aiProvider && aiProvider !== 'rate-limited' && (
                    <p className="text-gray-600 text-[10px] mt-3 pt-2 border-t border-white/5">Powered by {aiProvider}</p>
                  )}
                </div>

                {/* Feedback */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-500 text-[10px]">Was this helpful?</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleAiFeedback('up')} className={`p-1.5 rounded-lg transition-colors ${aiFeedbackGiven === 'up' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                    </button>
                    <button onClick={() => handleAiFeedback('down')} className={`p-1.5 rounded-lg transition-colors ${aiFeedbackGiven === 'down' ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                    </button>
                  </div>
                </div>

                {/* Ask another */}
                <button onClick={() => { setAiResponse(null); setAiCustomPrompt(''); }} className="w-full text-center text-purple-400 hover:text-purple-300 text-xs font-medium py-2 border border-purple-500/20 rounded-lg hover:bg-purple-500/5 transition-colors">Ask another question</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
