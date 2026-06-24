"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

type WorkoutLog = { rpe: string; stress: string; notes: string; energy: string; motivation: string; sleep: string; strength: string; recovery: string; mood: string; hunger: string; actualMiles?: string; actualPace?: string; onPeriod?: string; duration?: string; avgHeartrate?: number | null; maxHeartrate?: number | null; };
type WorkoutDay = { id: string; day: string; date: string; type: "run" | "cross" | "rest"; trainingType: string; title: string; miles: number | null; distanceUnit?: "mi" | "km"; distanceUnit?: "mi" | "km"; description: string; paceTarget?: string; location?: string; coachNotes?: string; completed: boolean; stravaSynced?: boolean; stravaActivityName?: string | null; status?: "complete" | "partial" | "skipped"; skipReason?: string; log?: WorkoutLog; };
type ClientWorkout = { id: string; day: string; type: string; trainingType: string | null; miles: number | null; notes: string | null; createdAt: string; isClientAdded: true; completed: boolean; completedNotes: string | null; source?: string; stravaActivityId?: string | null; duration?: string | null; averagePace?: string | null; activityName?: string | null; avgHeartrate?: number | null; maxHeartrate?: number | null; };
type WeekData = { weekId: string; label: string; dateRange: string; focus: string; coachMessage: string; workouts: WorkoutDay[]; clientWorkouts: ClientWorkout[]; stravaActivities?: { id: string; day: string; type: string; miles: number; duration: string; averagePace: string; activityName: string; matchStatus: string; suggestedMatchId: string | null }[]; };

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"training" | "messages" | "account">("training");
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [editingWorkoutLog, setEditingWorkoutLog] = useState<string | null>(null);
  const [showLinkOptions, setShowLinkOptions] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [defaultExpanded, setDefaultExpanded] = useState(true);

  // Fetch unread message count
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages/unread');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };
    fetchUnread();
    // Poll every 30 seconds for new messages
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);
  const [showMessageForm, setShowMessageForm] = useState(false);

  const [statsFilter, setStatsFilter] = useState<"thisWeek" | "allTime">("thisWeek");

  const [clientMessages, setClientMessages] = useState<{id: string; date: string; from: string; message: string}[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [clientMessages]);

  // Fetch messages from API - only when Messages tab is active
  // (fetching marks messages as read in DB, so we don't want to do it on every page load)
  useEffect(() => {
    if (activeTab !== "messages") return;
    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/messages');
        if (res.ok) {
          const data = await res.json();
          setClientMessages(data);
          setUnreadCount(0); // Messages are now marked read
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };
    fetchMessages();
    // Poll every 30 seconds for new messages while on Messages tab
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      if (res.ok) {
        const data = await res.json();
        setClientMessages(prev => [...prev, {
          id: data.messageId,
          date: new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          from: 'client',
          message: newMessage.trim(),
        }]);
        setNewMessage("");
        setShowMessageForm(false);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const [clientInfo, setClientInfo] = useState<{goal: string; planEnd: string; startDate: string; owed: number; paid: number; status: string} | null>(null);
  const [allPlans, setAllPlans] = useState<{goal: string; startDate: string; planEnd: string; owed: number; paid: number; status: string}[]>([]);
  const [clientGender, setClientGender] = useState<string | null>(null);
  const [notifPlanPublished, setNotifPlanPublished] = useState(true);
  const [notifMessages, setNotifMessages] = useState<"immediate" | "daily" | "off">("immediate");
  const [notifStravaSynced, setNotifStravaSynced] = useState(true);
  const [notifWorkoutComments, setNotifWorkoutComments] = useState(true);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [loggedInName, setLoggedInName] = useState("");
  const [clientDistanceUnit, setClientDistanceUnit] = useState<"mi" | "km">("mi");
  const [workoutUnitOverrides, setWorkoutUnitOverrides] = useState<Record<string, "mi" | "km">>({});

  // Strava connection state
  const [stravaConnection, setStravaConnection] = useState<{ connected: boolean; athleteName?: string; athleteProfile?: string } | null>(null);
  const [disconnectingStrava, setDisconnectingStrava] = useState(false);
  const [stravaError, setStravaError] = useState("");
  const [showStravaImport, setShowStravaImport] = useState(false);
  const [stravaImportFrom, setStravaImportFrom] = useState("");
  const [stravaImportTo, setStravaImportTo] = useState(new Date().toISOString().split('T')[0]);
  const [stravaImporting, setStravaImporting] = useState(false);
  const [stravaImportResult, setStravaImportResult] = useState<{ imported: number; skipped: number; message: string } | null>(null);

  // New updates badge & dropdown
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [showUpdatesDropdown, setShowUpdatesDropdown] = useState(false);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [lastSeenUpdates, setLastSeenUpdates] = useState<string>("");

  const clientUpdates = [
    { date: "June 24, 2026", items: [
      "Strava activities now auto-match to your programmed workout when it's an obvious fit — no more manual confirmation needed",
      "Auto-matched workouts show the Strava badge and your miles/pace/duration/HR automatically on the programmed card",
      "No more 'Extra' workout appearing when Strava clearly matches your plan — only shows as Extra when the match isn't clear",
      "Fixed duplicate issue — matched Strava workouts no longer show as both a completed programmed workout AND a separate Extra entry",
      "You can now EDIT your workout log after submitting — tap the Edit button to fix mistakes (wrong miles, RPE, pace, notes, etc.)",
      "Strava activities with 0 miles (accidental watch start/stop) no longer get matched to your programmed workout",
    ]},
    { date: "June 22, 2026", items: [
      "Workout cards redesigned — cleaner layout with metrics in compact pills on one line",
      "New source badges: 'Programmed' (Crystal's workouts), 'Your Workout' (yours), 'Extra' (Strava standalone)",
      "Strava-synced workouts show the orange Strava logo + activity name as a badge",
      "Removed redundant 'Synced from Strava' and 'Kept as extra' text — badges handle it",
      "Removed green 'Completed' badge — the green checkmark is enough",
      "Distance now shows actual (green) and target (gray) side by side after completion",
      "You can now comment on all workout types — your added workouts and Strava extras too",
    ]},
    { date: "June 21, 2026", items: [
      "New notification toggles in Account: Strava Activity Synced + Workout Comments",
      "You can now turn off Strava sync emails and workout comment emails individually",
      "Header now sticks to the top when you scroll — always accessible",
      "Bell icon in header shows new updates with a red dot badge",
      "Click the bell to see what's new — only shows updates you haven't read",
      "'View all updates' opens a full-screen history of every change",
      "Logout is now an icon (door with arrow) in the header",
      "Crystal now sees all your Strava data (miles, pace, duration, heart rate)",
      "Strava now matches to your own created workouts (not just Crystal's)",
      "Heart rate (avg + max) shows on all Strava-imported workouts",
      "After matching Strava, miles/pace/duration/HR show on the card",
      "Actual miles now show in green on the right after completing a workout",
      "MI/KM toggle now converts your logged data too (actual miles + pace)",
      "RPE and Sleep sliders stack vertically on mobile — easier to use",
      "Email sent when Strava syncs a new activity to your account",
      "'Keep as extra workout' now saves properly after page reload",
    ]},
    { date: "June 20, 2026", items: [
      "New logo as browser tab icon",
      "Strava imports attach below the workout they match (dotted connector line)",
      "Unmatched imports clearly show 'No Match Found'",
      "'I Did This' / 'I Skipped This' hide when Strava match is pending",
      "Strava match confirmation now requires RPE, Sleep, and Notes",
      "Stats only counts Run + Walk miles (not cycling, cross training)",
    ]},
    { date: "June 18, 2026", items: [
      "Text is brighter and easier to read everywhere",
      "Your added workouts now save when you mark them Done",
      "Stats section looks better on mobile",
      "Distance preference (Miles/KM) saves correctly after logout",
    ]},
    { date: "June 16, 2026", items: [
      "Day blocks are now collapsible — tap any day to expand/collapse",
      "Your added workouts show as planned until you mark them Done",
      "Stats: see programmed workouts and your own workouts separately",
    ]},
    { date: "June 15, 2026", items: [
      "Add your own workouts under each day",
      "Crystal can comment on your completed workouts (you get an email)",
      "Per-workout mi/km toggle to quickly check conversions",
      "Rest days simplified — just an optional comment button",
    ]},
    { date: "June 14, 2026", items: [
      "Distance unit preference — set default to Miles or KM",
      "Your name now shows at the top of the dashboard",
    ]},
  ];

  useEffect(() => {
    const lastSeen = localStorage.getItem("changelog_last_seen_client") || "";
    setLastSeenUpdates(lastSeen);
    if (!lastSeen || lastSeen < "2026-06-22T22:00:00Z") {
      setShowNewBadge(true);
    }
  }, []);

  // Fetch Strava connection status
  useEffect(() => {
    const fetchStravaConnection = async () => {
      try {
        const res = await fetch('/api/strava/connection');
        if (res.ok) {
          const data = await res.json();
          setStravaConnection(data);
        }
      } catch (err) {
        console.error('Failed to fetch Strava connection:', err);
        setStravaConnection({ connected: false });
      }
    };
    fetchStravaConnection();

    // Check for Strava callback params
    const params = new URLSearchParams(window.location.search);
    const stravaParam = params.get('strava');
    if (stravaParam === 'connected') {
      // Just connected - fetch status will show it
    } else if (stravaParam === 'denied') {
      setStravaError('You denied access to Strava. Connect again if you change your mind.');
    } else if (stravaParam === 'error') {
      setStravaError('Something went wrong connecting Strava. Please try again.');
    } else if (stravaParam === 'scope_error') {
      setStravaError('Strava needs "activity:read" permission. Please reconnect and approve all permissions.');
    }
  }, []);

  const handleDisconnectStrava = async () => {
    if (!confirm('Disconnect Strava? Your previously synced workouts will remain, but new activities won\'t sync.')) return;
    setDisconnectingStrava(true);
    try {
      const res = await fetch('/api/strava/connection', { method: 'DELETE' });
      if (res.ok) {
        setStravaConnection({ connected: false });
      }
    } catch (err) {
      console.error('Failed to disconnect Strava:', err);
    } finally {
      setDisconnectingStrava(false);
    }
  };

  const handleStravaImport = async () => {
    if (!stravaImportFrom) return;
    setStravaImporting(true);
    setStravaImportResult(null);
    try {
      const res = await fetch('/api/strava/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          afterDate: stravaImportFrom,
          beforeDate: stravaImportTo || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStravaImportResult(data);
        if (data.imported > 0) {
          // Reload the page after a short delay to show the imported workouts
          setTimeout(() => window.location.reload(), 2000);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setStravaImportResult({ imported: 0, skipped: 0, message: err.error || 'Import failed. Please try again.' });
      }
    } catch (err) {
      console.error('Failed to import Strava activities:', err);
      setStravaImportResult({ imported: 0, skipped: 0, message: 'Network error. Please try again.' });
    } finally {
      setStravaImporting(false);
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
          setLoggedInName(profile?.name || user.email || '');
        }
      } catch (err) { console.error(err); }
    };
    fetchMe();
  }, []);

  // Fetch notification preferences
  useEffect(() => {
    const fetchNotifPrefs = async () => {
      try {
        const res = await fetch('/api/notification-preferences');
        if (res.ok) {
          const data = await res.json();
          setNotifPlanPublished(data.planPublished);
          setNotifMessages(data.messages);
          if (data.stravaSynced !== undefined) setNotifStravaSynced(data.stravaSynced);
          if (data.workoutComments !== undefined) setNotifWorkoutComments(data.workoutComments);
          if (data.distanceUnit) setClientDistanceUnit(data.distanceUnit);
          if (data.defaultExpanded !== undefined) setDefaultExpanded(data.defaultExpanded);
        }
      } catch (err) {
        console.error('Failed to fetch notification prefs:', err);
      } finally {
        setNotifLoaded(true);
      }
    };
    fetchNotifPrefs();
  }, []);

  // Save notification preferences
  const saveNotifPrefs = async (planPublished: boolean, messages: string) => {
    setNotifSaving(true);
    try {
      await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planPublished, messages }),
      });
    } catch (err) {
      console.error('Failed to save notification prefs:', err);
    } finally {
      setNotifSaving(false);
    }
  };

  // Save distance unit preference
  const saveDistanceUnit = async (unit: "mi" | "km") => {
    setClientDistanceUnit(unit);
    setWorkoutUnitOverrides({}); // Reset per-workout overrides when global preference changes
    try {
      await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distanceUnit: unit }),
      });
    } catch (err) {
      console.error('Failed to save distance unit:', err);
    }
  };

  const saveDefaultExpanded = async (expanded: boolean) => {
    setDefaultExpanded(expanded);
    setExpandedDays({}); // Reset explicit overrides so new default takes effect
    try {
      await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultExpanded: expanded }),
      });
    } catch (err) {
      console.error('Failed to save default expanded:', err);
    }
  };

  // Fetch client's own plan info
  useEffect(() => {
    const fetchPlanInfo = async () => {
      try {
        const res = await fetch('/api/my-plans');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setClientInfo(data.activePlan || null);
            setAllPlans(data.allPlans || []);
            setClientGender(data.gender || null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch plan info:', err);
      }
    };
    fetchPlanInfo();
  }, []);

  const [weeks, setWeeks] = useState<WeekData[]>([]); // All published weeks from API
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, +1 = next week
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [minOffset, setMinOffset] = useState(0); // furthest back we can go
  const [maxOffset, setMaxOffset] = useState(0); // furthest forward we can go

  // Helper: get the Monday of a week offset from current week
  const getMondayForOffset = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const targetMonday = new Date(thisMonday);
    targetMonday.setDate(thisMonday.getDate() + (offset * 7));
    return targetMonday;
  };

  // Helper: format a date range for a given offset
  const getWeekLabel = (offset: number) => {
    const monday = getMondayForOffset(offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)} - ${fmt(sunday)}`;
  };

  // Helper: find the published plan for a given week offset (or null)
  const getWeekPlan = (offset: number): WeekData | null => {
    const monday = getMondayForOffset(offset);
    const mondayStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    // Try exact match first (week starts on Monday)
    const exact = weeks.find(w => w.dateRange.startsWith(mondayStr));
    if (exact) return exact;
    // Try day before (week might start on Sunday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() - 1);
    const sundayStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return weeks.find(w => w.dateRange.startsWith(sundayStr)) || null;
  };

  // Fetch published weeks from API
  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const res = await fetch('/api/my-weeks');
        if (res.ok) {
          const data = await res.json();
          const mapped: WeekData[] = data.map((w: any) => ({
            weekId: w.weekId,
            label: w.dateRange,
            dateRange: w.dateRange,
            focus: w.focus || '',
            coachMessage: w.coachMessage || '',
            stravaActivities: (w.stravaActivities || []).map((sa: any) => ({
              id: sa.id,
              day: sa.day,
              type: sa.type,
              miles: sa.miles,
              duration: sa.duration,
              averagePace: sa.averagePace,
              activityName: sa.activityName,
              matchStatus: sa.matchStatus,
              suggestedMatchId: sa.suggestedMatchId || null,
              suggestedClientMatchId: sa.suggestedClientMatchId || null,
            })),
            clientWorkouts: (w.clientWorkouts || []).map((cw: any) => ({
              id: cw.id,
              day: cw.day,
              type: cw.type,
              trainingType: cw.trainingType || null,
              miles: cw.miles,
              notes: cw.notes,
              createdAt: cw.createdAt,
              isClientAdded: true as const,
              completed: cw.completed || false,
              completedNotes: cw.completedNotes || cw.completed_notes || null,
              source: cw.source || 'manual',
              stravaActivityId: cw.stravaActivityId || null,
              duration: cw.duration || null,
              averagePace: cw.averagePace || null,
              activityName: cw.activityName || null,
              avgHeartrate: cw.avgHeartrate || null,
              maxHeartrate: cw.maxHeartrate || null,
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
              status: wo.status || undefined,
              skipReason: wo.skipReason || undefined,
              log: wo.log || undefined,
            })),
          }));
          setWeeks(mapped);

          // Initialize completedClientWorkouts from loaded data
          const completedMap: Record<string, boolean> = {};
          const notesMap: Record<string, string> = {};
          for (const w of mapped) {
            for (const cw of w.clientWorkouts || []) {
              if (cw.completed) completedMap[cw.id] = true;
              if (cw.completedNotes) notesMap[cw.id] = cw.completedNotes;
            }
          }
          setCompletedClientWorkouts(prev => ({ ...prev, ...completedMap }));
          setClientWorkoutNotes(prev => ({ ...prev, ...notesMap }));
          
          // Calculate navigation bounds based on published plans
          const today = new Date();
          const dayOfWeek = today.getDay();
          const thisMonday = new Date(today);
          thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          thisMonday.setHours(0, 0, 0, 0);

          let earliest = 0;
          let latest = 0;
          
          for (const w of mapped) {
            const startStr = w.dateRange.split(' - ')[0];
            const weekMonday = new Date(startStr + ', ' + new Date().getFullYear());
            weekMonday.setHours(0, 0, 0, 0);
            const diffDays = Math.round((weekMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24));
            const offset = Math.round(diffDays / 7);
            if (offset < earliest) earliest = offset;
            if (offset > latest) latest = offset;
          }
          
          setMinOffset(earliest);
          setMaxOffset(latest);
        }
      } catch (err) {
        console.error('Failed to fetch weeks:', err);
      } finally {
        setLoadingWeeks(false);
      }
    };
    fetchWeeks();
  }, []);

  // Distance conversion helpers
  const getWorkoutUnit = (workoutId: string) => workoutUnitOverrides[workoutId] || clientDistanceUnit;
  // Convert distance from one unit to the display unit
  // sourceUnit: what unit the value was entered in (from DB)
  // targetUnit: what unit to display in (from preference or override)
  const convertDist = (value: number, targetUnit?: "mi" | "km", sourceUnit?: "mi" | "km") => {
    const from = sourceUnit || "mi";
    const to = targetUnit || clientDistanceUnit;
    if (from === to) return +value.toFixed(2);
    if (from === "mi" && to === "km") return +(value * 1.60934).toFixed(2);
    if (from === "km" && to === "mi") return +(value / 1.60934).toFixed(2);
    return +value.toFixed(2);
  };
  const distUnitLabel = clientDistanceUnit === "km" ? "KM" : "Miles";
  const distUnitShort = clientDistanceUnit === "km" ? "km" : "mi";

  // Pace conversion helpers (e.g. "9:04/mi" → "5:38/km")
  const convertPaceToKm = (pace: string): string => {
    const match = pace.match(/^(\d+):(\d+)\/mi$/);
    if (!match) return pace;
    const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2]);
    const kmSeconds = Math.round(totalSeconds / 1.60934);
    const mins = Math.floor(kmSeconds / 60);
    const secs = kmSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/km`;
  };
  const convertPaceToMi = (pace: string): string => {
    const match = pace.match(/^(\d+):(\d+)\/km$/);
    if (!match) return pace;
    const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2]);
    const miSeconds = Math.round(totalSeconds * 1.60934);
    const mins = Math.floor(miSeconds / 60);
    const secs = miSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  const [completedClientWorkouts, setCompletedClientWorkouts] = useState<Record<string, boolean>>({});
  const [clientWorkoutNotes, setClientWorkoutNotes] = useState<Record<string, string>>({});

  const currentWeek = getWeekPlan(weekOffset);
  const clientMilesThisWeek = currentWeek ? (currentWeek.clientWorkouts || []).filter(cw => (cw.type === 'run' || cw.type === 'walk') && completedClientWorkouts[cw.id]).reduce((s, cw) => s + (cw.miles || 0), 0) : 0;
  // Convert all programmed miles to client's preferred unit before summing (run + walk only)
  const weeklyTotal = currentWeek ? currentWeek.workouts.filter(w => w.type === 'run' || w.type === 'walk').reduce((sum, w) => sum + (w.miles ? convertDist(w.miles, clientDistanceUnit, w.distanceUnit) : 0), 0) + clientMilesThisWeek : 0;
  const weeklyTotalConverted = weeklyTotal; // already in client's preferred unit
  const completedCount = currentWeek ? currentWeek.workouts.filter((w) => w.completed && w.type !== "rest").length : 0;
  const allWorkouts = weeks.flatMap((w) => w.workouts);
  const allClientWorkoutsMiles = weeks.flatMap((w) => w.clientWorkouts || []).filter(cw => (cw.type === 'run' || cw.type === 'walk') && completedClientWorkouts[cw.id]);

  const statsWorkouts = statsFilter === "thisWeek" ? (currentWeek?.workouts || []).filter(w => w.type !== "rest") : allWorkouts.filter(w => w.type !== "rest");
  const statsMarked = statsWorkouts.filter(w => w.completed);
  const statsComplete = statsWorkouts.filter(w => w.status === "complete" || (w.completed && !w.status));
  const statsPartial = statsWorkouts.filter(w => w.status === "partial");
  const statsSkipped = statsWorkouts.filter(w => w.status === "skipped");
  const clientMilesForStats = statsFilter === "thisWeek" ? clientMilesThisWeek : allClientWorkoutsMiles.reduce((s, cw) => s + (cw.miles || 0), 0);
  const statsMiles = statsComplete.filter(w => w.type === 'run' || w.type === 'walk').reduce((s, w) => {
    if (w.log?.actualMiles) return s + convertDist(Number(w.log.actualMiles), clientDistanceUnit, 'mi');
    return s + convertDist(w.miles || 0, clientDistanceUnit, w.distanceUnit || 'mi');
  }, 0) + statsPartial.filter(w => w.type === 'run' || w.type === 'walk').reduce((s, w) => s + convertDist(Number(w.log?.actualMiles) || 0, clientDistanceUnit, 'mi'), 0) + clientMilesForStats;
  const statsProgrammedMiles = statsWorkouts.filter(w => w.type === 'run' || w.type === 'walk').reduce((s, w) => s + convertDist(w.miles || 0, clientDistanceUnit, w.distanceUnit || 'mi'), 0);
  const statsWeightedCompletion = statsWorkouts.length > 0 ? Math.round(((statsComplete.length * 1 + statsPartial.length * 0.5) / statsWorkouts.length) * 100) : 0;
  const statsAvgRpe = () => { const withRpe = statsMarked.filter(w => w.log?.rpe); if (withRpe.length === 0) return "—"; return (withRpe.reduce((a, w) => a + Number(w.log!.rpe), 0) / withRpe.length).toFixed(1); };

  const [showSkipDialog, setShowSkipDialog] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipType, setSkipType] = useState<"skipped" | "partial">("skipped");

  const [savingLog, setSavingLog] = useState(false);

  // Workout comments state
  const [workoutComments, setWorkoutComments] = useState<Record<string, {id: string; workoutId: string; userId: string; userName: string; message: string; createdAt: string; isCoach: boolean}[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);

  // Fetch workout comments for current week's completed workouts (programmed + client)
  const completedWorkoutIds = currentWeek ? [
    ...currentWeek.workouts.filter(w => w.completed).map(w => w.id),
    ...(currentWeek.clientWorkouts || []).filter(cw => completedClientWorkouts[cw.id]).map(cw => cw.id),
  ].join(',') : '';
  useEffect(() => {
    if (!completedWorkoutIds) return;
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/workout-comments?workout_ids=${completedWorkoutIds}`);
        if (res.ok) {
          const data = await res.json();
          setWorkoutComments(prev => ({ ...prev, ...data }));
        }
      } catch (err) { console.error('Failed to fetch workout comments:', err); }
    };
    fetchComments();
  }, [completedWorkoutIds]);

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

  // Client-added workout state
  const [showAddWorkoutForDay, setShowAddWorkoutForDay] = useState<string | null>(null);
  const [addWorkoutForm, setAddWorkoutForm] = useState({ type: "run", trainingType: "", miles: "", notes: "" });
  const [savingClientWorkout, setSavingClientWorkout] = useState(false);
  const [deletingClientWorkout, setDeletingClientWorkout] = useState<string | null>(null);

  // Strava match state
  const [stravaMatchDecisions, setStravaMatchDecisions] = useState<Record<string, 'matched' | 'standalone' | 'dismissed'>>({});
  const [stravaMatchLog, setStravaMatchLog] = useState<{ stravaActivityId: string; workoutId: string; workoutType: string; rpe: string; sleep: string; notes: string } | null>(null);

  const openStravaMatchLog = (stravaActivityId: string, workoutId: string, workoutType: string) => {
    setStravaMatchLog({ stravaActivityId, workoutId, workoutType, rpe: '', sleep: '', notes: '' });
  };

  const handleStravaMatchConfirm = async () => {
    if (!stravaMatchLog) return;
    const { stravaActivityId, workoutId, workoutType, rpe, sleep, notes } = stravaMatchLog;
    try {
      const res = await fetch('/api/strava/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stravaActivityId,
          action: 'confirm',
          matchedWorkoutId: workoutId,
          matchedWorkoutType: workoutType,
          logData: { rpe: rpe || null, sleep: sleep || null, notes: notes || null },
        }),
      });
      if (res.ok) {
        setStravaMatchDecisions(prev => ({ ...prev, [stravaActivityId]: 'matched' }));
        setStravaMatchLog(null);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (err) {
      console.error('Failed to confirm Strava match:', err);
    }
  };

  const handleStravaMatch = async (stravaActivityId: string, workoutId: string, workoutType: string) => {
    // Open the log form instead of immediately confirming
    openStravaMatchLog(stravaActivityId, workoutId, workoutType);
  };

  const handleStravaReject = async (stravaActivityId: string) => {
    try {
      const res = await fetch('/api/strava/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaActivityId, action: 'reject' }),
      });
      if (res.ok) {
        // Clear the suggestion — the card will now show "add as separate or dismiss" options
        setStravaMatchDecisions(prev => ({ ...prev, [stravaActivityId]: 'standalone' }));
      }
    } catch (err) {
      console.error('Failed to reject Strava match:', err);
    }
  };

  const handleStravaKeepStandalone = async (stravaActivityId: string) => {
    try {
      const res = await fetch('/api/strava/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaActivityId, action: 'add_standalone' }),
      });
      if (res.ok) {
        setStravaMatchDecisions(prev => ({ ...prev, [stravaActivityId]: 'standalone' }));
      }
    } catch (err) {
      console.error('Failed to keep Strava activity standalone:', err);
    }
  };

  const handleStravaDismiss = async (stravaActivityId: string) => {
    try {
      const res = await fetch('/api/strava/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaActivityId, action: 'dismiss' }),
      });
      if (res.ok) {
        setStravaMatchDecisions(prev => ({ ...prev, [stravaActivityId]: 'dismissed' }));
      }
    } catch (err) {
      console.error('Failed to dismiss Strava activity:', err);
    }
  };

  const handleAddClientWorkout = async (day: string) => {
    if (!currentWeek) return;
    const { type, trainingType, miles, notes } = addWorkoutForm;
    if ((type === "run" || type === "walk") && (!trainingType || !miles)) {
      alert("Run and Walk types require a subtype and distance.");
      return;
    }
    if ((type === "run" || type === "walk") && miles && !/^\d+(\.\d{1,2})?$/.test(miles)) {
      alert(`Distance must be a number with up to 2 decimal places (e.g. 4.34).`);
      return;
    }
    setSavingClientWorkout(true);
    try {
      const res = await fetch('/api/client-workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId: currentWeek.weekId,
          day,
          type,
          trainingType: trainingType || null,
          miles: miles || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        const newWorkout = await res.json();
        // Add to local state
        const updated = weeks.map(w => {
          if (w.weekId === currentWeek.weekId) {
            return { ...w, clientWorkouts: [...w.clientWorkouts, { id: newWorkout.id, day, type, trainingType: trainingType || null, miles: miles ? parseFloat(miles) : null, notes: notes || null, createdAt: newWorkout.created_at, isClientAdded: true as const }] };
          }
          return w;
        });
        setWeeks(updated);
        setShowAddWorkoutForDay(null);
        setAddWorkoutForm({ type: "run", trainingType: "", miles: "", notes: "" });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add workout");
      }
    } catch (err) {
      console.error('Failed to add client workout:', err);
    } finally {
      setSavingClientWorkout(false);
    }
  };

  const handleDeleteClientWorkout = async (workoutId: string) => {
    if (!currentWeek) return;
    setDeletingClientWorkout(workoutId);
    try {
      const res = await fetch(`/api/client-workouts?id=${workoutId}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = weeks.map(w => {
          if (w.weekId === currentWeek.weekId) {
            return { ...w, clientWorkouts: w.clientWorkouts.filter(cw => cw.id !== workoutId) };
          }
          return w;
        });
        setWeeks(updated);
      }
    } catch (err) {
      console.error('Failed to delete client workout:', err);
    } finally {
      setDeletingClientWorkout(null);
    }
  };

  const toggleCompleted = async (workoutId: string) => {
    if (!currentWeek) return;
    const workout = currentWeek.workouts.find(w => w.id === workoutId);
    if (!workout) return;

    setSavingLog(true);
    try {
      const res = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          status: 'complete',
          rpe: workout.log?.rpe || null,
          actualMiles: workout.log?.actualMiles || null,
          actualPace: workout.log?.actualPace || null,
          stress: workout.log?.stress || null,
          notes: workout.log?.notes || null,
          onPeriod: workout.log?.onPeriod || null,
          duration: workout.log?.duration || null,
          energy: workout.log?.energy || null,
          motivation: workout.log?.motivation || null,
          sleep: workout.log?.sleep || null,
          strength: workout.log?.strength || null,
          recovery: workout.log?.recovery || null,
          mood: workout.log?.mood || null,
          hunger: workout.log?.hunger || null,
        }),
      });
      if (res.ok) {
        const updated = [...weeks];
        const week = updated.find(w => w.weekId === currentWeek.weekId);
        const wo = week?.workouts.find(w => w.id === workoutId);
        if (wo) { wo.completed = true; wo.status = "complete"; }
        setWeeks(updated);
      }
    } catch (err) {
      console.error('Failed to save workout log:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const markSkipped = async (workoutId: string) => {
    if (!currentWeek) return;
    const workout = currentWeek.workouts.find(w => w.id === workoutId);
    setSavingLog(true);
    try {
      const res = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          status: skipType,
          skipReason: skipReason || null,
          // Include log data for partial completions
          ...(skipType === "partial" && workout?.log ? {
            rpe: workout.log.rpe || null,
            actualMiles: workout.log.actualMiles || null,
            actualPace: workout.log.actualPace || null,
            stress: workout.log.stress || null,
            notes: workout.log.notes || null,
            onPeriod: workout.log.onPeriod || null,
            duration: workout.log.duration || null,
            energy: workout.log.energy || null,
            motivation: workout.log.motivation || null,
            sleep: workout.log.sleep || null,
            strength: workout.log.strength || null,
            recovery: workout.log.recovery || null,
            mood: workout.log.mood || null,
            hunger: workout.log.hunger || null,
          } : {}),
        }),
      });
      if (res.ok) {
        const updated = [...weeks];
        const week = updated.find(w => w.weekId === currentWeek.weekId);
        const wo = week?.workouts.find(w => w.id === workoutId);
        if (wo) { wo.completed = true; wo.status = skipType; wo.skipReason = skipReason; }
        setWeeks(updated);
      }
    } catch (err) {
      console.error('Failed to save skip log:', err);
    } finally {
      setSavingLog(false);
      setShowSkipDialog(null);
      setSkipReason("");
    }
  };
  const updateWorkoutLog = (workoutId: string, field: string, value: string) => { if (!currentWeek) return; const updated = [...weeks]; const week = updated.find(w => w.weekId === currentWeek.weekId); const workout = week?.workouts.find((w) => w.id === workoutId); if (workout) { if (!workout.log) { workout.log = { rpe: "", stress: "", notes: "", energy: "", motivation: "", sleep: "", strength: "", recovery: "", mood: "", hunger: "" }; } (workout.log as Record<string, string>)[field] = value; setWeeks(updated); } };

  const getTypeLabel = (type: string) => { switch (type) { case "cross": return "Cross Training"; case "cycling": return "Cycling"; case "rest": return "Rest"; case "run": return "Run"; case "stretching": return "Stretching"; case "walk": return "Walk"; default: return type; } };
  const getTrainingTypeLabel = (tt: string) => { switch (tt) { case "ClosePace": return "Close to Race Pace"; case "Easy": return "Easy Run"; case "Fartlek": return "Fartlek"; case "Hills": return "Hill Repeats"; case "Intervals": return "Intervals (Run/Walk)"; case "LongRun": return "Long Run"; case "Progressive": return "Progressive"; case "RacePace": return "Race Pace"; case "Recovery": return "Recovery Run"; case "SpeedRoad": return "Speed Workout - Road"; case "SpeedTrack": return "Speed Workout - Track"; case "Tempo": return "Tempo Runs"; case "Threshold": return "Threshold Runs"; case "TimeTrial": return "Time Trial"; case "Trail": return "Trail"; case "Treadmill": return "Treadmill"; case "WalkRecovery": return "Walk Recovery"; case "WalkPower": return "Walk Power"; case "Stretching": return "Stretching"; case "FoamRoll": return "Foam Roll"; case "Yoga": return "Yoga"; case "CrossTraining": return "Cross Training"; case "OrangeTheory": return "Cross Training"; case "Rest": return "Rest"; default: return tt; } };
  const getTypeColor = (type: string) => { switch (type) { case "run": return "border-accent/50 bg-accent/5"; case "cross": return "border-gold/50 bg-gold/5"; case "rest": return "border-green-500/50 bg-green-500/5"; case "walk": return "border-blue-500/50 bg-blue-500/5"; case "cycling": return "border-cyan-500/50 bg-cyan-500/5"; case "stretching": return "border-purple-500/50 bg-purple-500/5"; default: return "border-white/10"; } };
  const getTypeBadge = (type: string) => { switch (type) { case "run": return "bg-accent/20 text-accent"; case "cross": return "bg-gold/20 text-gold"; case "rest": return "bg-green-500/20 text-green-400"; case "walk": return "bg-blue-500/20 text-blue-400"; case "cycling": return "bg-cyan-500/20 text-cyan-400"; case "stretching": return "bg-purple-500/20 text-purple-400"; default: return "bg-gray-500/20 text-gray-400"; } };
  const getTrainingTypeBadge = (tt: string) => { switch (tt) { case "SpeedRoad": case "SpeedTrack": return "bg-red-500/20 text-red-400 border-red-500/30"; case "Tempo": case "Threshold": return "bg-orange-500/20 text-orange-400 border-orange-500/30"; case "LongRun": case "Easy": case "Recovery": case "Treadmill": case "Progressive": case "Trail": return "bg-blue-500/20 text-blue-400 border-blue-500/30"; case "Hills": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; case "RacePace": case "ClosePace": return "bg-green-500/20 text-green-300 border-green-500/30"; case "Intervals": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"; case "TimeTrial": case "Fartlek": return "bg-red-500/20 text-red-300 border-red-500/30"; case "WalkRecovery": case "WalkPower": return "bg-blue-500/20 text-blue-300 border-blue-500/30"; case "Stretching": case "FoamRoll": case "Yoga": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; case "CrossTraining": return "bg-purple-500/20 text-purple-400 border-purple-500/30"; default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"; } };

  return (
    <div className="min-h-screen bg-primary">
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm">Skip to main content</a>
      {/* Header — sticky */}
      <header className="bg-secondary/95 backdrop-blur-sm border-b border-white/10 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {stravaConnection?.connected && stravaConnection.athleteProfile ? (
              <img src={stravaConnection.athleteProfile} alt={loggedInName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <Image src="/IMG_5861.PNG" alt="Pistol Performance Coaching" width={50} height={50} />
            )}
            <div><h1 className="font-heading text-lg uppercase text-white">{loggedInName || "My Training"}</h1><p className="text-gray-400 text-xs">Pistol Performance Coaching</p></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => { setShowUpdatesDropdown(!showUpdatesDropdown); }} className="relative text-gray-400 hover:text-white transition-colors" title="What's New">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {showNewBadge && <span className="absolute -top-1 -right-1 bg-accent text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">!</span>}
              </button>

              {/* Updates Dropdown */}
              {showUpdatesDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setShowUpdatesDropdown(false); setShowNewBadge(false); localStorage.setItem("changelog_last_seen_client", "2026-06-21T22:00:00Z"); setLastSeenUpdates("2026-06-21T22:00:00Z"); }} />
                  <div className="absolute right-0 top-8 w-80 max-h-96 bg-secondary border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <h3 className="text-white text-sm font-heading uppercase">What&apos;s New</h3>
                      {showNewBadge && <span className="text-accent text-[10px] font-bold">New updates!</span>}
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                      {(() => {
                        // Show updates that are newer than what the user last saw
                        // lastSeenUpdates stores the CHANGELOG timestamp they last acknowledged
                        const hasNewUpdates = showNewBadge;
                        if (!hasNewUpdates) {
                          return <p className="text-gray-400 text-xs text-center py-4">You&apos;re all caught up!</p>;
                        }
                        // Show the most recent date's updates as "new"
                        const latestUpdate = clientUpdates[0];
                        return (
                          <div>
                            <p className="text-accent text-xs font-bold mb-1.5">{latestUpdate.date}</p>
                            <ul className="space-y-1">
                              {latestUpdate.items.map((item, i) => (
                                <li key={i} className="text-gray-300 text-xs flex gap-2"><span className="text-accent mt-0.5">•</span><span>{item}</span></li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="px-4 py-2.5 border-t border-white/10">
                      <button onClick={() => { setShowUpdatesDropdown(false); setShowNewBadge(false); localStorage.setItem("changelog_last_seen_client", "2026-06-21T22:00:00Z"); setLastSeenUpdates("2026-06-21T22:00:00Z"); setShowAllUpdates(true); }} className="text-accent hover:text-white text-xs font-medium transition-colors w-full text-center">View all updates</button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <a href="/auth/signout" className="text-gray-400 hover:text-accent transition-colors" title="Logout">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </a>
          </div>
        </div>
      </header>

      {/* Tabs — sticky below header */}
      <nav aria-label="Dashboard tabs" className="border-b border-white/10 bg-secondary/95 backdrop-blur-sm sticky top-[65px] z-30">
        <div className="max-w-7xl mx-auto px-6 flex gap-1" role="tablist" aria-label="Dashboard navigation">
          {[{ key: "training", label: "Training" }, { key: "messages", label: "Messages" }, { key: "account", label: "Account" }].map((tab) => (
            <button key={tab.key} role="tab" aria-selected={activeTab === tab.key} aria-controls={`panel-${tab.key}`} onClick={() => { setActiveTab(tab.key as typeof activeTab); if (tab.key === "messages") setUnreadCount(0); }} className={`px-6 py-3 font-heading uppercase text-sm tracking-wider transition-colors relative ${activeTab === tab.key ? "text-accent border-b-2 border-accent" : "text-gray-400 hover:text-white"}`}>
              {tab.label}
              {tab.key === "messages" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main id="main-content" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* TRAINING TAB (merged with dashboard stats) */}
        {activeTab === "training" && (
          <>
            {/* Loading state */}
            {loadingWeeks && (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading your training...</p>
              </div>
            )}
            {!loadingWeeks && (<>
            {/* Current week badge */}
            {weekOffset === 0 && (
              <div className="text-center">
                <span className="inline-block bg-accent/10 border border-accent/30 rounded-lg py-1.5 px-4 text-accent font-heading text-xs uppercase">Current Week</span>
              </div>
            )}
            {weekOffset !== 0 && (
              <div className={weekOffset < 0 ? "text-right" : "text-left"}>
                <button onClick={() => setWeekOffset(0)} className="text-accent text-xs hover:underline">{weekOffset < 0 ? "Go to current week →" : "← Go to current week"}</button>
              </div>
            )}

            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <button onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week" disabled={weekOffset <= minOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
              <div className="text-center">
                <h2 className="font-heading text-2xl uppercase text-white">{getWeekLabel(weekOffset)}</h2>
                {currentWeek && <p className="text-gray-400 text-sm">{currentWeek.focus}{currentWeek.focus && ' — '}<span className="text-white font-medium">{weeklyTotalConverted.toFixed(2)} {distUnitShort}</span></p>}
              </div>
              <button onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week" disabled={weekOffset >= maxOffset} className="text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>

            {/* No plan for this week */}
            {!currentWeek && (
              <div className="text-center py-8 bg-secondary/30 border border-white/10 rounded-xl">
                <p className="text-gray-400">No training plan published for this week.</p>
                {weekOffset === 0 && <p className="text-gray-300 text-sm mt-1">Check back soon or message Crystal.</p>}
              </div>
            )}

            {/* Has a plan — show stats + workouts */}
            {currentWeek && (<>
            <div className="bg-secondary/30 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm uppercase text-gray-400">Stats</h3>
                <div className="flex gap-1">
                  <button onClick={() => setStatsFilter("thisWeek")} className={`px-3 py-1 rounded text-xs ${statsFilter === "thisWeek" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>This Week</button>
                  <button onClick={() => setStatsFilter("allTime")} className={`px-3 py-1 rounded text-xs ${statsFilter === "allTime" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-white"}`}>All Time</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="text-center"><p className="font-heading text-xl text-accent">{statsMiles.toFixed(2)}<span className="text-gray-300 text-sm">/{statsProgrammedMiles.toFixed(2)}</span></p><p className="text-gray-300 text-xs">{distUnitLabel}</p></div>
                <div className="text-center"><p className="font-heading text-xl text-white">{statsMarked.length}/{statsWorkouts.length}</p><p className="text-gray-300 text-xs">Programmed Workouts</p></div>
                <div className="text-center"><p className="font-heading text-xl text-cyan-400">{(() => {
                  const cws = (currentWeek?.clientWorkouts || []);
                  // Count: client-created + Strava standalone (decided or already persisted as standalone)
                  const yourWorkouts = cws.filter(cw => {
                    if (cw.source !== 'strava') return true;
                    // Strava import that was kept as standalone (just decided)
                    if (cw.stravaActivityId && stravaMatchDecisions[cw.stravaActivityId] === 'standalone') return true;
                    // Strava import already persisted as standalone (not in pending/suggested list anymore)
                    if (cw.source === 'strava' && cw.stravaActivityId && !(currentWeek as any)?.stravaActivities?.some((sa: any) => sa.id === cw.stravaActivityId)) return true;
                    return false;
                  });
                  const completedYours = yourWorkouts.filter(cw => cw.source === 'strava' || completedClientWorkouts[cw.id]);
                  return `${completedYours.length}/${yourWorkouts.length}`;
                })()}</p><p className="text-gray-300 text-xs">Your Workouts</p></div>
                <div className="text-center"><p className="font-heading text-xl text-gold">{statsAvgRpe()}</p><p className="text-gray-300 text-xs">Avg Effort</p></div>
                <div className="text-center"><p className="font-heading text-xl text-green-400">{statsWeightedCompletion}%</p><p className="text-gray-300 text-xs">Completion</p></div>
              </div>
            </div>

            {/* Coach Message */}
            {currentWeek.coachMessage && (
              <div className="bg-secondary/50 border border-gold/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
                  <div><p className="text-gold text-xs font-heading uppercase mb-1">Message from Crystal</p><p className="text-gray-300 text-sm leading-relaxed">{currentWeek.coachMessage}</p></div>
                </div>
              </div>
            )}

            {/* Workout Cards - Grouped by Day (Collapsible) */}
            <div className="space-y-3">
              {/* Expand/Collapse All */}
              <div className="flex justify-end mb-2">
                <button onClick={() => { const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']; const newState: Record<string,boolean> = {}; allDays.forEach(d => newState[d] = true); setExpandedDays(newState); }} className="text-gray-400 hover:text-white text-xs mr-2">Expand All</button>
                <button onClick={() => { const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']; const newState: Record<string,boolean> = {}; allDays.forEach(d => newState[d] = false); setExpandedDays(newState); }} className="text-gray-400 hover:text-white text-xs">Collapse All</button>
              </div>

              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                const dayWorkouts = currentWeek.workouts.filter(w => w.day === day);
                const dayClientWorkouts = (currentWeek.clientWorkouts || []).filter(cw => cw.day === day);
                if (dayWorkouts.length === 0 && dayClientWorkouts.length === 0) return null;
                const totalWorkouts = dayWorkouts.filter(w => w.type !== 'rest').length + dayClientWorkouts.length;
                const summary = dayWorkouts.map(w => w.title || getTypeLabel(w.type)).join(', ');
                const totalMiles = dayWorkouts.reduce((s, w) => s + (w.miles || 0), 0);
                const isExpanded = expandedDays[day] ?? defaultExpanded;
                // Calculate date for this day
                const dayIndex = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(day);
                const weekStart = getMondayForOffset(weekOffset);
                const dayDate = new Date(weekStart);
                dayDate.setDate(weekStart.getDate() + dayIndex);
                const dayDateStr = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <div key={day} className="border border-white/10 rounded-2xl overflow-hidden">
                    {/* Day Header - always visible */}
                    <button aria-expanded={isExpanded} onClick={() => setExpandedDays(prev => ({ ...prev, [day]: !isExpanded }))} className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left">
                      <div>
                        <span className="text-white font-heading uppercase text-sm">{day}</span>
                        <span className="text-gray-300 text-xs ml-2">{dayDateStr}</span>
                        {!isExpanded && <span className="text-gray-400 text-xs ml-3">{summary}{totalMiles > 0 ? ` • ${convertDist(totalMiles, clientDistanceUnit, 'mi').toFixed(1)} ${distUnitShort}` : ''}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 text-xs">{totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''}</span>
                        <svg aria-hidden="true" className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </button>

                    {/* Day Content - only when expanded */}
                    {isExpanded && (
                      <div className="p-4 space-y-3">
                    {/* Crystal's programmed workouts for this day — with Strava suggestions attached */}
                    {dayWorkouts.map((workout) => {
                      // Find Strava imports that suggest matching to THIS workout
                      const suggestedStravaForWorkout = dayClientWorkouts.filter(cw => {
                        if (cw.source !== 'strava' || !cw.stravaActivityId) return false;
                        if (stravaMatchDecisions[cw.stravaActivityId]) return false;
                        const suggestion = (currentWeek as any)?.stravaActivities?.find((sa: any) => sa.id === cw.stravaActivityId && sa.matchStatus === 'suggested');
                        return suggestion && suggestion.suggestedMatchId === workout.id;
                      });
                      
                      return (
                <div key={workout.id}>
                <div className={`border rounded-2xl overflow-hidden transition-all ${getTypeColor(workout.type)} ${workout.completed ? "opacity-80" : ""}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Completion Status Indicator */}
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${workout.status === "complete" ? "bg-green-500 border-green-500" : workout.status === "partial" ? "bg-yellow-500 border-yellow-500" : workout.status === "skipped" ? "bg-red-500 border-red-500" : "border-gray-500"}`}>
                          {workout.status === "complete" && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          {workout.status === "partial" && <span className="text-white text-xs font-bold">½</span>}
                          {workout.status === "skipped" && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-white font-heading uppercase text-sm">{workout.day}</span>
                            <span className="text-gray-300 text-xs">{workout.date}</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Programmed</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getTypeBadge(workout.type)}`}>{getTypeLabel(workout.type)}</span>
                            {(workout.type === "run" || workout.type === "walk" || workout.type === "stretching") && workout.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(workout.trainingType)}`}>{getTrainingTypeLabel(workout.trainingType)}</span>}
                            {workout.stravaSynced && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>{workout.stravaActivityName || 'Synced'}</span>}
                          </div>
                          <h3 className={`font-bold mb-0.5 ${workout.completed ? "text-gray-400 line-through" : "text-white"}`}>{workout.title}</h3>
                          <p className="text-gray-400 text-sm">{workout.description}</p>
                          {workout.paceTarget && <p className="text-accent text-xs mt-0.5">Target Pace: {workout.paceTarget}</p>}
                          {workout.location && <p className="text-gray-300 text-xs mt-0.5">{workout.location}</p>}
                          {workout.coachNotes && <div className="mt-2 bg-primary/50 border border-white/5 rounded-lg p-3"><p className="text-gold text-xs font-heading uppercase mb-1">Coach Notes</p><p className="text-gray-300 text-xs leading-relaxed">{workout.coachNotes}</p></div>}
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        {workout.miles && <div className="flex items-baseline gap-2">
                          {workout.completed && workout.log?.actualMiles ? (
                            <>
                              <span className="font-heading text-xl text-green-400">{convertDist(Number(workout.log.actualMiles), getWorkoutUnit(workout.id), 'mi')}</span>
                              <span className="text-gray-500 text-xs">/ {convertDist(workout.miles, getWorkoutUnit(workout.id), workout.distanceUnit)} {getWorkoutUnit(workout.id)}</span>
                            </>
                          ) : (
                            <span className="font-heading text-xl text-white">{convertDist(workout.miles, getWorkoutUnit(workout.id), workout.distanceUnit)} <span className="text-gray-400 text-xs font-normal">{getWorkoutUnit(workout.id)}</span></span>
                          )}
                          <button onClick={() => setWorkoutUnitOverrides(prev => ({ ...prev, [workout.id]: getWorkoutUnit(workout.id) === "km" ? "mi" : "km" }))} className="text-gray-600 hover:text-accent text-xs transition-colors">{getWorkoutUnit(workout.id) === "km" ? "→mi" : "→km"}</button>
                        </div>}
                      </div>
                    </div>
                    {/* Log toggle — hidden when a Strava suggestion is pending for this workout */}
                    {((!workout.completed && weekOffset === 0) || (workout.type === "rest" && weekOffset === 0)) && expandedWorkout !== workout.id && showSkipDialog !== workout.id && suggestedStravaForWorkout.length === 0 && (
                      <div className="mt-3 ml-9 flex items-center gap-2 flex-wrap">
                        {workout.type === "rest" ? (
                          /* Rest day: optional comment only (no completion needed) */
                          <button onClick={() => setExpandedWorkout(workout.id)} className="border border-green-500/30 text-green-400 hover:bg-green-500/10 font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Add Comment
                          </button>
                        ) : (
                          /* Run/Cross: full options */
                          <>
                            <button onClick={() => { setExpandedWorkout(workout.id); setSkipType("skipped"); /* reuse skipType to track which form to show */ }} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              I Did This
                            </button>
                            <button onClick={() => { setShowSkipDialog(workout.id); setSkipType("skipped"); }} className="border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold py-2 px-4 rounded-lg text-xs transition-colors">I Skipped This</button>
                          </>
                        )}
                      </div>
                    )}
                    {expandedWorkout === workout.id && !workout.completed && (
                      <div className="mt-2 ml-9"><button onClick={() => { setExpandedWorkout(null); setEditingWorkoutLog(null); setSkipReason(""); }} className="text-gray-400 hover:text-white text-xs">Cancel</button></div>
                    )}
                    {workout.status === "skipped" && workout.skipReason && (
                      <div className="mt-2 ml-9 bg-red-500/10 border border-red-500/20 rounded-lg p-2"><p className="text-red-400 text-xs"><span className="font-medium">Skipped:</span> {workout.skipReason}</p></div>
                    )}
                    {workout.status === "partial" && workout.skipReason && (
                      <div className="mt-2 ml-9 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2"><p className="text-yellow-400 text-xs"><span className="font-medium">Partially completed:</span> {workout.skipReason}</p></div>
                    )}
                    {(workout.status === "complete" || workout.status === "partial") && workout.log && (
                      <div className="mt-2 ml-9">
                        <div className="flex flex-wrap gap-1.5">
                          {workout.log.rpe && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">RPE</span> <span className="text-white font-medium">{workout.log.rpe}/10</span></span>}
                          {workout.log.actualMiles && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">{getWorkoutUnit(workout.id) === "km" ? "km" : "mi"}</span> <span className="text-white font-medium">{convertDist(Number(workout.log.actualMiles), getWorkoutUnit(workout.id), 'mi').toFixed(2)}</span></span>}
                          {workout.log.actualPace && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Pace</span> <span className="text-white font-medium">{getWorkoutUnit(workout.id) === "km" && workout.log.actualPace.includes("/mi") ? convertPaceToKm(workout.log.actualPace) : getWorkoutUnit(workout.id) === "mi" && workout.log.actualPace.includes("/km") ? convertPaceToMi(workout.log.actualPace) : workout.log.actualPace}</span></span>}
                          {workout.log.duration && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Dur</span> <span className="text-white font-medium">{workout.log.duration}</span></span>}
                          {workout.log.avgHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">HR</span> <span className="text-red-400 font-medium">{workout.log.avgHeartrate}</span></span>}
                          {workout.log.maxHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Max</span> <span className="text-red-400 font-medium">{workout.log.maxHeartrate}</span></span>}
                          {workout.log.sleep && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Sleep</span> <span className="text-white font-medium">{workout.log.sleep}/10</span></span>}
                          {workout.log.stress && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Stress</span> <span className="text-white font-medium">{workout.log.stress}</span></span>}
                          {workout.log.onPeriod === "yes" && <span className="text-xs bg-pink-500/10 rounded px-2 py-1 text-pink-400 font-medium">On Period</span>}
                          {editingWorkoutLog !== workout.id && <button onClick={() => setEditingWorkoutLog(workout.id)} className="text-xs bg-primary/50 rounded px-2 py-1 text-gray-400 hover:text-accent transition-colors cursor-pointer flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>Edit</button>}
                        </div>
                        {workout.log.notes && !workout.log.notes.startsWith('Synced from Strava:') && !workout.log.notes.startsWith('Auto-synced from Strava:') && <p className="text-gray-400 text-xs mt-1.5">{workout.log.notes}</p>}
                      </div>
                    )}

                    {/* Skip Dialog - only for "I Skipped This" */}
                    {showSkipDialog === workout.id && (
                      <div className="mt-3 ml-9 bg-secondary/50 border border-white/10 rounded-xl p-4">
                        <p className="text-sm font-medium mb-3 text-red-400">Why did you skip this workout?</p>
                        <div className="mb-3">
                          <textarea value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none" rows={2} placeholder="e.g. Sick, injury, schedule conflict, too tired..." />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => markSkipped(workout.id)} disabled={!skipReason || savingLog} className={`text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors ${!skipReason || savingLog ? "bg-gray-600 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}>{savingLog ? "Saving..." : "Mark as Skipped"}</button>
                          <button onClick={() => { setShowSkipDialog(null); setSkipReason(""); }} className="text-gray-400 text-xs">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Log Form */}
                  {(expandedWorkout === workout.id || editingWorkoutLog === workout.id) && (
                    <div className="border-t border-white/10 bg-primary/30 p-5">
                      {/* REST DAY - optional comment only */}
                      {workout.type === "rest" && (
                        <>
                          <h4 className="font-heading text-sm uppercase text-green-400 mb-3">Rest Day Notes</h4>
                          <div className="mb-4">
                            <label className="text-gray-400 text-xs block mb-1">Anything to share with Crystal about today? (optional)</label>
                            <textarea value={workout.log?.notes || ""} onChange={(e) => updateWorkoutLog(workout.id, "notes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none" rows={2} placeholder="e.g. Feeling good and recovered, went for a light walk, legs still sore from yesterday..." />
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <button onClick={() => { setExpandedWorkout(null); }} className="text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                            <button onClick={async () => { await toggleCompleted(workout.id); setExpandedWorkout(null); }} disabled={savingLog} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-8 rounded-lg text-sm transition-colors disabled:opacity-50">{savingLog ? "Saving..." : "Save Comment"}</button>
                          </div>
                        </>
                      )}

                      {/* RUN / CROSS - full metrics form (used for both Complete and Partial) */}
                      {workout.type !== "rest" && (
                        <>
                      {/* Partial indicator */}
                      {skipType === "partial" && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                          <p className="text-yellow-400 text-xs font-medium mb-1">Logging as Partially Done</p>
                          <p className="text-gray-400 text-xs">Fill in what you actually did below, then explain what you couldn&apos;t complete.</p>
                        </div>
                      )}
                      <h4 className="font-heading text-sm uppercase text-accent mb-4">{editingWorkoutLog ? "Edit Your Log" : skipType === "partial" ? "What Did You Do?" : "Your Workout Log"}</h4>

                      {/* RPE + Sleep — side by side at top */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">💪</span><label className="text-gray-300 text-xs font-medium">Effort (RPE)</label></div><span className="text-white text-xl font-bold">{workout.log?.rpe || "—"}</span></div>
                          <input type="range" min="1" max="10" value={workout.log?.rpe || ""} onChange={(e) => updateWorkoutLog(workout.id, "rpe", e.target.value)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                          <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Easy</span><span className="text-gray-500 text-[10px]">All-out</span></div>
                        </div>
                        <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">😴</span><label className="text-gray-300 text-xs font-medium">Sleep Quality</label></div><span className="text-white text-xl font-bold">{(workout.log as Record<string, string> | undefined)?.sleep || "—"}</span></div>
                          <input type="range" min="1" max="10" value={(workout.log as Record<string, string> | undefined)?.sleep || ""} onChange={(e) => updateWorkoutLog(workout.id, "sleep", e.target.value)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                          <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Terrible</span><span className="text-gray-500 text-[10px]">Great</span></div>
                        </div>
                      </div>

                      {/* Run/Walk: Miles, Pace, Stress */}
                      {(workout.type === "run" || workout.type === "walk") && (
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div><label className="text-gray-400 text-xs block mb-1">Actual {distUnitLabel}</label><input type="text" value={workout.log?.actualMiles || ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) updateWorkoutLog(workout.id, "actualMiles", v); }} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. 7.20" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Average Pace</label><input type="text" value={workout.log?.actualPace || ""} onChange={(e) => updateWorkoutLog(workout.id, "actualPace", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="e.g. 8:45/mi" /></div>
                        <div><label className="text-gray-400 text-xs block mb-1">Stress Factors</label><input type="text" value={workout.log?.stress || ""} onChange={(e) => updateWorkoutLog(workout.id, "stress", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Travel, work, etc." /></div>
                      </div>
                      )}
                      {/* Other types: Stress only */}
                      {workout.type !== "run" && workout.type !== "walk" && workout.type !== "rest" && (
                      <div className="mb-4">
                        <label className="text-gray-400 text-xs block mb-1">Stress Factors</label>
                        <input type="text" value={workout.log?.stress || ""} onChange={(e) => updateWorkoutLog(workout.id, "stress", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Travel, work, etc." />
                      </div>
                      )}

                      {/* Partial: what didn't you complete? */}
                      {skipType === "partial" && (
                        <div className="mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                          <label className="text-yellow-400 text-xs block mb-1">What couldn&apos;t you complete and why?</label>
                          <textarea value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none" rows={2} placeholder="e.g. Did 4 miles instead of 7 — knee started hurting at mile 4" />
                        </div>
                      )}

                      {/* Notes (all non-rest types) */}
                      <div className="mb-4"><label className="text-gray-400 text-xs block mb-1">Notes</label><input type="text" value={workout.log?.notes || ""} onChange={(e) => updateWorkoutLog(workout.id, "notes", e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="How did it feel? Anything notable?" /></div>

                      {/* Period tracking */}
                      <div className="mb-4 flex items-center gap-3">
                        <button onClick={() => updateWorkoutLog(workout.id, "onPeriod", (workout.log as Record<string, string> | undefined)?.onPeriod === "yes" ? "no" : "yes")} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${(workout.log as Record<string, string> | undefined)?.onPeriod === "yes" ? "bg-pink-500 border-pink-500" : "border-gray-500 hover:border-pink-400"}`}>{(workout.log as Record<string, string> | undefined)?.onPeriod === "yes" && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</button>
                        <span className="text-gray-400 text-xs">On period today</span>
                      </div>

                      {/* Save & Close */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                        <button onClick={() => { setExpandedWorkout(null); setEditingWorkoutLog(null); setSkipReason(""); }} className="text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                        {skipType === "partial" && !editingWorkoutLog ? (
                          <button onClick={async () => { if ((workout.type === "run" || workout.type === "walk") && (!workout.log?.actualMiles || !/^\d+(\.\d{1,2})?$/.test(workout.log.actualMiles))) { alert(`Please enter a valid number for Actual ${clientDistanceUnit === "km" ? "KM" : "Miles"} (e.g. 4.34). Only numbers with up to 2 decimal places are allowed.`); return; } await markSkipped(workout.id); setExpandedWorkout(null); }} disabled={savingLog || !skipReason} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2.5 px-8 rounded-lg text-sm transition-colors disabled:opacity-50">{savingLog ? "Saving..." : "Save as Partially Done"}</button>
                        ) : (
                          <button onClick={async () => { if ((workout.type === "run" || workout.type === "walk") && workout.log?.actualMiles && !/^\d+(\.\d{1,2})?$/.test(workout.log.actualMiles)) { alert(`Please enter a valid number for Actual ${clientDistanceUnit === "km" ? "KM" : "Miles"} (e.g. 4.34). Only numbers with up to 2 decimal places are allowed.`); return; } await toggleCompleted(workout.id); setExpandedWorkout(null); setEditingWorkoutLog(null); }} disabled={savingLog} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-8 rounded-lg text-sm transition-colors disabled:opacity-50">{savingLog ? "Saving..." : editingWorkoutLog ? "Save Changes" : "Complete & Save"}</button>
                        )}
                      </div>
                        </>
                      )}
                    </div>
                  )}
                  {/* Workout Comments Thread (bottom of card) */}
                  {workout.completed && workout.type !== "rest" && (
                    <div className="px-5 pb-4 pt-2 border-t border-white/5">
                      {(workoutComments[workout.id] || []).length > 0 && (
                        <div className="space-y-2 mb-2">
                          {(workoutComments[workout.id] || []).map(c => (
                            <div key={c.id} className={`${c.isCoach ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-primary/30 border border-white/5'} rounded-lg p-2`}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-xs font-bold ${c.isCoach ? 'text-purple-400' : 'text-accent'}`}>{c.isCoach ? 'Crystal' : c.userName}</span>
                                <span className="text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                              <p className="text-gray-300 text-xs">{c.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input type="text" value={commentInput[workout.id] || ''} onChange={(e) => setCommentInput(prev => ({ ...prev, [workout.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSendWorkoutComment(workout.id); }} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="Reply to Crystal or add a note..." />
                        <button onClick={() => handleSendWorkoutComment(workout.id)} disabled={sendingComment === workout.id || !commentInput[workout.id]?.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs disabled:opacity-50">{sendingComment === workout.id ? '...' : 'Send'}</button>
                      </div>
                    </div>
                  )}
                </div>
              
              {/* Attached Strava Suggestion — visually coupled below the programmed workout */}
              {suggestedStravaForWorkout.map(cw => (
                <div key={cw.id} className="relative ml-6 mt-0">
                  {/* Dotted connector line */}
                  <div className="absolute left-3 -top-3 w-0 h-3 border-l-2 border-dashed border-orange-400/50"></div>
                  <div className="border-2 border-dashed border-orange-400/40 rounded-xl p-4 bg-orange-500/5 opacity-90">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-6 h-6 rounded-full bg-orange-500/20 border-2 border-dashed border-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-dashed border-orange-400/50">Strava Import — Possible Match</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getTypeBadge(cw.type)}`}>{getTypeLabel(cw.type)}</span>
                            {cw.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(cw.trainingType)}`}>{getTrainingTypeLabel(cw.trainingType)}</span>}
                          </div>
                          {cw.activityName && <p className="text-white text-sm font-medium">{cw.activityName}</p>}
                          {(cw.averagePace || cw.duration || cw.avgHeartrate) && (
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {cw.duration && <span className="text-gray-400 text-xs">Duration: <span className="text-white">{cw.duration}</span></span>}
                              {cw.averagePace && <span className="text-gray-400 text-xs">Pace: <span className="text-white">{cw.averagePace}</span></span>}
                              {cw.avgHeartrate && <span className="text-gray-400 text-xs">Avg HR: <span className="text-red-400">{cw.avgHeartrate} bpm</span></span>}
                              {cw.maxHeartrate && <span className="text-gray-400 text-xs">Max HR: <span className="text-red-400">{cw.maxHeartrate} bpm</span></span>}
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => handleStravaMatch(cw.stravaActivityId!, workout.id, 'programmed')} className="text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 px-4 rounded-lg transition-colors font-medium flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Yes, this is the same workout
                            </button>
                            <button onClick={() => handleStravaReject(cw.stravaActivityId!)} className="text-xs border border-gray-500/30 text-gray-400 hover:text-white py-1.5 px-3 rounded-lg transition-colors">Not a match</button>
                          </div>

                          {/* Strava Match Log Form */}
                          {stravaMatchLog?.stravaActivityId === cw.stravaActivityId && (
                            <div className="mt-3 bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                              <h4 className="font-heading text-sm uppercase text-green-400 mb-3">Complete Your Log</h4>
                              <p className="text-gray-400 text-xs mb-4">Strava data (miles, pace, duration) will be saved automatically. Add your effort and notes below.</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">💪</span><label className="text-gray-300 text-xs font-medium">Effort (RPE)</label></div><span className="text-white text-xl font-bold">{stravaMatchLog.rpe || '—'}</span></div>
                                  <input type="range" min="1" max="10" value={stravaMatchLog.rpe || ''} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, rpe: e.target.value } : null)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                                  <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Easy</span><span className="text-gray-500 text-[10px]">All-out</span></div>
                                </div>
                                <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">😴</span><label className="text-gray-300 text-xs font-medium">Sleep Quality</label></div><span className="text-white text-xl font-bold">{stravaMatchLog.sleep || '—'}</span></div>
                                  <input type="range" min="1" max="10" value={stravaMatchLog.sleep || ''} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, sleep: e.target.value } : null)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                                  <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Terrible</span><span className="text-gray-500 text-[10px]">Great</span></div>
                                </div>
                              </div>
                              <div className="mb-4">
                                <label className="text-gray-400 text-xs block mb-1">Notes</label>
                                <input type="text" value={stravaMatchLog.notes} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, notes: e.target.value } : null)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="How did it feel? Anything notable?" />
                              </div>
                              <div className="flex items-center gap-3">
                                <button onClick={handleStravaMatchConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">Complete & Save</button>
                                <button onClick={() => setStravaMatchLog(null)} className="text-gray-400 hover:text-white text-xs">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {cw.miles && <div className="text-right ml-3">
                        <p className="font-heading text-xl text-orange-400">{convertDist(cw.miles, getWorkoutUnit(cw.id), 'mi')}</p>
                        <p className="text-gray-400 text-xs">{getWorkoutUnit(cw.id) === "km" ? "km" : "mi"}</p>
                        <button onClick={() => setWorkoutUnitOverrides(prev => ({ ...prev, [cw.id]: getWorkoutUnit(cw.id) === "km" ? "mi" : "km" }))} className="text-gray-600 hover:text-orange-400 text-xs mt-0.5 transition-colors">{getWorkoutUnit(cw.id) === "km" ? "→ mi" : "→ km"}</button>
                      </div>}
                    </div>
                  </div>
                </div>
              ))}
              </div>
              );
              })}

                    {/* Client-Added Workouts for this day (non-Strava + unmatched Strava) */}
                    {dayClientWorkouts.filter(cw => {
                      // Show non-Strava workouts always
                      if (cw.source !== 'strava') return true;
                      // Don't show Strava imports that have a suggested match (they're shown attached below the workout)
                      if (!cw.stravaActivityId) return true;
                      if (stravaMatchDecisions[cw.stravaActivityId]) return true; // already decided
                      const suggestion = (currentWeek as any)?.stravaActivities?.find((sa: any) => sa.id === cw.stravaActivityId && sa.matchStatus === 'suggested');
                      if (suggestion && suggestion.suggestedMatchId) {
                        // Check if the suggested workout is in this day's programmed workouts
                        const matchTarget = dayWorkouts.find(w => w.id === suggestion.suggestedMatchId);
                        if (matchTarget) return false; // rendered attached to the programmed workout above
                      }
                      if (suggestion && suggestion.suggestedClientMatchId) {
                        // Check if the suggested client workout is in this day's client workouts
                        const matchTarget = dayClientWorkouts.find(cwk => cwk.id === suggestion.suggestedClientMatchId && cwk.source !== 'strava');
                        if (matchTarget) return false; // will be rendered attached to the client workout below
                      }
                      return true;
                    }).map(cw => (
                      <div key={cw.id}>
                      <div className={`border rounded-2xl p-4 mt-2 ${cw.source === 'strava' && !completedClientWorkouts[cw.id] && !stravaMatchDecisions[cw.stravaActivityId || ''] && (currentWeek as any)?.stravaActivities?.some((sa: any) => sa.id === cw.stravaActivityId) ? 'border-2 border-dashed border-orange-400/30 bg-orange-500/5' : completedClientWorkouts[cw.id] ? 'border-green-500/30 bg-green-500/5 opacity-80' : 'border-cyan-500/30 bg-cyan-500/5'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${cw.source === 'strava' && !completedClientWorkouts[cw.id] ? 'bg-orange-500/20 border-dashed border-orange-400' : completedClientWorkouts[cw.id] ? 'bg-green-500 border-green-500' : 'border-cyan-500'}`}>
                              {completedClientWorkouts[cw.id] ? <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : cw.source === 'strava' ? <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg> : <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {cw.source === 'strava' ? (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Extra</span>
                                ) : (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">Your Workout</span>
                                )}
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getTypeBadge(cw.type)}`}>{getTypeLabel(cw.type)}</span>
                                {cw.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(cw.trainingType)}`}>{getTrainingTypeLabel(cw.trainingType)}</span>}
                                {(cw.source === 'strava' || (cw.source !== 'strava' && completedClientWorkouts[cw.id] && clientWorkoutNotes[cw.id]?.startsWith('Synced from Strava:'))) && (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
                                    {cw.activityName || (clientWorkoutNotes[cw.id]?.startsWith('Synced from Strava:') ? clientWorkoutNotes[cw.id].replace('Synced from Strava: ', '') : 'Synced')}
                                  </span>
                                )}
                              </div>
                              {cw.notes && !cw.activityName && !cw.notes.startsWith('Kept as extra') && <p className="text-gray-400 text-sm">{cw.notes}</p>}
                              {/* Strava/synced activity details */}
                              {cw.activityName && <p className="text-white text-sm font-medium">{cw.activityName}</p>}
                              {(cw.averagePace || cw.duration || cw.avgHeartrate || cw.miles) && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {cw.miles && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">{getWorkoutUnit(cw.id) === "km" ? "km" : "mi"}</span> <span className="text-white font-medium">{convertDist(cw.miles, getWorkoutUnit(cw.id), 'mi')}</span></span>}
                                  {cw.duration && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Dur</span> <span className="text-white font-medium">{cw.duration}</span></span>}
                                  {cw.averagePace && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Pace</span> <span className="text-white font-medium">{cw.averagePace}</span></span>}
                                  {cw.avgHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">HR</span> <span className="text-red-400 font-medium">{cw.avgHeartrate}</span></span>}
                                  {cw.maxHeartrate && <span className="text-xs bg-primary/50 rounded px-2 py-1"><span className="text-gray-400">Max</span> <span className="text-red-400 font-medium">{cw.maxHeartrate}</span></span>}
                                </div>
                              )}

                              {/* Strava Match Options — for unmatched imports */}
                              {cw.source === 'strava' && cw.stravaActivityId && !stravaMatchDecisions[cw.stravaActivityId] && (() => {
                                // If this strava activity is not in the pending/suggested list, it's already been decided (standalone/matched)
                                const isStillPending = (currentWeek as any)?.stravaActivities?.some((sa: any) => sa.id === cw.stravaActivityId);
                                if (!isStillPending) return null;

                                // Check if this had a suggested match (it shouldn't be here if it does, but fallback)
                                const suggestion = (currentWeek as any)?.stravaActivities?.find((sa: any) => sa.id === cw.stravaActivityId && sa.matchStatus === 'suggested');
                                const suggestedWorkout = suggestion ? (currentWeek?.workouts || []).find(w => w.id === suggestion.suggestedMatchId) : null;
                                const suggestedClientWorkout = suggestion?.suggestedClientMatchId ? (currentWeek?.clientWorkouts || []).find(cwk => cwk.id === suggestion.suggestedClientMatchId) : null;

                                // If it has a programmed suggestion and that workout exists in this day, skip (handled in attached card above)
                                if (suggestedWorkout && dayWorkouts.find(w => w.id === suggestedWorkout.id)) return null;

                                // If it has a client-created workout suggestion, show it as a suggested match
                                if (suggestedClientWorkout) {
                                  return (
                                    <div className="mt-3 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                                      <p className="text-orange-400 text-xs font-medium mb-2">We think this matches a workout you created:</p>
                                      <div className="bg-primary/30 rounded-lg p-2.5 mb-2">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Your Workout</span>
                                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getTypeBadge(suggestedClientWorkout.type)}`}>{getTypeLabel(suggestedClientWorkout.type)}</span>
                                          {suggestedClientWorkout.trainingType && <span className={`text-xs px-1.5 py-0.5 rounded border ${getTrainingTypeBadge(suggestedClientWorkout.trainingType)}`}>{getTrainingTypeLabel(suggestedClientWorkout.trainingType)}</span>}
                                          {suggestedClientWorkout.miles && <span className="text-white text-xs font-bold ml-auto">{convertDist(suggestedClientWorkout.miles, getWorkoutUnit(suggestedClientWorkout.id), 'mi')} {getWorkoutUnit(suggestedClientWorkout.id) === "km" ? "km" : "mi"}</span>}
                                        </div>
                                        {suggestedClientWorkout.notes && <p className="text-gray-300 text-xs">{suggestedClientWorkout.notes}</p>}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <button onClick={() => handleStravaMatch(cw.stravaActivityId!, suggestedClientWorkout.id, 'client')} className="text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded-lg transition-colors">Yes, this is it</button>
                                        <button onClick={() => handleStravaReject(cw.stravaActivityId!)} className="text-xs border border-gray-500/30 text-gray-400 hover:text-white py-1.5 px-3 rounded-lg transition-colors">No, wrong match</button>
                                      </div>
                                    </div>
                                  );
                                }

                                // Show unmatched options — this Strava activity doesn't match any workout
                                const availableWorkouts = (currentWeek?.workouts || []).filter(w => w.day === cw.day && !w.completed && w.type !== 'rest');
                                const availableClientWorkouts = (currentWeek?.clientWorkouts || []).filter(cwk => cwk.day === cw.day && cwk.source !== 'strava' && !completedClientWorkouts[cwk.id]);
                                return (
                                  <div className="mt-3 bg-primary/30 border border-orange-400/20 rounded-lg p-3">
                                    <p className="text-gray-400 text-xs mb-2">
                                      <span className="text-orange-400 font-medium">No automatic match found.</span> {(availableWorkouts.length > 0 || availableClientWorkouts.length > 0) ? 'You can manually link it to a workout or keep it separate:' : 'Keep it as an extra workout or dismiss it:'}
                                    </p>
                                    {(availableWorkouts.length > 0 || availableClientWorkouts.length > 0) && (
                                      <div className="space-y-1.5 mb-2">
                                        {availableWorkouts.map((w, idx) => (
                                          <button key={w.id} onClick={() => handleStravaMatch(cw.stravaActivityId!, w.id, 'programmed')} className="w-full text-left bg-primary/40 hover:bg-primary/60 border border-orange-500/20 hover:border-orange-400/50 rounded-lg p-2 transition-colors group">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="text-orange-400 text-xs font-bold bg-orange-500/20 rounded-full w-5 h-5 flex items-center justify-center">{idx + 1}</span>
                                                <div className="flex items-center gap-1.5">
                                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getTypeBadge(w.type)}`}>{getTypeLabel(w.type)}</span>
                                                  {w.trainingType && <span className={`text-xs px-1.5 py-0.5 rounded border ${getTrainingTypeBadge(w.trainingType)}`}>{getTrainingTypeLabel(w.trainingType)}</span>}
                                                  {w.title && <span className="text-gray-300 text-xs ml-1">{w.title}</span>}
                                                </div>
                                              </div>
                                              <div className="text-right flex items-center gap-2">
                                                {w.miles ? <span className="text-white text-xs font-bold">{convertDist(w.miles, getWorkoutUnit(w.id), w.distanceUnit)} {distUnitShort}</span> : null}
                                                <span className="text-orange-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Link</span>
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                        {availableClientWorkouts.map((cwk, idx) => (
                                          <button key={cwk.id} onClick={() => handleStravaMatch(cw.stravaActivityId!, cwk.id, 'client')} className="w-full text-left bg-primary/40 hover:bg-primary/60 border border-cyan-500/20 hover:border-cyan-400/50 rounded-lg p-2 transition-colors group">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="text-cyan-400 text-xs font-bold bg-cyan-500/20 rounded-full w-5 h-5 flex items-center justify-center">{availableWorkouts.length + idx + 1}</span>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Your Workout</span>
                                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getTypeBadge(cwk.type)}`}>{getTypeLabel(cwk.type)}</span>
                                                  {cwk.trainingType && <span className={`text-xs px-1.5 py-0.5 rounded border ${getTrainingTypeBadge(cwk.trainingType)}`}>{getTrainingTypeLabel(cwk.trainingType)}</span>}
                                                </div>
                                              </div>
                                              <div className="text-right flex items-center gap-2">
                                                {cwk.miles ? <span className="text-white text-xs font-bold">{convertDist(cwk.miles, getWorkoutUnit(cwk.id), 'mi')} {distUnitShort}</span> : null}
                                                <span className="text-cyan-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Link</span>
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 pt-1.5 border-t border-white/5">
                                      <button onClick={() => handleStravaKeepStandalone(cw.stravaActivityId!)} className="text-xs border border-cyan-500/30 text-cyan-400 hover:text-white py-1.5 px-3 rounded-lg transition-colors">Keep as extra workout</button>
                                      <button onClick={() => handleStravaDismiss(cw.stravaActivityId!)} className="text-xs border border-red-500/30 text-red-400 hover:text-white py-1.5 px-3 rounded-lg transition-colors">Don&apos;t import</button>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Strava decided: standalone */}
                              {cw.source === 'strava' && cw.stravaActivityId && stravaMatchDecisions[cw.stravaActivityId] === 'standalone' && (
                                <p className="text-green-400 text-xs mt-2 font-medium">Added as extra workout</p>
                              )}
                              {/* Strava decided: dismissed — hide the card */}
                              {cw.source === 'strava' && cw.stravaActivityId && stravaMatchDecisions[cw.stravaActivityId] === 'dismissed' && (
                                <p className="text-gray-500 text-xs mt-2 italic">Dismissed — will disappear on refresh</p>
                              )}

                              {/* Link to programmed workout — always available on standalone Strava extras */}
                              {cw.source === 'strava' && cw.stravaActivityId && (completedClientWorkouts[cw.id] || stravaMatchDecisions[cw.stravaActivityId] === 'standalone') && !stravaMatchDecisions[cw.stravaActivityId]?.startsWith?.('matched') && (() => {
                                const unmatchedProgrammed = (currentWeek?.workouts || []).filter(w => w.day === cw.day && !w.completed && w.type !== 'rest');
                                if (unmatchedProgrammed.length === 0) return null;
                                return (
                                  <div className="mt-2">
                                    <button onClick={() => setShowLinkOptions(showLinkOptions === cw.id ? null : cw.id)} className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
                                      {showLinkOptions === cw.id ? 'Cancel' : 'Link to today\'s programmed workout'}
                                    </button>
                                    {showLinkOptions === cw.id && (
                                      <div className="mt-2 space-y-1.5">
                                        {unmatchedProgrammed.map(w => (
                                          <button key={w.id} onClick={() => { handleStravaMatch(cw.stravaActivityId!, w.id, 'programmed'); setShowLinkOptions(null); }} className="w-full text-left bg-primary/40 hover:bg-primary/60 border border-orange-500/20 hover:border-orange-400/50 rounded-lg p-2 transition-colors">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getTypeBadge(w.type)}`}>{getTypeLabel(w.type)}</span>
                                                {w.trainingType && <span className={`text-xs px-1.5 py-0.5 rounded border ${getTrainingTypeBadge(w.trainingType)}`}>{getTrainingTypeLabel(w.trainingType)}</span>}
                                                {w.title && <span className="text-gray-300 text-xs">{w.title}</span>}
                                              </div>
                                              {w.miles && <span className="text-white text-xs font-bold">{convertDist(w.miles, getWorkoutUnit(w.id), w.distanceUnit)} {distUnitShort}</span>}
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Strava Match Log Form — appears when user clicks "Yes, this is it" or a match button */}
                              {cw.source === 'strava' && cw.stravaActivityId && stravaMatchLog?.stravaActivityId === cw.stravaActivityId && (
                                <div className="mt-3 bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                                  <h4 className="font-heading text-sm uppercase text-green-400 mb-3">Complete Your Log</h4>
                                  <p className="text-gray-400 text-xs mb-4">Strava data (miles, pace, duration) will be saved automatically. Add your effort and notes below.</p>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                    <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">💪</span><label className="text-gray-300 text-xs font-medium">Effort (RPE)</label></div><span className="text-white text-xl font-bold">{stravaMatchLog.rpe || '—'}</span></div>
                                      <input type="range" min="1" max="10" value={stravaMatchLog.rpe || ''} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, rpe: e.target.value } : null)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                                      <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Easy</span><span className="text-gray-500 text-[10px]">All-out</span></div>
                                    </div>
                                    <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">😴</span><label className="text-gray-300 text-xs font-medium">Sleep Quality</label></div><span className="text-white text-xl font-bold">{stravaMatchLog.sleep || '—'}</span></div>
                                      <input type="range" min="1" max="10" value={stravaMatchLog.sleep || ''} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, sleep: e.target.value } : null)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                                      <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Terrible</span><span className="text-gray-500 text-[10px]">Great</span></div>
                                    </div>
                                  </div>

                                  <div className="mb-4">
                                    <label className="text-gray-400 text-xs block mb-1">Notes</label>
                                    <input type="text" value={stravaMatchLog.notes} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, notes: e.target.value } : null)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="How did it feel? Anything notable?" />
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <button onClick={handleStravaMatchConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">Complete & Save</button>
                                    <button onClick={() => setStravaMatchLog(null)} className="text-gray-400 hover:text-white text-xs">Cancel</button>
                                  </div>
                                </div>
                              )}

                              {/* Complete/Incomplete buttons (non-Strava workouts only, hidden when Strava match pending) */}
                              {cw.source !== 'strava' && weekOffset === 0 && !completedClientWorkouts[cw.id] && !dayClientWorkouts.some(scw => scw.source === 'strava' && scw.stravaActivityId && !stravaMatchDecisions[scw.stravaActivityId] && (currentWeek as any)?.stravaActivities?.some((sa: any) => sa.id === scw.stravaActivityId && sa.matchStatus === 'suggested' && sa.suggestedClientMatchId === cw.id)) && (
                                <div className="mt-2 flex items-center gap-2">
                                  <button onClick={async () => { setCompletedClientWorkouts(prev => ({ ...prev, [cw.id]: true })); const notes = clientWorkoutNotes[cw.id] || ''; await fetch('/api/client-workouts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cw.id, completed: true, notes }) }); }} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors">Done</button>
                                  <input type="text" value={clientWorkoutNotes[cw.id] || ''} onChange={(e) => setClientWorkoutNotes(prev => ({ ...prev, [cw.id]: e.target.value }))} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" placeholder="Comment (optional)" />
                                </div>
                              )}
                              {completedClientWorkouts[cw.id] && (
                                <div className="mt-2 flex items-center gap-2">
                                  {clientWorkoutNotes[cw.id] && !clientWorkoutNotes[cw.id].startsWith('Synced from Strava:') && !clientWorkoutNotes[cw.id].startsWith('Kept as extra from Strava:') && <span className="text-gray-400 text-xs">{clientWorkoutNotes[cw.id]}</span>}
                                  {cw.source !== 'strava' && <button onClick={async () => { setCompletedClientWorkouts(prev => ({ ...prev, [cw.id]: false })); await fetch('/api/client-workouts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cw.id, completed: false, notes: '' }) }); }} className="text-gray-600 hover:text-yellow-400 text-xs ml-auto">Undo</button>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {cw.miles && <div className="text-right">
                              <p className="font-heading text-xl text-white">{convertDist(cw.miles, getWorkoutUnit(cw.id), 'mi')}</p>
                              <p className="text-gray-300 text-xs">{getWorkoutUnit(cw.id) === "km" ? "km" : "mi"}</p>
                              <button onClick={() => setWorkoutUnitOverrides(prev => ({ ...prev, [cw.id]: getWorkoutUnit(cw.id) === "km" ? "mi" : "km" }))} className="text-gray-600 hover:text-accent text-xs mt-0.5 transition-colors">{getWorkoutUnit(cw.id) === "km" ? "→ mi" : "→ km"}</button>
                            </div>}
                            <button onClick={() => handleDeleteClientWorkout(cw.id)} disabled={deletingClientWorkout === cw.id} className="text-gray-600 hover:text-red-400 text-xs transition-colors">{deletingClientWorkout === cw.id ? "..." : "✕"}</button>
                          </div>
                        </div>
                        {/* Comments on client workouts */}
                        {completedClientWorkouts[cw.id] && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            {(workoutComments[cw.id] || []).length > 0 && (
                              <div className="space-y-1.5 mb-2">
                                {(workoutComments[cw.id] || []).map(c => (
                                  <div key={c.id} className={`${c.isCoach ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-primary/30 border border-white/5'} rounded-lg p-2`}>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`text-xs font-bold ${c.isCoach ? 'text-purple-400' : 'text-accent'}`}>{c.isCoach ? 'Crystal' : c.userName}</span>
                                      <span className="text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    <p className="text-gray-300 text-xs">{c.message}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input type="text" value={commentInput[cw.id] || ''} onChange={(e) => setCommentInput(prev => ({ ...prev, [cw.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSendWorkoutComment(cw.id); }} className="flex-1 bg-primary/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="Reply to Crystal or add a note..." />
                              <button onClick={() => handleSendWorkoutComment(cw.id)} disabled={sendingComment === cw.id || !commentInput[cw.id]?.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs disabled:opacity-50">{sendingComment === cw.id ? '...' : 'Send'}</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Attached Strava suggestion for this client-created workout */}
                      {cw.source !== 'strava' && (() => {
                        const suggestedStravaForClientWorkout = dayClientWorkouts.filter(scw => {
                          if (scw.source !== 'strava' || !scw.stravaActivityId) return false;
                          if (stravaMatchDecisions[scw.stravaActivityId]) return false;
                          const suggestion = (currentWeek as any)?.stravaActivities?.find((sa: any) => sa.id === scw.stravaActivityId && sa.matchStatus === 'suggested');
                          return suggestion && suggestion.suggestedClientMatchId === cw.id;
                        });
                        if (suggestedStravaForClientWorkout.length === 0) return null;
                        return suggestedStravaForClientWorkout.map(scw => (
                          <div key={scw.id} className="relative ml-6 mt-0">
                            <div className="absolute left-3 -top-3 w-0 h-3 border-l-2 border-dashed border-orange-400/50"></div>
                            <div className="border-2 border-dashed border-orange-400/40 rounded-xl p-4 bg-orange-500/5 opacity-90">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="w-6 h-6 rounded-full bg-orange-500/20 border-2 border-dashed border-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-dashed border-orange-400/50">Strava Import — Possible Match</span>
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getTypeBadge(scw.type)}`}>{getTypeLabel(scw.type)}</span>
                                      {scw.trainingType && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTrainingTypeBadge(scw.trainingType)}`}>{getTrainingTypeLabel(scw.trainingType)}</span>}
                                    </div>
                                    {scw.activityName && <p className="text-white text-sm font-medium">{scw.activityName}</p>}
                                    {(scw.averagePace || scw.duration || scw.avgHeartrate) && (
                                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                        {scw.duration && <span className="text-gray-400 text-xs">Duration: <span className="text-white">{scw.duration}</span></span>}
                                        {scw.averagePace && <span className="text-gray-400 text-xs">Pace: <span className="text-white">{scw.averagePace}</span></span>}
                                        {scw.avgHeartrate && <span className="text-gray-400 text-xs">Avg HR: <span className="text-red-400">{scw.avgHeartrate} bpm</span></span>}
                                        {scw.maxHeartrate && <span className="text-gray-400 text-xs">Max HR: <span className="text-red-400">{scw.maxHeartrate} bpm</span></span>}
                                      </div>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button onClick={() => handleStravaMatch(scw.stravaActivityId!, cw.id, 'client')} className="text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 px-4 rounded-lg transition-colors font-medium flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Yes, this is the same workout
                                      </button>
                                      <button onClick={() => handleStravaReject(scw.stravaActivityId!)} className="text-xs border border-gray-500/30 text-gray-400 hover:text-white py-1.5 px-3 rounded-lg transition-colors">Not a match</button>
                                    </div>

                                    {/* Strava Match Log Form */}
                                    {stravaMatchLog?.stravaActivityId === scw.stravaActivityId && (
                                      <div className="mt-3 bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                                        <h4 className="font-heading text-sm uppercase text-green-400 mb-3">Complete Your Log</h4>
                                        <p className="text-gray-400 text-xs mb-4">Strava data (miles, pace, duration) will be saved automatically. Add your effort and notes below.</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                          <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">💪</span><label className="text-gray-300 text-xs font-medium">Effort (RPE)</label></div><span className="text-white text-xl font-bold">{stravaMatchLog.rpe || '—'}</span></div>
                                            <input type="range" min="1" max="10" value={stravaMatchLog.rpe || ''} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, rpe: e.target.value } : null)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                                            <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Easy</span><span className="text-gray-500 text-[10px]">All-out</span></div>
                                          </div>
                                          <div className="bg-primary/50 border border-white/5 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm">😴</span><label className="text-gray-300 text-xs font-medium">Sleep Quality</label></div><span className="text-white text-xl font-bold">{stravaMatchLog.sleep || '—'}</span></div>
                                            <input type="range" min="1" max="10" value={stravaMatchLog.sleep || ''} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, sleep: e.target.value } : null)} className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent" />
                                            <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Terrible</span><span className="text-gray-500 text-[10px]">Great</span></div>
                                          </div>
                                        </div>
                                        <div className="mb-4">
                                          <label className="text-gray-400 text-xs block mb-1">Notes</label>
                                          <input type="text" value={stravaMatchLog.notes} onChange={(e) => setStravaMatchLog(prev => prev ? { ...prev, notes: e.target.value } : null)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="How did it feel? Anything notable?" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <button onClick={handleStravaMatchConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">Complete & Save</button>
                                          <button onClick={() => setStravaMatchLog(null)} className="text-gray-400 hover:text-white text-xs">Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {scw.miles && <div className="text-right ml-3"><p className="font-heading text-xl text-orange-400">{convertDist(scw.miles, getWorkoutUnit(scw.id), 'mi')}</p><p className="text-gray-400 text-xs">{getWorkoutUnit(scw.id) === "km" ? "km" : "mi"}</p></div>}
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    ))}

                    {/* Add Workout Button for this day (current week only) */}
                    {weekOffset === 0 && (
                      showAddWorkoutForDay === day ? (
                      <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-2xl p-4 mt-2">
                        <p className="text-cyan-400 text-xs font-heading uppercase mb-3">Add Your Own Workout — {day}</p>
                        <div className="space-y-3">
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Type</label>
                            <select value={addWorkoutForm.type} onChange={(e) => setAddWorkoutForm({ ...addWorkoutForm, type: e.target.value, trainingType: "", miles: "" })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                              <option value="run">Run</option>
                              <option value="walk">Walk</option>
                              <option value="cross">Cross Training</option>
                              <option value="cycling">Cycling</option>
                              <option value="stretching">Stretching</option>
                              <option value="strength">Strength</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          {(addWorkoutForm.type === "run" || addWorkoutForm.type === "walk") && (
                            <>
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Subtype *</label>
                                <select value={addWorkoutForm.trainingType} onChange={(e) => setAddWorkoutForm({ ...addWorkoutForm, trainingType: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                                  <option value="">Select type...</option>
                                  {addWorkoutForm.type === "run" && <>
                                    <option value="ClosePace">Close to Race Pace</option>
                                    <option value="Easy">Easy Run</option>
                                    <option value="Fartlek">Fartlek</option>
                                    <option value="Hills">Hill Repeats</option>
                                    <option value="Intervals">Intervals (Run/Walk)</option>
                                    <option value="LongRun">Long Run</option>
                                    <option value="Progressive">Progressive</option>
                                    <option value="RacePace">Race Pace</option>
                                    <option value="Recovery">Recovery Run</option>
                                    <option value="SpeedRoad">Speed Workout - Road</option>
                                    <option value="SpeedTrack">Speed Workout - Track</option>
                                    <option value="Tempo">Tempo Runs</option>
                                    <option value="Threshold">Threshold Runs</option>
                                    <option value="TimeTrial">Time Trial</option>
                                    <option value="Trail">Trail</option>
                                    <option value="Treadmill">Treadmill</option>
                                  </>}
                                  {addWorkoutForm.type === "walk" && <>
                                    <option value="WalkRecovery">Walk Recovery</option>
                                    <option value="WalkPower">Walk Power</option>
                                  </>}
                                </select>
                              </div>
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Distance ({distUnitShort}) *</label>
                                <input type="text" value={addWorkoutForm.miles} onChange={(e) => setAddWorkoutForm({ ...addWorkoutForm, miles: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" placeholder={`e.g. 3.5`} />
                              </div>
                            </>
                          )}
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Notes</label>
                            <textarea value={addWorkoutForm.notes} onChange={(e) => setAddWorkoutForm({ ...addWorkoutForm, notes: e.target.value })} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none" rows={2} placeholder="What did you do?" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAddClientWorkout(day)} disabled={savingClientWorkout} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg text-xs disabled:opacity-50">{savingClientWorkout ? "Saving..." : "Save"}</button>
                            <button onClick={() => { setShowAddWorkoutForDay(null); setAddWorkoutForm({ type: "run", trainingType: "", miles: "", notes: "" }); }} className="text-gray-400 hover:text-white text-xs">Cancel</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddWorkoutForDay(day)} className="w-full mt-2 border border-dashed border-cyan-500/30 rounded-xl py-2 text-cyan-500 hover:text-cyan-400 hover:border-cyan-500/50 text-xs transition-colors flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add your own workout
                      </button>
                    ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </>)}
          </>)}
          </>
        )}

        {/* MESSAGES TAB - Chat Style */}
        {activeTab === "messages" && (
          <div className="flex flex-col h-[calc(100vh-200px)] bg-secondary/20 border border-white/10 rounded-2xl overflow-hidden">
            {/* Chat Header */}
            <div className="px-5 py-3 border-b border-white/10 bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center"><span className="text-gold text-xs font-bold">C</span></div>
                <div><p className="text-white text-sm font-medium">Crystal</p><p className="text-gray-300 text-xs">Coach</p></div>
              </div>
            </div>

            {/* Messages Area - scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {clientMessages.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm">No messages yet.</p>
                  <p className="text-xs mt-1">Send Crystal a message below!</p>
                </div>
              )}
              {clientMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${msg.from === "client" ? "bg-accent rounded-2xl rounded-br-md" : "bg-secondary/80 border border-white/10 rounded-2xl rounded-bl-md"} px-4 py-2.5`}>
                    <p className={`text-sm ${msg.from === "client" ? "text-white" : "text-gray-200"}`}>{msg.message}</p>
                    <p className={`text-xs mt-1 ${msg.from === "client" ? "text-white/60" : "text-gray-500"}`}>{msg.date}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - fixed at bottom */}
            <div className="px-4 py-3 border-t border-white/10 bg-secondary/50">
              <div className="flex items-end gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  className="flex-1 bg-primary/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none max-h-32"
                  rows={1}
                  placeholder="Type a message..."
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-accent hover:bg-red-700 text-white p-2.5 rounded-xl disabled:opacity-30 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT TAB */}
        {activeTab === "account" && (
          <div className="space-y-6">
            {/* Current Plan & Payment */}
            {clientInfo ? (
              <>
                <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                  <h2 className="font-heading text-xl uppercase text-accent mb-4">Your Plan</h2>
                  <div className="space-y-3 text-sm">
                    {clientInfo.goal && <div className="flex justify-between"><span className="text-gray-400">Goal:</span><span className="text-white font-medium">{clientInfo.goal}</span></div>}
                    {clientInfo.startDate && <div className="flex justify-between"><span className="text-gray-400">Start Date:</span><span className="text-white">{new Date(clientInfo.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
                    {clientInfo.planEnd && <div className="flex justify-between"><span className="text-gray-400">Plan End:</span><span className="text-white">{new Date(clientInfo.planEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
                  </div>
                </div>

                <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                  <h2 className="font-heading text-xl uppercase text-accent mb-4">Payment Status</h2>
                  {(clientInfo.owed - clientInfo.paid) > 0 ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-1"><svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><p className="text-red-400 text-sm font-medium">Balance Due</p></div>
                      <p className="text-gray-400 text-xs">You have an outstanding balance. Contact Crystal to arrange payment.</p>
                    </div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><p className="text-green-400 text-sm font-medium">All Paid Up!</p></div>
                    </div>
                  )}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Plan Cost:</span><span className="text-white">${clientInfo.owed.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Paid So Far:</span><span className="text-green-400">${clientInfo.paid.toFixed(2)}</span></div>
                    {(clientInfo.owed - clientInfo.paid) > 0 && <div className="flex justify-between border-t border-white/10 pt-3"><span className="text-gray-400">Remaining:</span><span className="text-red-400 font-bold">${(clientInfo.owed - clientInfo.paid).toFixed(2)}</span></div>}
                  </div>
                  <div className="w-full bg-primary/50 rounded-full h-2 mt-4"><div className={`h-2 rounded-full ${(clientInfo.owed - clientInfo.paid) > 0 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${clientInfo.owed > 0 ? Math.min(100, (clientInfo.paid / clientInfo.owed) * 100) : 100}%` }} /></div>
                  <p className="text-gray-400 text-xs mt-1 text-right">{clientInfo.owed > 0 ? Math.round((clientInfo.paid / clientInfo.owed) * 100) : 100}% paid</p>
                </div>
              </>
            ) : (
              <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6 text-center">
                <p className="text-gray-500">No active plan. Contact Crystal for details.</p>
              </div>
            )}

            {/* Plan History */}
            {allPlans.filter(p => p.status !== "active").length > 0 && (
              <details className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
                <summary className="font-heading text-sm uppercase text-gray-400 cursor-pointer hover:text-white">
                  Plan History ({allPlans.filter(p => p.status !== "active").length})
                </summary>
                <div className="mt-4 space-y-4">
                  {allPlans.filter(p => p.status !== "active").map((plan, i) => (
                    <div key={i} className="border border-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {plan.goal && <span className="text-white text-sm font-medium">{plan.goal}</span>}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{plan.status}</span>
                        </div>
                      </div>
                      <p className="text-gray-300 text-xs mb-2">
                        {new Date(plan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(plan.planEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Cost: ${plan.owed.toFixed(2)}</span>
                        <span className={`font-medium ${(plan.owed - plan.paid) > 0 ? "text-red-400" : "text-green-400"}`}>
                          {(plan.owed - plan.paid) > 0 ? `$${(plan.owed - plan.paid).toFixed(2)} due` : "Paid in full"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Strava Connection */}
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
                <h2 className="font-heading text-xl uppercase text-accent">Strava</h2>
              </div>
              {stravaConnection === null ? (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm">Loading...</p>
                </div>
              ) : stravaConnection.connected ? (
                <div>
                  <div className="flex items-center gap-3 mb-4 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    {stravaConnection.athleteProfile && (
                      <img src={stravaConnection.athleteProfile} alt="Strava profile" className="w-10 h-10 rounded-full" />
                    )}
                    <div>
                      <p className="text-green-400 text-sm font-medium flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Connected
                      </p>
                      <p className="text-white text-sm">{stravaConnection.athleteName}</p>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mb-4">Your Strava activities will automatically sync to your training log.</p>

                  {/* Import History Section */}
                  <div className="bg-primary/30 border border-white/5 rounded-lg p-4 mb-4">
                    <p className="text-white text-sm font-medium mb-1">Import Past Activities</p>
                    <p className="text-gray-500 text-xs mb-3">Pull in activities from Strava that happened before you connected.</p>
                    {!showStravaImport ? (
                      <button onClick={() => setShowStravaImport(true)} className="text-orange-400 text-xs hover:underline">Import history...</button>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">From</label>
                            <input type="date" value={stravaImportFrom} onChange={(e) => setStravaImportFrom(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">To</label>
                            <input type="date" value={stravaImportTo} onChange={(e) => setStravaImportTo(e.target.value)} className="w-full bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={handleStravaImport} disabled={stravaImporting || !stravaImportFrom} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-xs disabled:opacity-50 transition-colors">
                            {stravaImporting ? 'Importing...' : 'Import Activities'}
                          </button>
                          <button onClick={() => setShowStravaImport(false)} className="text-gray-400 text-xs hover:text-white">Cancel</button>
                        </div>
                        {stravaImportResult && (
                          <div className={`rounded-lg p-3 text-xs ${stravaImportResult.imported > 0 ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
                            {stravaImportResult.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button onClick={handleDisconnectStrava} disabled={disconnectingStrava} className="border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2 px-4 rounded-lg text-xs transition-colors disabled:opacity-50">
                    {disconnectingStrava ? 'Disconnecting...' : 'Disconnect Strava'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-400 text-sm mb-4">Connect your Strava account to automatically sync completed activities to your training log.</p>
                  <a href="/api/strava/auth" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
                    Connect Strava
                  </a>
                  {stravaError && <p className="text-red-400 text-xs mt-3">{stravaError}</p>}
                </div>
              )}
            </div>

            {/* Account Preferences */}
            <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
              <h2 className="font-heading text-xl uppercase text-accent mb-2">Account Preferences</h2>

              {/* Distance Unit */}
              <div className="mb-6">
                <p className="text-white text-sm font-medium mb-1">Distance Unit</p>
                <p className="text-gray-300 text-xs mb-3">Choose how distances are displayed across your dashboard.</p>
                <div className="flex gap-2">
                  <button onClick={() => saveDistanceUnit("mi")} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${clientDistanceUnit === "mi" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Miles (mi)</button>
                  <button onClick={() => saveDistanceUnit("km")} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${clientDistanceUnit === "km" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Kilometers (km)</button>
                </div>
              </div>

              {/* Default Week View */}
              <div className="mb-6">
                <p className="text-white text-sm font-medium mb-1">Default Week View</p>
                <p className="text-gray-300 text-xs mb-3">Choose whether day blocks are expanded or collapsed by default.</p>
                <div className="flex gap-2">
                  <button onClick={() => saveDefaultExpanded(true)} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${defaultExpanded ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Expanded</button>
                  <button onClick={() => saveDefaultExpanded(false)} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${!defaultExpanded ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>Collapsed</button>
                </div>
              </div>

              <hr className="border-white/10 mb-6" />
              <p className="text-gray-300 text-xs mb-6">Choose which emails you receive from Pistol Performance.</p>

              <div className="space-y-5">
                {/* New Training Plan Published */}
                <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">New Training Plan Published</p>
                      <p className="text-gray-300 text-xs mt-0.5">Get notified when Crystal publishes your weekly training plan</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={notifPlanPublished}
                      onClick={() => { const newVal = !notifPlanPublished; setNotifPlanPublished(newVal); saveNotifPrefs(newVal, notifMessages); }}
                      className={`w-11 h-6 rounded-full relative transition-colors ${notifPlanPublished ? "bg-green-500" : "bg-gray-600"}`}
                    >
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform" style={{ transform: notifPlanPublished ? "translateX(22px)" : "translateX(2px)" }} />
                    </button>
                  </div>
                  {!notifPlanPublished && (
                    <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                      <p className="text-yellow-400 text-xs">Turning this off means you&apos;ll need to log in regularly to check if Crystal has published your plan for the week. We recommend keeping this on.</p>
                    </div>
                  )}
                </div>

                {/* Messages from Crystal */}
                <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white text-sm font-medium">Messages from Crystal</p>
                      <p className="text-gray-300 text-xs mt-0.5">How you receive message notifications</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setNotifMessages("immediate"); saveNotifPrefs(notifPlanPublished, "immediate"); }} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-colors ${notifMessages === "immediate" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>
                      Send immediately
                    </button>
                    <button onClick={() => { setNotifMessages("daily"); saveNotifPrefs(notifPlanPublished, "daily"); }} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-colors ${notifMessages === "daily" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>
                      Daily summary
                    </button>
                    <button onClick={() => { setNotifMessages("off"); saveNotifPrefs(notifPlanPublished, "off"); }} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-colors ${notifMessages === "off" ? "bg-accent/20 border border-accent/40 text-accent" : "bg-primary/50 border border-white/10 text-gray-400 hover:text-white"}`}>
                      Off
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs mt-2">
                    {notifMessages === "immediate" && "You'll receive an email each time Crystal sends you a message."}
                    {notifMessages === "daily" && "You'll receive one email per day summarising any messages from Crystal."}
                    {notifMessages === "off" && "You won't receive email notifications for messages. Check the app to read them."}
                  </p>
                </div>

                {/* Strava Activity Synced */}
                <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">Strava Activity Synced</p>
                      <p className="text-gray-300 text-xs mt-0.5">Get emailed when a Strava activity syncs and needs your attention</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={notifStravaSynced}
                      onClick={() => { const newVal = !notifStravaSynced; setNotifStravaSynced(newVal); fetch('/api/notification-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stravaSynced: newVal }) }); }}
                      className={`w-11 h-6 rounded-full relative transition-colors ${notifStravaSynced ? "bg-green-500" : "bg-gray-600"}`}
                    >
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform" style={{ transform: notifStravaSynced ? "translateX(22px)" : "translateX(2px)" }} />
                    </button>
                  </div>
                </div>

                {/* Workout Comments */}
                <div className="bg-primary/30 border border-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">Workout Comments</p>
                      <p className="text-gray-300 text-xs mt-0.5">Get emailed when Crystal comments on one of your workouts</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={notifWorkoutComments}
                      onClick={() => { const newVal = !notifWorkoutComments; setNotifWorkoutComments(newVal); fetch('/api/notification-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workoutComments: newVal }) }); }}
                      className={`w-11 h-6 rounded-full relative transition-colors ${notifWorkoutComments ? "bg-green-500" : "bg-gray-600"}`}
                    >
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform" style={{ transform: notifWorkoutComments ? "translateX(22px)" : "translateX(2px)" }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* All Updates Overlay */}
      {showAllUpdates && (
        <div className="fixed inset-0 z-50 bg-primary/95 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl uppercase text-white">All Updates</h2>
              <button onClick={() => setShowAllUpdates(false)} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-6">
              {clientUpdates.map((update, idx) => (
                <div key={idx} className="bg-secondary/50 border border-white/10 rounded-xl p-5">
                  <p className="text-accent text-sm font-heading uppercase mb-3">{update.date}</p>
                  <ul className="space-y-2">
                    {update.items.map((item, i) => (
                      <li key={i} className="text-gray-300 text-sm flex gap-2.5"><span className="text-accent mt-0.5 flex-shrink-0">•</span><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
