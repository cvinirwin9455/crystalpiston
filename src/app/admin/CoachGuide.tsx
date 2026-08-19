"use client";

import { useState } from "react";

type GuideSection = {
  id: string;
  title: string;
  category: string;
  icon: string;
  steps: string[];
  tips?: string[];
  content: string;
  keywords: string[];
};

const guideSections: GuideSection[] = [
  // === GETTING STARTED ===
  {
    id: "welcome",
    title: "Welcome to Your Coach Admin",
    category: "Getting Started",
    icon: "rocket",
    keywords: ["start", "begin", "overview", "intro", "welcome", "first time"],
    steps: [
      "Log in with your coach credentials at /login",
      "You'll land on the Admin Dashboard — this is your home base for everything",
      "The left sidebar shows your client list — click any client to manage them",
      "The gear menu (top of sidebar on desktop, top-right on mobile) has all your settings",
    ],
    tips: [
      "Bookmark your admin page for quick access",
      "The platform works on mobile too — great for quick updates on the go",
      "Toggle light/dark mode with the sun/moon icon in your header",
    ],
    content: `Your Coach Admin is the central hub where you manage all your clients, build training plans, track progress, communicate, and run your coaching business. Everything is organized around your **client list** on the left and **per-client tools** in the main area.`,
  },
  {
    id: "first-steps",
    title: "Your First Steps (Quick Setup)",
    category: "Getting Started",
    icon: "checklist",
    keywords: ["setup", "first", "quick start", "checklist", "onboarding"],
    steps: [
      "Upload your profile photo (gear menu → Account Preferences → Avatar)",
      "Set your default distance unit (miles or kilometers)",
      "Configure your email notification preferences",
      "Add your first client using the '+ New Client' button",
      "Build and publish their first training week",
    ],
    tips: [
      "Your profile photo shows in the client's dashboard header — it adds a personal touch",
      "You can change all preferences anytime from the gear menu",
    ],
    content: `Before you start programming for clients, take 2 minutes to personalize your setup. A profile photo, your preferred distance unit, and notification preferences will make everything smoother from day one.`,
  },
  {
    id: "navigation",
    title: "Navigating the Admin Panel",
    category: "Getting Started",
    icon: "compass",
    keywords: ["navigate", "layout", "sidebar", "menu", "find", "where"],
    steps: [
      "Left Sidebar: Your full client list with search and status filters",
      "Top Gear Menu: What's New, Templates, Exercise Library, Account Preferences, Manage Coaches",
      "Per-Client Tabs: Training & Logs, Create Week, Drafts, Messages, Stats, Account",
      "Dashboard (no client selected): Shows drafts to publish, recent payments, quick stats",
    ],
    tips: [
      "Use the search bar at the top of the client list to quickly find clients",
      "Filter by Active/Archived/All to manage your roster",
      "Your URL updates as you navigate — refresh the page and you'll stay where you were",
    ],
    content: `The admin is split into two areas: the **client sidebar** (left) and the **main content area** (right). When no client is selected, you see your dashboard overview. Click a client to see their individual tabs for programming, messaging, and management.`,
  },

  // === CLIENT MANAGEMENT ===
  {
    id: "add-client",
    title: "Adding a New Client",
    category: "Client Management",
    icon: "user-plus",
    keywords: ["add", "new", "create", "client", "invite", "onboard"],
    steps: [
      "Click '+ New Client' at the top of the sidebar",
      "Fill in: Name, Email, Gender, Goal, Plan Duration, Start Date",
      "Set their billing: Total owed and amount paid",
      "Click 'Create Client' — an invite email is sent automatically",
      "The client receives a link to set their password and access their dashboard",
    ],
    tips: [
      "The invite link expires after 7 days — you can resend from their Account tab if needed",
      "Their status shows as 'Pending' until they accept the invite",
      "You can start building their training plan immediately, even before they accept",
      "On mobile, scroll down after clicking '+ New Client' — the form appears below the client list",
    ],
    content: `Adding a client is a one-step process. Fill in their details and the platform handles the rest — sending them an invite email with a link to set their password. Once they accept, they can see their training plans, log workouts, and message you.`,
  },
  {
    id: "client-account",
    title: "Managing Client Account Details",
    category: "Client Management",
    icon: "settings",
    keywords: ["edit", "account", "goal", "payment", "plan", "duration", "billing", "archive"],
    steps: [
      "Select a client → click the 'Account' tab",
      "Edit their goal, plan dates, payment amounts, and personal details",
      "Track payment status with the visual progress bar",
      "Archive clients when their plan ends (they lose dashboard access)",
      "Unarchive anytime to reactivate them",
    ],
    tips: [
      "Archived clients' data is preserved — nothing is deleted",
      "You can resend invites from here if their link expired",
      "The payment tracker is for your records only — clients see a basic status",
    ],
    content: `The Account tab for each client is where you manage the business side: their goal, plan timeline, payment tracking, and status. Keep this updated as plans evolve and payments come in.`,
  },
  {
    id: "assign-coaches",
    title: "Assigning Coaches to Clients",
    category: "Client Management",
    icon: "users",
    keywords: ["assign", "coach", "team", "multiple", "manage coaches", "delegate"],
    steps: [
      "Go to gear menu → Manage Coaches",
      "Invite new coaches with their email address",
      "From a client's Account tab, assign one or more coaches",
      "Set which coach is the 'default' (primary) for that client",
      "Each assigned coach can view and program for that client",
    ],
    tips: [
      "Only head coaches can manage other coaches — regular coaches see only their assigned clients",
      "Clients only see their default coach's name and photo",
      "You can reassign clients between coaches anytime",
    ],
    content: `If you run a coaching team, you can invite other coaches and assign them to specific clients. Each coach only sees their assigned clients, while head coaches have full visibility across the roster.`,
  },

  // === PROGRAMMING ===
  {
    id: "create-week",
    title: "Creating a Training Week",
    category: "Programming",
    icon: "calendar-plus",
    keywords: ["create", "week", "plan", "program", "build", "training", "schedule"],
    steps: [
      "Select a client → click 'Create Week' tab",
      "Set the date range (Monday–Sunday) for the week",
      "Add a weekly focus and coach message (optional but recommended)",
      "For each day, click '+ Add Workout' to add activities",
      "Choose workout type: Run, Walk, Cross Training, Cycling, Stretching, Strength, HIIT, Swimming, or Rest",
      "Fill in details: title, distance, pace target, location, description, coach notes",
      "Click 'Save as Draft' when you want to review before publishing",
      "Click 'Publish Week' when ready — the client sees it immediately",
    ],
    tips: [
      "Coach Notes appear highlighted in gold on the client's card — use them for important cues",
      "You can add multiple workouts per day (e.g., morning run + evening stretch)",
      "Distance and pace fields are optional for non-distance workouts (like stretching)",
      "The weekly focus appears at the top of the client's training view",
    ],
    content: `Building a training week is the core of your coaching workflow. Each week has 7 days (Mon–Sun), and each day can have multiple workouts. You control every detail: type, distance, pace targets, location, descriptions, and private coach notes.`,
  },
  {
    id: "structured-workouts",
    title: "Building Structured Workouts (Intervals, Blocks)",
    category: "Programming",
    icon: "layers",
    keywords: ["structured", "interval", "tempo", "blocks", "warmup", "cooldown", "segments"],
    steps: [
      "When creating a Run workout, click 'Add Structure' to open the Structured Run Builder",
      "Add workout blocks: Warmup, Work, Recovery, Cooldown",
      "Set distance/time, pace/effort, and notes for each block",
      "The builder auto-calculates total distance from your blocks",
      "For Cross Training, the Structured Cross Training Builder lets you add exercises with sets/reps/duration",
      "Save — the structure appears as a formatted breakdown on the client's workout card",
    ],
    tips: [
      "Structured workouts look much more professional to clients than plain text descriptions",
      "You can mix distance-based and time-based blocks (e.g., '1 mile warmup' + '5 × 3:00 intervals')",
      "The exercise library integrates with the cross-training builder for quick exercise lookup",
    ],
    content: `For complex workouts (intervals, tempos, progression runs, circuit training), use the Structured Builder. It lets you define individual blocks with specific paces, distances, and instructions — giving clients a clear step-by-step breakdown.`,
  },
  {
    id: "drafts",
    title: "Working with Drafts",
    category: "Programming",
    icon: "edit",
    keywords: ["draft", "save", "unpublished", "review", "edit", "update"],
    steps: [
      "When building a week, click 'Save as Draft' instead of 'Publish'",
      "Drafts appear in the 'Drafts' tab for that client",
      "Edit a draft anytime by clicking on it",
      "When ready, open the draft and click 'Publish Week'",
      "Your dashboard shows total unpublished drafts across all clients",
    ],
    tips: [
      "Use drafts to prepare weeks in advance (e.g., program 2–3 weeks ahead)",
      "You can duplicate a published week as a draft for the next week, then modify it",
      "The dashboard 'Drafts to Publish' widget reminds you when you have unpublished work",
    ],
    content: `Drafts let you work on training plans without the client seeing them. Build weeks in advance, review them, make adjustments, and publish when the timing is right. This is perfect for batch-programming multiple weeks at once.`,
  },
  {
    id: "edit-published",
    title: "Editing a Published Week",
    category: "Programming",
    icon: "pencil",
    keywords: ["edit", "change", "published", "update", "modify", "adjust", "live"],
    steps: [
      "Select the client → go to 'Training & Logs' tab",
      "Navigate to the published week you want to edit",
      "Click the 'Edit Week' button (pencil icon)",
      "Make your changes to workouts, descriptions, coach notes, etc.",
      "Click 'Save Changes' — updates appear immediately for the client",
    ],
    tips: [
      "If a client has already logged a workout, their log data is preserved when you edit",
      "You can also edit the weekly coach message after publishing",
      "Use this to adjust plans mid-week based on client feedback",
    ],
    content: `Plans change — injuries happen, life gets busy, or a client crushes a workout and you want to ramp up. You can edit any published week at any time. Changes are reflected immediately on the client's dashboard.`,
  },
  {
    id: "templates",
    title: "Using Training Templates",
    category: "Programming",
    icon: "copy",
    keywords: ["template", "duplicate", "copy", "reuse", "save template", "base plan"],
    steps: [
      "Open the Templates view from the gear menu",
      "Save any published or draft week as a template",
      "When creating a new week, load a template as your starting point",
      "Modify the template content for the specific client and week",
      "Build a library of templates for common training blocks (base building, taper, recovery, etc.)",
    ],
    tips: [
      "Templates are org-wide — all coaches on your team can use them",
      "Great for recurring patterns: 'Easy Recovery Week', 'Marathon Taper', 'Base Building Block'",
      "You can also duplicate a specific client's week as a template for other clients",
    ],
    content: `Templates save you time by letting you reuse common training structures. Save your best weeks as templates, then load them as starting points for new clients or training blocks. Customize from there instead of building from scratch.`,
  },
  {
    id: "ai-assistant",
    title: "Using the AI Coach Assistant",
    category: "Programming",
    icon: "sparkles",
    keywords: ["ai", "assistant", "suggest", "generate", "help", "auto", "smart"],
    steps: [
      "Open the AI panel from the Create Week tab (look for the AI/sparkle icon)",
      "Choose a quick action or type a custom prompt",
      "Select which client's data to include for context",
      "Choose data depth: Light (minimal), Standard (recommended), or Deep (full history)",
      "Review the AI suggestion — copy what you like into your week plan",
      "The AI uses your client's history, goals, and recent performance to make suggestions",
    ],
    tips: [
      "The AI is a tool to assist you, not replace your coaching judgment",
      "Try: 'Suggest a recovery week' or 'Build intervals for someone training for a 4:00 marathon'",
      "Deep data mode includes all workout logs and metrics — use for personalized suggestions",
      "You have a limited number of AI credits per month (shown in the panel)",
    ],
    content: `The AI Coach Assistant helps you brainstorm and build training plans faster. It understands your client's goal, history, and recent training to offer contextual suggestions. Use it for inspiration, recovery week ideas, or when you're programming for many clients.`,
  },

  // === CLIENT INTERACTION ===
  {
    id: "messaging",
    title: "Messaging Clients",
    category: "Client Interaction",
    icon: "chat",
    keywords: ["message", "chat", "communicate", "reply", "send", "talk"],
    steps: [
      "Select a client → click the 'Messages' tab",
      "Type your message and hit Send",
      "The client receives an email notification (if they have notifications enabled)",
      "You'll see a red badge on unread messages in the client list",
      "Messages are chronological — newest at the bottom like a text conversation",
    ],
    tips: [
      "You get email notifications when clients message you (configurable in Account Preferences)",
      "The unread badge shows on each client in your sidebar — quickly see who needs a response",
      "Keep messages supportive and actionable — clients love hearing from their coach!",
    ],
    content: `Direct messaging is built into the platform — no need for separate texting apps. Each client has their own message thread. Notifications keep both sides in the loop without requiring anyone to constantly check the app.`,
  },
  {
    id: "workout-comments",
    title: "Commenting on Workouts",
    category: "Client Interaction",
    icon: "annotation",
    keywords: ["comment", "feedback", "workout", "reply", "notes", "thread"],
    steps: [
      "Select a client → go to 'Training & Logs'",
      "Find a completed workout — look for the comment icon/section at the bottom",
      "Type your feedback and post the comment",
      "Comments are tied to that specific workout for clear context",
      "The client gets a notification about your comment",
    ],
    tips: [
      "Comments are great for specific feedback: 'Great pace on those intervals!' or 'How did your knee feel?'",
      "Clients can reply to your comments, creating a thread",
      "This is different from Messages — comments are workout-specific, messages are general",
    ],
    content: `Workout comments let you give contextual, specific feedback right on the workout card. When a client completes a workout, drop a comment acknowledging their effort, asking follow-up questions, or adjusting future expectations. It shows you're paying attention.`,
  },
  {
    id: "reviewing-logs",
    title: "Reviewing Client Workout Logs",
    category: "Client Interaction",
    icon: "clipboard",
    keywords: ["log", "review", "completed", "rpe", "data", "metrics", "progress", "results"],
    steps: [
      "Select a client → 'Training & Logs' tab",
      "Completed workouts show a green checkmark with logged metrics",
      "View: RPE (effort), sleep quality, actual miles, pace, duration, heart rate (if Strava-connected)",
      "Skipped workouts show the reason (injury, sick, schedule, etc.)",
      "Client-added workouts appear with a cyan badge — these are extras they did on their own",
      "Use the Stats tab for aggregated data and trends",
    ],
    tips: [
      "High RPE on easy runs might indicate overtraining or life stress",
      "Check the 'completion rate' in stats — below 70% might mean the plan is too ambitious",
      "Client notes often contain golden insights about how training is going",
    ],
    content: `Every time a client marks a workout done (or skipped), you get rich data: effort level, actual performance, notes, and optional metrics like sleep and heart rate. Use this to calibrate future programming and catch early signs of overtraining or disengagement.`,
  },

  // === STATS & TRACKING ===
  {
    id: "client-stats",
    title: "Using Client Stats",
    category: "Stats & Tracking",
    icon: "chart",
    keywords: ["stats", "statistics", "progress", "completion", "miles", "data", "trends"],
    steps: [
      "Select a client → click the 'Stats' tab",
      "View summary metrics: total miles, completion rate, avg RPE, workout counts",
      "Filter by time period: This Week, Current Plan, or All Time",
      "See breakdown by workout type (runs, cross training, etc.)",
      "Track progress over time with visual indicators",
    ],
    tips: [
      "Stats auto-update as clients log workouts — no manual input needed",
      "Compare 'programmed vs. actual' miles to see if clients are over/under-training",
      "The Stats tab on the dashboard (no client selected) gives you an overview of all clients",
    ],
    content: `The Stats tab gives you a data-driven view of each client's training. See how they're performing relative to what you programmed, track trends over time, and use the numbers to inform your programming decisions.`,
  },
  {
    id: "strava-overview",
    title: "How Strava Integration Works (Coach Perspective)",
    category: "Stats & Tracking",
    icon: "activity",
    keywords: ["strava", "sync", "watch", "gps", "auto", "garmin", "apple watch"],
    steps: [
      "Clients connect their own Strava account from their dashboard (Account → Strava)",
      "Once connected, their GPS activities auto-sync to your admin view",
      "Strava-synced workouts show an orange Strava badge and include: distance, pace, duration, heart rate",
      "The system auto-matches Strava activities to programmed workouts when possible",
      "Unmatched activities appear as 'Extra' workouts on that day",
    ],
    tips: [
      "You don't need to do anything — Strava connection is managed by the client",
      "If a client connects Strava, you get much richer data without them manually entering metrics",
      "You can see if a client has Strava connected via their Account tab (checkmark icon)",
      "Encourage clients to connect Strava for better data and less manual logging",
    ],
    content: `Strava integration is client-initiated — they connect their account and activities auto-sync. For you as a coach, this means automatic workout data (pace, distance, heart rate, duration) without clients needing to manually type it in. Matched activities auto-complete the programmed workout.`,
  },
  {
    id: "cycle-tracking",
    title: "Cycle Tracking (Menstrual Cycle Support)",
    category: "Stats & Tracking",
    icon: "heart",
    keywords: ["cycle", "period", "menstrual", "female", "tracking", "hormones"],
    steps: [
      "From a female client's Account tab, toggle 'Request Cycle Tracking'",
      "The client receives a consent prompt on their dashboard (completely optional for them)",
      "If they opt in, a 'On period today' checkbox appears when they log workouts",
      "You can see their period status on workout logs to inform programming",
      "If they opt out, you will NOT be told — their choice is private",
    ],
    tips: [
      "This is an opt-in feature — never pressure clients to use it",
      "Use the data to reduce intensity during menstruation if appropriate for that client",
      "The request only shows for clients whose gender is set to 'female'",
    ],
    content: `Cycle tracking lets you factor menstrual cycles into programming. You request it, the client consents (or not — privately), and if enabled, you see whether they reported being on their period for each workout. This helps you adjust intensity and recover appropriately.`,
  },

  // === EXERCISE LIBRARY ===
  {
    id: "exercise-library",
    title: "Managing the Exercise Library",
    category: "Exercise Library",
    icon: "library",
    keywords: ["exercise", "library", "video", "demo", "add", "muscle", "search"],
    steps: [
      "Open from gear menu → Exercise Library",
      "Browse or search existing exercises by name, muscle group, or type",
      "Add new exercises with: name, muscle groups, equipment, instructions, and video URL",
      "Link exercises to structured cross-training workouts for client reference",
      "Clients see linked exercises with video demos in their workout cards",
    ],
    tips: [
      "Video links (YouTube, Vimeo) are great for demonstrating proper form",
      "Build your library over time — it grows more valuable as you add to it",
      "The library is shared across your coaching organization",
    ],
    content: `The Exercise Library is your database of exercises with demonstrations, instructions, and categorization. Link exercises to structured workouts so clients can see exactly how to perform each movement with video guidance.`,
  },

  // === BUSINESS & SETTINGS ===
  {
    id: "payments",
    title: "Tracking Client Payments",
    category: "Business & Settings",
    icon: "dollar",
    keywords: ["payment", "money", "billing", "owed", "paid", "invoice", "cost"],
    steps: [
      "Set total amount owed when creating or editing a client (Account tab)",
      "Record payments as they come in by updating the 'Paid' amount",
      "The visual progress bar shows payment status at a glance",
      "Your dashboard shows total outstanding balances across all clients",
      "Clients see their payment status (if they owe, a gentle alert appears on their dashboard)",
    ],
    tips: [
      "This is a simple tracking tool — it doesn't process payments",
      "Update payments promptly so your dashboard totals stay accurate",
      "The client-facing alert is subtle — it just shows 'Outstanding Balance' without pressuring them",
    ],
    content: `Payment tracking gives you a simple overview of who's paid and who hasn't. It's not a payment processor — just a record-keeping tool so you can quickly see your business status from the dashboard.`,
  },
  {
    id: "notifications-coach",
    title: "Configuring Your Notifications",
    category: "Business & Settings",
    icon: "bell",
    keywords: ["notification", "email", "alert", "preferences", "settings"],
    steps: [
      "Open gear menu → Account Preferences",
      "Configure which email notifications you receive",
      "Options include: client messages, workout completions, new Strava activities",
      "Choose between immediate notifications or daily summaries",
      "Changes save automatically",
    ],
    tips: [
      "If you have many clients, daily summaries prevent inbox overload",
      "Keep 'client messages' on immediate so you can respond quickly",
      "You can always check the unread badges in the admin even with emails off",
    ],
    content: `Control how and when the platform emails you. Balance staying responsive with your clients against inbox sanity. The in-app unread badges always show pending items regardless of email notification settings.`,
  },
  {
    id: "org-features",
    title: "Customizing Workout Types (Org Features)",
    category: "Business & Settings",
    icon: "toggle",
    keywords: ["features", "enable", "disable", "workout types", "organization", "customize"],
    steps: [
      "Open gear menu → Account Preferences",
      "Scroll to 'Activity Types' / 'Org Features'",
      "Toggle which workout types are available: Run, Walk, Cycling, Cross Training, Stretching, Strength, HIIT, Swimming",
      "Disabled types won't appear as options when creating workouts or when clients add their own",
      "Changes apply organization-wide for all coaches and clients",
    ],
    tips: [
      "If you only coach runners, disable irrelevant types to simplify the interface",
      "You can enable new types anytime as your coaching offerings expand",
      "This affects both the coach 'Create Week' options and client 'Add Workout' options",
    ],
    content: `Not every coach needs every workout type. If you specialize in running, you can hide cycling/swimming/etc. to keep the interface clean. These settings apply to your entire organization (all coaches and their clients).`,
  },
  {
    id: "theme-mode",
    title: "Light Mode & Dark Mode",
    category: "Business & Settings",
    icon: "sun-moon",
    keywords: ["theme", "dark", "light", "mode", "color", "display", "appearance"],
    steps: [
      "Click the sun/moon icon in the sidebar header area",
      "Toggle between Dark Mode (default, dark background) and Light Mode (bright background)",
      "Your preference is saved per device and synced across sessions",
      "Clients have their own independent theme toggle on their dashboard",
    ],
    tips: [
      "Light mode is great for daytime use or bright environments",
      "Your theme choice is independent of your clients' choices",
      "The platform supports both Crystal Pistol Performance and First Mile Coach branding automatically",
    ],
    content: `The platform fully supports both dark and light themes. Switch anytime with the toggle in your header — your preference is remembered. Each person (coach and clients) controls their own theme independently.`,
  },
  {
    id: "profile-avatar",
    title: "Setting Your Profile Photo",
    category: "Business & Settings",
    icon: "camera",
    keywords: ["photo", "avatar", "profile", "picture", "image", "upload"],
    steps: [
      "Open gear menu → Account Preferences",
      "Find the Avatar/Profile Photo section",
      "Upload a photo (headshot recommended)",
      "Your photo appears in the client's dashboard header and in message threads",
      "Clients also see it when they open the app — adds a personal coaching touch",
    ],
    tips: [
      "Use a clear, friendly headshot — it builds trust with new clients",
      "Supported formats: JPG, PNG (recommended size: 200×200px or larger)",
      "The photo is cropped into a circle so center your face in the image",
    ],
    content: `Your profile photo personalizes the coaching experience for clients. It appears in their dashboard header, messages, and anywhere your name shows. Upload a professional headshot to make a great impression.`,
  },

  // === TIPS & BEST PRACTICES ===
  {
    id: "workflow-tips",
    title: "Suggested Weekly Workflow",
    category: "Tips & Best Practices",
    icon: "repeat",
    keywords: ["workflow", "routine", "weekly", "process", "best practice", "system"],
    steps: [
      "Start of week: Publish training plans for the upcoming week (or check drafts to publish)",
      "Daily: Check for client messages and unread badges — respond same day if possible",
      "Mid-week: Review completed workouts, comment on standout efforts or concerns",
      "End of week: Review client stats, identify who's on track vs. struggling",
      "Weekend: Draft next week's plans for all clients (save as drafts, publish Sunday/Monday)",
    ],
    tips: [
      "Batch your programming — it's more efficient to program all clients at once",
      "Set aside specific times for client communication vs. programming",
      "Use templates for clients with similar goals to speed up programming",
      "The dashboard 'Drafts to Publish' widget helps you never forget to publish",
    ],
    content: `A consistent weekly workflow keeps you organized and ensures clients always have their plans on time. The platform is designed around this rhythm — programming, publishing, monitoring, communicating, and repeating.`,
  },
  {
    id: "programming-tips",
    title: "Programming Best Practices",
    category: "Tips & Best Practices",
    icon: "lightbulb",
    keywords: ["tips", "advice", "programming", "planning", "best practice", "effective"],
    steps: [
      "Always include a Weekly Focus — it gives clients context for the week's training",
      "Use Coach Notes for important workout-specific guidance (warmup cues, pacing strategy, etc.)",
      "Vary workout types to keep plans engaging and well-rounded",
      "Include rest days explicitly — clients see them and feel 'permitted' to rest",
      "Set realistic targets — check their recent RPE and completion rate before ramping up",
    ],
    tips: [
      "A 1–2 sentence Coach Message at the top of each week builds connection",
      "Clients respond well to being acknowledged — 'Great job last week!' goes a long way",
      "If completion rate is dropping, reduce volume rather than risking dropout",
      "Use the AI assistant for fresh ideas when programming feels repetitive",
    ],
    content: `Great programming is about more than just workouts — it's about the full client experience. Weekly messages, coach notes, appropriate challenge levels, and explicit rest days all contribute to client retention and results.`,
  },
  {
    id: "client-engagement",
    title: "Keeping Clients Engaged",
    category: "Tips & Best Practices",
    icon: "fire",
    keywords: ["engagement", "retention", "motivation", "keep", "active", "responsive"],
    steps: [
      "Respond to messages within 24 hours — clients need to feel heard",
      "Comment on completed workouts regularly — especially great efforts",
      "Adjust plans when life happens — flexibility shows you understand",
      "Celebrate milestones: 'You've completed 10 weeks!' or 'New pace PR!'",
      "If a client goes quiet (no logs for 3+ days), send a check-in message",
    ],
    tips: [
      "The #1 reason clients leave is feeling ignored — even a quick 'Nice work!' matters",
      "Use their workout notes to show you read them: 'You mentioned your knee — how's it feeling?'",
      "If RPE is consistently high, proactively offer a deload week before they burn out",
      "The unread badges help you never miss a client who needs attention",
    ],
    content: `Client retention depends on feeling coached, not just programmed. Regular interaction — comments, messages, plan adjustments — shows clients you're invested in their journey. The platform gives you visibility into who needs attention and who's thriving.`,
  },
];

const categories = ["All", "Getting Started", "Client Management", "Programming", "Client Interaction", "Stats & Tracking", "Exercise Library", "Business & Settings", "Tips & Best Practices"];

function GuideIcon({ icon, className = "w-5 h-5" }: { icon: string; className?: string }) {
  switch (icon) {
    case "rocket":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case "checklist":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
    case "compass":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
    case "user-plus":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>;
    case "settings":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "users":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
    case "calendar-plus":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "layers":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
    case "edit":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
    case "pencil":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
    case "copy":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
    case "sparkles":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
    case "chat":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
    case "annotation":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>;
    case "clipboard":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
    case "chart":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
    case "activity":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
    case "heart":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
    case "library":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>;
    case "dollar":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "bell":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
    case "toggle":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
    case "sun-moon":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    case "camera":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "repeat":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
    case "lightbulb":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
    case "fire":
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>;
    default:
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  }
}

export default function CoachGuide({ onBack }: { onBack: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedSection, setExpandedSection] = useState<string | null>("welcome");

  const filteredSections = guideSections.filter(section => {
    const matchesCategory = activeCategory === "All" || section.category === activeCategory;
    if (!searchQuery.trim()) return matchesCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      section.title.toLowerCase().includes(query) ||
      section.content.toLowerCase().includes(query) ||
      section.steps.some(s => s.toLowerCase().includes(query)) ||
      section.keywords.some(k => k.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors md:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="font-heading text-2xl uppercase text-white">Coach Guide</h1>
            <p className="text-gray-400 text-sm mt-1">Everything you need to know to manage your clients and grow your coaching business</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search the guide... (e.g. 'create week', 'client', 'template')"
          className="w-full bg-secondary/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent placeholder:text-gray-500"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {searchQuery && (
        <p className="text-gray-400 text-xs -mt-4">{filteredSections.length} result{filteredSections.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;</p>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat ? "bg-accent/20 border border-accent/40 text-accent" : "bg-secondary/50 border border-white/10 text-gray-400 hover:text-white"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Quick Start Banner (only shows on "All" or "Getting Started" category when no search) */}
      {!searchQuery && (activeCategory === "All" || activeCategory === "Getting Started") && (
        <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h3 className="text-white font-medium text-sm mb-1">Quick Start Checklist</h3>
              <div className="space-y-1.5 text-gray-300 text-xs">
                <p>✅ Upload your profile photo</p>
                <p>✅ Set your distance unit preference (miles/km)</p>
                <p>✅ Add your first client</p>
                <p>✅ Build and publish their first training week</p>
                <p>✅ Send them a welcome message</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {filteredSections.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" /></svg>
            <p className="text-gray-400 text-sm">No matching guides found. Try a different search term.</p>
          </div>
        )}
        {filteredSections.map(section => (
          <div key={section.id} className="bg-secondary/50 border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                  <GuideIcon icon={section.icon} className="w-4 h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-medium text-sm truncate">{section.title}</h3>
                  <p className="text-gray-500 text-xs">{section.category}</p>
                </div>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${expandedSection === section.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {expandedSection === section.id && (
              <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-white/5">
                {/* Overview */}
                <p className="text-gray-300 text-sm leading-relaxed mt-4 mb-4">
                  {section.content.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={k} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                      : <span key={k}>{part}</span>
                  )}
                </p>

                {/* Steps */}
                <div className="mb-4">
                  <h4 className="text-white text-xs font-heading uppercase tracking-wider mb-2.5">How to do it</h4>
                  <ol className="space-y-2">
                    {section.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-gray-300 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-[10px] font-bold mt-0.5">{i + 1}</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Tips */}
                {section.tips && section.tips.length > 0 && (
                  <div className="bg-gold/5 border border-gold/20 rounded-lg p-3.5">
                    <h4 className="text-gold text-xs font-heading uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      Pro Tips
                    </h4>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip, i) => (
                        <li key={i} className="text-gray-300 text-xs flex gap-2">
                          <span className="text-gold mt-0.5 flex-shrink-0">•</span>
                          <span className="leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-white/10 text-center pb-8">
        <p className="text-gray-400 text-sm mb-2">Need more help or have a feature request?</p>
        <p className="text-gray-500 text-xs">Contact support or check the &quot;What&apos;s New&quot; section for the latest updates.</p>
      </div>
    </div>
  );
}
