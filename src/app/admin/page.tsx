"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import AccountTab from "./AccountTab";
import Changelog from "./Changelog";

type WorkoutLog = { rpe: string; stress: string; notes: string; energy: string; motivation: string; sleep: string; strength: string; recovery: string; mood: string; hunger: string; actualMiles?: string; actualPace?: string; onPeriod?: string; };
type WorkoutDay = { id: string; day: string; date: string; type: "run" | "cross" | "rest"; trainingType: string; title: string; miles: number | null; description: string; paceTarget?: string; location?: string; coachNotes?: string; completed: boolean; log?: WorkoutLog; };
type WeekData = { weekId: string; label: string; dateRange: string; focus: string; coachMessage: string; status: "published" | "draft"; workouts: WorkoutDay[]; };
type CoachMessage = { id: string; date: string; from: string; message: string; };
type Client = { id: string; clientId: string | null; name: string; email: string; gender: "female" | "male"; goal: string; startDate: string; planDuration: string; owed: number; paid: number; status: "active" | "archived"; inviteStatus: "accepted" | "pending" | "expired"; weeks: WeekData[]; messages: CoachMessage[]; };

export default function AdminPage() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<"plan" | "create" | "messages" | "drafts" | "account">("plan");
  const [editingWeek, setEditingWeek] = useState(false);
  const [editedWorkouts, setEditedWorkouts] = useState<Record<string, { type: string; trainingType: string; miles: string; title: string; description: string; paceTarget: string; location: string; coachNotes: string }>>({});
  const [editedCoachMessage, setEditedCoachMessage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showTemplatesView, setShowTemplatesView] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
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
  const saveAdminNotifPrefs = async (updatedNotifs: typeof notifications, email?: string) => {
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
  const [newClientForm, setNewClientForm] = useState({ name: "", email: "", gender: "female" as "female" | "male" });

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

  const weekTemplates = templates.filter(t => t.type === 'week');
  const dayTemplates = templates.filter(t => t.type === 'day');

  // Save week as template
  const saveTemplateRef = useRef<HTMLDivElement>(null);
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

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
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
          weeks: [],
          messages: [],
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create client');
      } else {
        setShowCreateClient(false);
        setNewClientForm({ name: "", email: "", gender: "female" });
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
  const selectedClientWeeks = selectedClientData?.weeks || [];
  const publishedWeeks = selectedClientWeeks.filter(w => w.status === "published");
  const draftWeeks = selectedClientWeeks.filter(w => w.status === "draft");
  const allClientWorkouts = publishedWeeks.flatMap((w) => w.workouts);
  const completedWorkouts = allClientWorkouts.filter((w) => w.completed);
  const totalMilesCompleted = allClientWorkouts.filter(w => w.log).reduce((s, w) => s + (Number(w.log?.actualMiles) || w.miles || 0), 0);
  const totalMilesProgrammed = allClientWorkouts.reduce((s, w) => s + (w.miles || 0), 0);
  const [adminMessages, setAdminMessages] = useState<{id: string; date: string; from: string; message: string}[]>([]);
  const [sendingAdminMessage, setSendingAdminMessage] = useState(false);
  const adminMessagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    adminMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adminMessages]);
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
    return publishedWeeks.find(w => w.dateRange.startsWith(mondayStr)) || null;
  };

  const selectedWeek = getAdminWeekPlan(adminWeekOffset);

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
          workouts: (w.workouts || []).map((wo: any) => ({
            id: wo.id,
            day: wo.day || '',
            date: '',
            type: wo.type || 'run',
            trainingType: wo.trainingType || '',
            title: wo.title || '',
            miles: wo.miles,
            description: wo.description || '',
            paceTarget: wo.paceTarget || '',
            location: wo.location || '',
            coachNotes: wo.coachNotes || '',
            completed: wo.completed || false,
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

          const publishedMapped = mapped.filter(w => w.status === 'published');
          let earliest = 0;
          let latest = 0;
          
          for (const w of publishedMapped) {
            const startStr = w.dateRange.split(' - ')[0];
            const weekMonday = new Date(startStr + ', ' + new Date().getFullYear());
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
    }
    setEditedWorkouts(workoutEdits);
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
          <input type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients..." className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-accent mb-2" />
          <div className="flex gap-1 mb-2">
            {[{ key: "active", label: "Active" }, { key: "archived", label: "Archived" }, { key: "all", label: "All" }].map((f) => (
              <button key={f.key} onClick={() => setClientFilter(f.key as "active" | "archived" | "all")} className={`px-2 py-1 rounded text-xs transition-colors flex-1 ${clientFilter === f.key ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>{f.label}</button>
            ))}
          </div>
          <button onClick={() => setShowCreateClient(!showCreateClient)} className="w-full bg-accent hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">+ New Client</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredClients.map((client) => {
            const allWk = client.weeks.filter(w => w.status === "published").flatMap(w => w.workouts);
            const doneWk = allWk.filter(w => w.completed);
            const isSelected = selectedClient === client.id;
            return (
              <button key={client.id} onClick={() => { setSelectedClient(client.id); setAdminWeekOffset(0); setClientTab("plan"); setEditingWeek(false); setShowTemplatesView(false); setShowNotificationSettings(false); setShowChangelog(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 ${isSelected ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-white/5"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? "bg-accent text-white" : "bg-white/10 text-gray-400"}`}>{client.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{client.name}</p>
                  <p className="text-gray-500 text-xs truncate">
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
                  <p className="text-gray-400 text-xs">{doneWk.length}/{allWk.length}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-white/10 space-y-2">
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(false); setShowTemplatesView(false); setShowChangelog(true); }} className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors ${showChangelog && !selectedClient ? "text-green-400" : "text-gray-400 hover:text-white"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            What&apos;s New
          </button>
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(false); setShowTemplatesView(true); setShowChangelog(false); }} className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors ${showTemplatesView && !selectedClient ? "text-gold" : "text-gray-400 hover:text-white"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            Templates ({templates.length})
          </button>
          <button onClick={() => { setSelectedClient(null); setShowNotificationSettings(true); setShowTemplatesView(false); setShowChangelog(false); }} className="w-full flex items-center gap-2 text-gray-400 hover:text-white text-xs py-1.5 px-2 rounded hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Notification Settings
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
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div><label className="text-gray-400 text-xs block mb-1">Full Name</label><input type="text" value={newClientForm.name} onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Sarah Miller" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Email</label><input type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="client@email.com" /></div>
              <div><label className="text-gray-400 text-xs block mb-1">Gender</label><select value={newClientForm.gender} onChange={(e) => setNewClientForm({ ...newClientForm, gender: e.target.value as "female" | "male" })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"><option value="female">Female</option><option value="male">Male</option></select></div>
            </div>
            <div className="flex gap-3"><button onClick={handleCreateClient} disabled={createLoading} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">{createLoading ? "Creating..." : "Create Account & Send Invite"}</button><button onClick={() => setShowCreateClient(false)} className="text-gray-400 hover:text-white text-sm">Cancel</button></div>
            {createError && <p className="text-red-400 text-xs mt-2">{createError}</p>}
          </div>
        )}

        {selectedClientData ? (
          <div className="p-6 space-y-6">
            {/* Client Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-heading text-2xl uppercase text-white">{selectedClientData.name}</h2>
                <p className="text-sm">
                  {selectedClientData.inviteStatus !== "accepted"
                    ? <span className={selectedClientData.inviteStatus === "pending" ? "text-blue-400" : "text-red-400"}>{selectedClientData.inviteStatus === "pending" ? "Invite pending" : "Invite expired"}</span>
                    : selectedClientData.goal
                      ? <span className="text-gray-400">{selectedClientData.goal}</span>
                      : <span className="text-yellow-400">No active plan</span>
                  }
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center"><p className="text-accent font-heading text-xl">{completedWorkouts.length}/{allClientWorkouts.length}</p><p className="text-gray-500 text-xs">Done</p></div>
                <div className="text-center"><p className="text-white font-heading text-xl">{totalMilesCompleted.toFixed(0)}<span className="text-gray-500 text-sm">/{totalMilesProgrammed}</span></p><p className="text-gray-500 text-xs">Miles</p></div>
                <div className="text-center"><p className="text-green-400 font-heading text-xl">${selectedClientData.paid}</p><p className="text-gray-500 text-xs">/${selectedClientData.owed}</p></div>
                {draftWeeks.length > 0 && <div className="text-center"><p className="text-yellow-400 font-heading text-xl">{draftWeeks.length}</p><p className="text-gray-500 text-xs">Drafts</p></div>}
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
                {/* Current week badge */}
                {adminWeekOffset === 0 && (
                  <div className="text-center">
                    <span className="inline-block bg-accent/10 border border-accent/30 rounded-lg py-1.5 px-4 text-accent font-heading text-xs uppercase">Current Week</span>
                  </div>
                )}
                {adminWeekOffset !== 0 && (
                  <div className="text-center">
                    <button onClick={() => setAdminWeekOffset(0)} className="text-accent text-xs hover:underline">← Go to current week</button>
                  </div>
                )}

                {/* Week Navigation */}
                <div className="flex items-center justify-between">
                  <button onClick={() => setAdminWeekOffset(adminWeekOffset - 1)} disabled={adminWeekOffset <= adminMinOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                  <div className="text-center">
                    <p className="font-heading text-lg uppercase text-white">{getAdminWeekLabel(adminWeekOffset)}</p>
                    {selectedWeek && <p className="text-gray-400 text-xs">{selectedWeek.focus}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedWeek && adminWeekOffset >= 0 && <button onClick={() => { if (editingWeek) { setEditingWeek(false); setEditedWorkouts({}); } else { enterEditMode(); } }} className="text-accent text-xs hover:underline">{editingWeek ? "Cancel Edit" : "Edit Week"}</button>}
                    {selectedWeek && adminWeekOffset < 0 && <span className="text-gray-600 text-xs italic">Past week (locked)</span>}
                    <button onClick={() => setAdminWeekOffset(adminWeekOffset + 1)} disabled={adminWeekOffset >= adminMaxOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                  </div>
                </div>

                {/* No plan for this week */}
                {!selectedWeek && (
                  <div className="text-center py-8 bg-secondary/30 border border-white/10 rounded-xl">
                    <p className="text-gray-500">No published plan for this week.</p>
                  </div>
                )}

                {/* Has a plan — show content */}
                {selectedWeek && (
                  <>

                {/* Coach Message */}
                <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                  <p className="text-gold text-xs font-heading uppercase mb-1">Weekly Message</p>
                  {editingWeek ? <textarea value={editedCoachMessage} onChange={(e) => setEditedCoachMessage(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" rows={2} /> : <p className="text-gray-300 text-sm">{selectedWeek?.coachMessage || <span className="text-gray-600 italic">No message</span>}</p>}
                </div>

                {/* Workouts */}
                <div className="space-y-3">
                  {selectedWeek?.workouts.map((w, wi) => (
                    <div key={w.id} className="bg-primary/30 border border-white/5 rounded-xl p-4">
                      {!editingWeek ? (
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
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeBadge(w.type)}`}>{getTypeLabel(w.type)}</span>
                                {w.type === "run" && w.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(w.trainingType)}`}>{getTrainingTypeLabel(w.trainingType)}</span>}
                              </div>
                              <p className="text-gray-300 text-sm mt-0.5">{w.title} {w.description && `— ${w.description}`}</p>
                              {w.paceTarget && <p className="text-accent text-xs mt-0.5">{w.paceTarget}</p>}
                            </div>
                            {w.miles && <span className="text-white font-heading text-lg flex-shrink-0">{w.miles}<span className="text-gray-500 text-xs ml-0.5">mi</span></span>}
                          </div>
                          {w.log && (
                            <div className="mt-3 ml-7 pl-4 border-l-2 border-accent/30">
                              <div className="flex flex-wrap gap-3 text-xs">
                                {w.log.rpe && <span><span className="text-gray-500">Effort:</span> <span className="text-white">{w.log.rpe}/10</span></span>}
                                {w.log.actualMiles && <span><span className="text-gray-500">Miles:</span> <span className="text-white">{w.log.actualMiles}</span></span>}
                                {w.log.actualPace && <span><span className="text-gray-500">Pace:</span> <span className="text-white">{w.log.actualPace}</span></span>}
                                {w.log.duration && <span><span className="text-gray-500">Duration:</span> <span className="text-white">{w.log.duration}</span></span>}
                                {w.log.stress && <span><span className="text-gray-500">Stress:</span> <span className="text-white">{w.log.stress}</span></span>}
                                {w.log.onPeriod === "yes" && <span className="text-pink-400 font-medium">On Period</span>}
                              </div>
                              {w.log.notes && <p className="text-gray-400 text-xs mt-1">{w.log.notes}</p>}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {w.log.energy && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Energy: {w.log.energy}/10</span>}
                                {w.log.motivation && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Motivation: {w.log.motivation}/10</span>}
                                {w.log.sleep && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Sleep: {w.log.sleep}/10</span>}
                                {w.log.recovery && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Recovery: {w.log.recovery}/10</span>}
                                {w.log.mood && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Mood: {w.log.mood}/10</span>}
                                {w.log.hunger && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Appetite: {w.log.hunger}/10</span>}
                                {w.log.strength && <span className="text-xs bg-primary/50 rounded px-2 py-0.5 text-gray-300">Body: {w.log.strength}/10</span>}
                              </div>
                              {w.skipReason && <p className="text-yellow-400 text-xs mt-2"><span className="font-medium">{w.status === "skipped" ? "Skipped:" : "Partial:"}</span> {w.skipReason}</p>}
                            </div>
                          )}
                        </>
                      ) : (
                        /* EDIT MODE - full workout editing */
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-white font-heading text-sm uppercase w-24">{w.day}</span>
                            <select value={editedWorkouts[w.id]?.type || w.type} onChange={(e) => updateEditedWorkout(w.id, 'type', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                              <option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                            </select>
                            {(editedWorkouts[w.id]?.type || w.type) === "run" && (
                              <>
                                <select value={editedWorkouts[w.id]?.trainingType || ''} onChange={(e) => updateEditedWorkout(w.id, 'trainingType', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                                  <option value="" disabled>Select Run Type *</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals (Run/Walk)</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery Run</option><option value="SpeedRoad">Speed Workout - Road</option><option value="SpeedTrack">Speed Workout - Track</option><option value="Tempo">Tempo Runs</option><option value="Threshold">Threshold Runs</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                                </select>
                                <input type="text" value={editedWorkouts[w.id]?.miles || ''} onChange={(e) => updateEditedWorkout(w.id, 'miles', e.target.value)} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent" placeholder="Miles" />
                              </>
                            )}
                          </div>
                          {(editedWorkouts[w.id]?.type || w.type) !== "rest" && (
                            <div className="grid md:grid-cols-3 gap-2">
                              <input type="text" value={editedWorkouts[w.id]?.title || ''} onChange={(e) => updateEditedWorkout(w.id, 'title', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title" />
                              <input type="text" value={editedWorkouts[w.id]?.description || ''} onChange={(e) => updateEditedWorkout(w.id, 'description', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Description" />
                              <input type="text" value={editedWorkouts[w.id]?.paceTarget || ''} onChange={(e) => updateEditedWorkout(w.id, 'paceTarget', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Pace target" />
                            </div>
                          )}
                          {(editedWorkouts[w.id]?.type || w.type) === "run" && (
                            <div className="grid md:grid-cols-2 gap-2">
                              <input type="text" value={editedWorkouts[w.id]?.location || ''} onChange={(e) => updateEditedWorkout(w.id, 'location', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" />
                              <input type="text" value={editedWorkouts[w.id]?.coachNotes || ''} onChange={(e) => updateEditedWorkout(w.id, 'coachNotes', e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes" />
                            </div>
                          )}
                          {(editedWorkouts[w.id]?.type || w.type) === "cross" && <textarea value={editedWorkouts[w.id]?.description || ''} onChange={(e) => updateEditedWorkout(w.id, 'description', e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Full workout details..." />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {editingWeek && <div className="flex gap-3"><button onClick={handleSaveEditedWeek} disabled={savingEdit} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50">{savingEdit ? "Saving..." : "Save Changes"}</button><button onClick={() => { if (selectedWeek) unpublishWeek(selectedWeek.weekId); }} className="border border-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm">Unpublish (move to drafts)</button></div>}
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
                        <p className="text-gray-400 text-xs">{week.focus} &bull; {week.workouts.length} workouts</p>
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
                          <p className="text-gray-500 text-xs">{w.day.slice(0,3)}</p>
                          <p className="text-white text-xs font-medium truncate">{w.title || getTypeLabel(w.type)}</p>
                          {w.miles && <p className="text-accent text-xs">{w.miles}mi</p>}
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
                <h3 className="font-heading text-lg uppercase text-white">{editingDraftId ? "Edit Week Plan" : "Create Week Plan"}</h3>
                <p className="text-gray-400 text-sm">{editingDraftId ? "Editing existing draft. Save to update." : "Save as a draft to review later, or publish directly to make it visible to your client."}</p>
                <p className="text-gray-500 text-xs"><span className="text-accent">*</span> Required fields: Week Date Range. At least one workout day should have a type selected.</p>
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
                        <div className="grid grid-cols-7 gap-1 mb-1">{["M","T","W","T","F","S","S"].map((d,i) => <div key={i} className="text-center text-gray-500 text-xs py-1">{d}</div>)}</div>
                        {getWeeksInMonth(pickerMonth).map((week, wi) => { const monday = week[0]; const isSelected = selectedWeekStart && monday.getTime() === selectedWeekStart.getTime(); return (
                          <button key={wi} onClick={() => selectWeek(monday)} className={`w-full grid grid-cols-7 gap-1 rounded-lg py-1 transition-colors ${isSelected ? "bg-accent/20" : "hover:bg-white/5"}`}>
                            {week.map((day, di) => <div key={di} className={`text-center text-xs py-1 rounded ${day.getMonth() === pickerMonth.getMonth() ? (isSelected ? "text-accent font-bold" : "text-white") : "text-gray-600"}`}>{day.getDate()}</div>)}
                          </button>); })}
                        <p className="text-gray-500 text-xs mt-2 text-center">Click a row to select Mon-Sun</p>
                      </div>
                    )}
                  </div>
                  <div><label className="text-gray-400 text-xs block mb-1">Week Focus</label><input type="text" value={weekPlan.focus} onChange={(e) => setWeekPlan({ ...weekPlan, focus: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="e.g. Speed & Long Run" /></div>
                </div>
                {/* Week date validation warning */}
                {weekDateWarning && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
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
                        <span className="text-gray-600 text-xs">({day.workouts.length} workout{day.workouts.length > 1 ? 's' : ''})</span>
                      </div>
                      {/* Workouts for this day */}
                      {day.workouts.map((wo, wi) => (
                        <div key={wi} className={`${wi > 0 ? "mt-3 pt-3 border-t border-white/5" : ""}`}>
                          <div className="flex items-center gap-3">
                            {day.workouts.length > 1 && <span className="text-gray-600 text-xs w-4">{wi + 1}.</span>}
                            <select value={wo.type || ""} onChange={(e) => { updateDayPlan(i, wi, "type", e.target.value); if (e.target.value === "rest") { updateDayPlan(i, wi, "trainingType", "Rest"); updateDayPlan(i, wi, "title", ""); updateDayPlan(i, wi, "miles", ""); } else { updateDayPlan(i, wi, "trainingType", ""); } }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent">
                              <option value="" disabled>Type</option><option value="cross">Cross Training</option><option value="cycling">Cycling</option><option value="rest">Rest</option><option value="run">Run</option><option value="stretching">Stretching</option><option value="walk">Walk</option>
                            </select>
                            {wo.type === "rest" && <span className="text-green-400 text-xs">Rest Day</span>}
                            {wo.type === "run" && (
                              <>
                                <select value={wo.trainingType || ""} onChange={(e) => updateDayPlan(i, wi, "trainingType", e.target.value)} className={`bg-primary/50 border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent ${!wo.trainingType ? "border-accent/50" : "border-white/10"}`}>
                                  <option value="" disabled>Run Type *</option><option value="ClosePace">Close to Race Pace</option><option value="Easy">Easy Run</option><option value="Fartlek">Fartlek</option><option value="Hills">Hill Repeats</option><option value="Intervals">Intervals (Run/Walk)</option><option value="LongRun">Long Run</option><option value="Progressive">Progressive</option><option value="RacePace">Race Pace</option><option value="Recovery">Recovery Run</option><option value="SpeedRoad">Speed - Road</option><option value="SpeedTrack">Speed - Track</option><option value="Tempo">Tempo</option><option value="Threshold">Threshold</option><option value="TimeTrial">Time Trial</option><option value="Trail">Trail</option><option value="Treadmill">Treadmill</option>
                                </select>
                                <div className="flex items-center gap-1">
                                  <input type="text" value={wo.miles} onChange={(e) => updateDayPlan(i, wi, "miles", e.target.value)} className={`w-14 bg-primary/50 border rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent ${!wo.miles ? "border-accent/50" : "border-white/10"}`} placeholder="Dist *" />
                                  <button type="button" onClick={() => updateDayPlan(i, wi, "distanceUnit", wo.distanceUnit === "km" ? "mi" : "km")} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold hover:border-accent"><span className={wo.distanceUnit === "km" ? "text-accent" : "text-white"}>{wo.distanceUnit === "km" ? "km" : "mi"}</span></button>
                                </div>
                              </>
                            )}
                            {wo.type === "walk" && (
                              <>
                                <select value={wo.trainingType || ""} onChange={(e) => updateDayPlan(i, wi, "trainingType", e.target.value)} className={`bg-primary/50 border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent ${!wo.trainingType ? "border-accent/50" : "border-white/10"}`}>
                                  <option value="" disabled>Walk Type *</option><option value="WalkPower">Walk Power</option><option value="WalkRecovery">Walk Recovery</option>
                                </select>
                                <div className="flex items-center gap-1">
                                  <input type="text" value={wo.miles} onChange={(e) => updateDayPlan(i, wi, "miles", e.target.value)} className={`w-14 bg-primary/50 border rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-accent ${!wo.miles ? "border-accent/50" : "border-white/10"}`} placeholder="Dist *" />
                                  <button type="button" onClick={() => updateDayPlan(i, wi, "distanceUnit", wo.distanceUnit === "km" ? "mi" : "km")} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-xs font-bold hover:border-accent"><span className={wo.distanceUnit === "km" ? "text-accent" : "text-white"}>{wo.distanceUnit === "km" ? "km" : "mi"}</span></button>
                                </div>
                              </>
                            )}
                            {wo.type === "stretching" && (
                              <select value={wo.trainingType || ""} onChange={(e) => updateDayPlan(i, wi, "trainingType", e.target.value)} className={`bg-primary/50 border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent ${!wo.trainingType ? "border-accent/50" : "border-white/10"}`}>
                                <option value="" disabled>Type *</option><option value="FoamRoll">Foam Roll</option><option value="Stretching">Stretching</option><option value="Yoga">Yoga</option>
                              </select>
                            )}
                            {day.workouts.length > 1 && <button type="button" onClick={() => removeWorkoutFromDay(i, wi)} className="text-red-400 hover:text-red-300 text-xs ml-auto">Remove</button>}
                          </div>
                          {(wo.type === "run" || wo.type === "walk") && (<div className="grid md:grid-cols-3 gap-2 mt-2"><input type="text" value={wo.title} onChange={(e) => updateDayPlan(i, wi, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title" /><input type="text" value={wo.description} onChange={(e) => updateDayPlan(i, wi, "description", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Description" /><input type="text" value={wo.paceTarget} onChange={(e) => updateDayPlan(i, wi, "paceTarget", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Pace target" /></div>)}
                          {(wo.type === "run" || wo.type === "walk") && (<div className="grid md:grid-cols-2 gap-2 mt-2"><input type="text" value={wo.location} onChange={(e) => updateDayPlan(i, wi, "location", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" /><input type="text" value={wo.coachNotes} onChange={(e) => updateDayPlan(i, wi, "coachNotes", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes" /></div>)}
                          {wo.type === "cross" && (<><div className="grid md:grid-cols-2 gap-2 mt-2"><input type="text" value={wo.title} onChange={(e) => updateDayPlan(i, wi, "title", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Title" /><input type="text" value={wo.location} onChange={(e) => updateDayPlan(i, wi, "location", e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Location" /></div><textarea value={wo.description} onChange={(e) => updateDayPlan(i, wi, "description", e.target.value)} className="w-full mt-2 bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Full workout details..." /></>)}
                          {(wo.type === "cycling" || wo.type === "stretching") && (<textarea value={wo.description} onChange={(e) => updateDayPlan(i, wi, "description", e.target.value)} className="w-full mt-2 bg-primary/50 border border-white/10 rounded px-2 py-2 text-white text-xs focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Full workout details..." />)}
                          {wo.type === "rest" && <div className="mt-2"><input type="text" value={wo.coachNotes} onChange={(e) => updateDayPlan(i, wi, "coachNotes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent" placeholder="Coach notes (optional)" /></div>}
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
                              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs w-32 focus:outline-none focus:border-accent" placeholder="Template name" />
                              <input type="text" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs w-24 focus:outline-none focus:border-accent" placeholder="Category" />
                              <button type="button" onClick={() => handleSaveDayTemplate(i)} disabled={!templateName.trim() || savingTemplate} className="text-green-400 text-xs hover:text-green-300 disabled:opacity-50">{savingTemplate ? "..." : "Save"}</button>
                              <button type="button" onClick={() => { setShowSaveDayTemplate(null); setTemplateName(""); setTemplateCategory(""); }} className="text-gray-500 text-xs hover:text-white">Cancel</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setShowSaveDayTemplate(i); setTemplateName(day.workouts[0]?.title || `${day.day} ${day.workouts[0]?.trainingType || day.workouts[0]?.type}`); }} className="text-gray-500 hover:text-gold text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save as Template</button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
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
                    <div><p className="text-white text-sm font-medium">{selectedClientData.name}</p><p className="text-gray-500 text-xs">{selectedClientData.goal || "No active plan"}</p></div>
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
                      className="flex-1 bg-primary/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent resize-none max-h-32"
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
                  <h2 className="font-heading text-2xl uppercase text-white">Notification Settings</h2>
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
                    <p className="text-gray-500 text-xs mb-3">Get an email each time any client completes a workout with their effort, miles, pace, and notes</p>
                    <div className="flex gap-2">
                      <button onClick={() => updateNotifSetting("workoutCompleted", "immediate")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutCompleted === "immediate" ? "bg-green-500/20 border border-green-500/40 text-green-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Immediately</button>
                      <button onClick={() => updateNotifSetting("workoutCompleted", "off")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutCompleted === "off" ? "bg-green-500/20 border border-green-500/40 text-green-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Off</button>
                    </div>
                  </div>

                  <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="text-red-400">&#10007;</span><p className="text-white text-sm font-medium">Client skips a workout</p></div>
                    <p className="text-gray-500 text-xs mb-3">Get an email each time any client skips a workout with their reason</p>
                    <div className="flex gap-2">
                      <button onClick={() => updateNotifSetting("workoutSkipped", "immediate")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutSkipped === "immediate" ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Immediately</button>
                      <button onClick={() => updateNotifSetting("workoutSkipped", "off")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).workoutSkipped === "off" ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Off</button>
                    </div>
                  </div>

                  <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="text-yellow-400">&#189;</span><p className="text-white text-sm font-medium">Client partially completes a workout</p></div>
                    <p className="text-gray-500 text-xs mb-3">Get an email each time any client partially completes a workout with what they did and why they stopped</p>
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
                    <p className="text-gray-500 text-xs mb-3">Get an email each time a client sends you a message</p>
                    <div className="flex gap-2">
                      <button onClick={() => updateNotifSetting("clientMessage", "immediate")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).clientMessage === "immediate" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Immediately</button>
                      <button onClick={() => updateNotifSetting("clientMessage", "off")} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${(notifications as any).clientMessage === "off" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Off</button>
                    </div>
                  </div>
                </div>

                {/* Email Destination */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gray-400 mb-2">Send Notifications To</h3>
                  <p className="text-gray-500 text-xs mb-4">Where should notification emails be sent? You can add multiple email addresses separated by commas.</p>
                  <div className="flex gap-3">
                    <input type="text" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="crystal@pistolpc.com, backup@gmail.com" />
                    <button onClick={() => { saveAdminNotifPrefs(notifications, notifEmail); setNotifEmailSaved(true); setTimeout(() => setNotifEmailSaved(false), 3000); }} className="bg-accent hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-sm">{notifEmailSaved ? "Saved ✓" : "Save"}</button>
                  </div>
                  <p className="text-gray-600 text-xs mt-2">Separate multiple addresses with a comma.</p>
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
                  <h3 className="font-heading text-sm uppercase text-gold mb-4">Week Templates ({weekTemplates.length})</h3>
                  {weekTemplates.length === 0 ? (
                    <p className="text-gray-500 text-sm">No week templates saved yet. Build a week plan for a client and click &ldquo;Save as Template&rdquo; to create one.</p>
                  ) : (
                    <div className="space-y-3">
                      {weekTemplates.map((t) => (
                        <div key={t.id} className="bg-primary/30 border border-white/5 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="text-white font-medium">{t.name}</h4>
                              <p className="text-gray-500 text-xs">{t.category && <span className="text-gold">{t.category} · </span>}{t.data.days?.filter((d: any) => d.type === 'run').length || 0} runs, {t.data.days?.filter((d: any) => d.type === 'cross').length || 0} cross, {t.data.days?.filter((d: any) => d.type === 'rest').length || 0} rest{t.data.focus && ` · Focus: ${t.data.focus}`}</p>
                            </div>
                            <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-500 hover:text-red-400 text-xs transition-colors border border-white/10 px-3 py-1 rounded">Delete</button>
                          </div>
                          {/* Preview grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {(t.data.days || []).map((d: any, i: number) => (
                              <div key={i} className={`rounded p-2 text-center ${d.type === 'run' ? 'bg-accent/10' : d.type === 'cross' ? 'bg-gold/10' : 'bg-green-500/10'}`}>
                                <p className="text-gray-500 text-xs">{d.day?.slice(0, 3)}</p>
                                <p className="text-white text-xs font-medium truncate">{d.title || d.trainingType || (d.type === 'rest' ? 'Rest' : d.type === 'cross' ? 'Cross' : 'Run')}</p>
                                {d.miles && <p className="text-accent text-xs">{d.miles}mi</p>}
                              </div>
                            ))}
                          </div>
                          {t.data.coachMessage && (
                            <div className="mt-2 bg-gold/5 border border-gold/10 rounded-lg p-2">
                              <p className="text-gold text-xs">Coach message: {t.data.coachMessage}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Day Templates */}
                <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
                  <h3 className="font-heading text-sm uppercase text-gold mb-4">Day Templates ({dayTemplates.length})</h3>
                  {dayTemplates.length === 0 ? (
                    <p className="text-gray-500 text-sm">No day templates saved yet. When creating a week, click &ldquo;Save Day as Template&rdquo; on any workout to save it.</p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                      {dayTemplates.map((t) => (
                        <div key={t.id} className={`border rounded-xl p-4 ${t.data.type === 'run' ? 'border-accent/20 bg-accent/5' : t.data.type === 'cross' ? 'border-gold/20 bg-gold/5' : 'border-green-500/20 bg-green-500/5'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white text-sm font-medium">{t.name}</h4>
                            <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                          </div>
                          <div className="space-y-1 text-xs">
                            {t.category && <p className="text-gold">{t.category}</p>}
                            <p className="text-gray-400">
                              <span className={`font-bold ${t.data.type === 'run' ? 'text-accent' : t.data.type === 'cross' ? 'text-gold' : 'text-green-400'}`}>{t.data.type === 'run' ? 'Run' : t.data.type === 'cross' ? 'Cross Training' : 'Rest'}</span>
                              {t.data.trainingType && t.data.trainingType !== 'Rest' && <span> · {t.data.trainingType}</span>}
                              {t.data.miles && <span> · {t.data.miles} mi</span>}
                            </p>
                            {t.data.title && <p className="text-white">{t.data.title}</p>}
                            {t.data.description && <p className="text-gray-400">{t.data.description}</p>}
                            {t.data.paceTarget && <p className="text-accent">Target: {t.data.paceTarget}</p>}
                            {t.data.location && <p className="text-gray-500">Location: {t.data.location}</p>}
                            {t.data.coachNotes && <p className="text-gold">Notes: {t.data.coachNotes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
              const allDrafts = clients.filter(c => c.status === "active").flatMap(c => c.weeks.filter(w => w.status === "draft").map(w => ({ client: c, week: w })));
              const unpaidClients = clients.filter(c => c.status === "active" && c.owed - c.paid > 0);
              return (
                <>
                  {/* Drafts Ready to Publish */}
                  {allDrafts.length > 0 && (
                    <div className="bg-secondary/50 border border-yellow-500/20 rounded-xl p-5">
                      <h3 className="font-heading text-sm uppercase text-yellow-400 mb-3">Drafts Ready to Publish</h3>
                      <div className="space-y-2">
                        {allDrafts.map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-primary/30 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{item.client.name.charAt(0)}</div>
                              <div><p className="text-white text-sm">{item.client.name}</p><p className="text-gray-500 text-xs">{item.week.dateRange} &mdash; {item.week.focus}</p></div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setSelectedClient(item.client.id); setClientTab("drafts"); }} className="text-gray-400 hover:text-white text-xs border border-white/10 px-3 py-1 rounded">View</button>
                              <button onClick={() => { const updated = clients.map(c => { if (c.id === item.client.id) { return { ...c, weeks: c.weeks.map(w => w.weekId === item.week.weekId ? { ...w, status: "published" as const } : w) }; } return c; }); setClients(updated); }} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded font-bold">Publish</button>
                            </div>
                          </div>
                        ))}
                      </div>
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
                      <h3 className="font-heading text-sm uppercase text-gray-400 mb-3">Outstanding Payments</h3>
                      <div className="space-y-2">
                        {unpaidClients.map((c) => (
                          <button key={c.id} onClick={() => { setSelectedClient(c.id); setClientTab("account"); }} className="w-full flex items-center justify-between bg-primary/30 rounded-lg p-3 hover:bg-white/5 transition-colors text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">{c.name.charAt(0)}</div>
                              <p className="text-white text-sm">{c.name}</p>
                            </div>
                            <div className="text-right"><p className="text-white text-sm font-medium">${(c.owed - c.paid).toFixed(0)} due</p><p className="text-gray-500 text-xs">${c.paid}/${c.owed} paid</p></div>
                          </button>
                        ))}
                      </div>
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
    </div>
  );
}
