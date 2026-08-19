'use client'

import { useState } from 'react'
import Link from 'next/link'
import RegionToggle from './RegionToggle'
import Price, { PricePerMonth, PriceRange } from './Price'
import { usePrice } from './CurrencyContext'
import FirstMileAnimations from './FirstMileAnimations'
import './firstmile.css'

type FAQItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
};

const faqItems: FAQItem[] = [
  // === GETTING STARTED ===
  {
    id: "what-is-fmc",
    question: "What is First Mile Coach?",
    answer: "First Mile Coach is an affordable platform built specifically for new running coaches and personal trainers who need professional tools to manage their clients — without paying hundreds per month. It includes training plan builders, client dashboards, messaging, progress tracking, and more — all for just {PRICE_PER_MONTH} per 10 active clients.",
    category: "Getting Started",
    tags: ["overview", "what", "about", "platform"],
  },
  {
    id: "who-is-it-for",
    question: "Who is First Mile Coach designed for?",
    answer: "It's designed for coaches who are just starting out or running a small operation: new running coaches with their first few clients, personal trainers working from a park or small gym, CrossFit coaches managing a handful of athletes, or any fitness professional who needs simple, affordable client management without the complexity of enterprise tools.",
    category: "Getting Started",
    tags: ["who", "target", "audience", "coaches", "trainers"],
  },
  {
    id: "how-to-sign-up",
    question: "How do I sign up?",
    answer: "We're currently in beta. Scroll to the 'Apply for Beta Access' section on our home page and fill in your details: name, email, coaching type, and expected number of clients. We'll review your application and get back to you with access details. Beta access is completely free until June 30, 2027.",
    category: "Getting Started",
    tags: ["sign up", "register", "join", "apply", "beta", "start"],
  },
  {
    id: "how-quickly-start",
    question: "How quickly can I get set up?",
    answer: "Within minutes. Once your beta access is approved: 1) Log in with your credentials, 2) Add your first client (just their name and email), 3) Create a training plan for them, 4) Publish it — they'll get an email invite to view it. The entire setup is designed to be dead simple with zero configuration needed.",
    category: "Getting Started",
    tags: ["setup", "quick", "time", "start", "onboarding"],
  },
  {
    id: "do-i-need-tech-skills",
    question: "Do I need any technical skills to use it?",
    answer: "Absolutely not. If you can use a smartphone and send an email, you can use First Mile Coach. The interface is designed for coaches, not tech people. No coding, no complex setup, no confusing dashboards. Just straightforward tools that work the way you'd expect.",
    category: "Getting Started",
    tags: ["technical", "skills", "easy", "simple", "beginner"],
  },

  // === PRICING & BILLING ===
  {
    id: "how-much-cost",
    question: "How much does it cost?",
    answer: "Just {PRICE_PER_MONTH} per 10 active clients. That means: 1-10 clients = {PRICE_PER_MONTH}, 11-20 clients = {PRICE2_PER_MONTH}, 21-30 clients = {PRICE3_PER_MONTH}, and so on. If you have a quiet month and archive some clients, your bill goes down automatically. During beta (until June 30, 2027), it's completely free.",
    category: "Pricing & Billing",
    tags: ["cost", "price", "money", "billing", "payment", "how much"],
  },
  {
    id: "why-so-cheap",
    question: "Why is it so cheap? What's the catch?",
    answer: "No catch. We keep costs low by: 1) Not having a native app (no 30% app store tax), 2) Keeping the feature set focused (no bloated enterprise features), 3) Running lean infrastructure. We pass those savings directly to coaches. We're not trying to make money off people who are just getting started — we're trying to help them take off.",
    category: "Pricing & Billing",
    tags: ["cheap", "affordable", "catch", "why", "business model"],
  },
  {
    id: "free-during-beta",
    question: "Is it really free during the beta?",
    answer: "Yes, 100% free until June 30, 2027. No credit card required. No hidden fees. We want early coaches to help us build the best product possible — your feedback is payment enough during this phase.",
    category: "Pricing & Billing",
    tags: ["free", "beta", "cost", "trial", "credit card"],
  },
  {
    id: "what-counts-active",
    question: "What counts as an 'active client'?",
    answer: "An active client is anyone who isn't archived. If a client takes a break, you can archive them — they won't count towards your bill, and their data is preserved. When they come back, unarchive them and everything is right where they left it.",
    category: "Pricing & Billing",
    tags: ["active", "client", "count", "billing", "archive"],
  },
  {
    id: "payment-methods",
    question: "How do I pay? What payment methods do you accept?",
    answer: "During beta, there's nothing to pay. After beta ends, we'll support standard payment methods (credit/debit card). Billing will be monthly and automatic based on your active client count. You'll always be able to see exactly what you'll be charged before it happens.",
    category: "Pricing & Billing",
    tags: ["payment", "card", "method", "billing", "how to pay"],
  },
  {
    id: "cancel-anytime",
    question: "Can I cancel anytime?",
    answer: "Yes. No contracts, no lock-in, no cancellation fees. If you decide to leave, you can export all your data (clients, plans, logs) as a spreadsheet and take everything with you. We'll never hold your data hostage.",
    category: "Pricing & Billing",
    tags: ["cancel", "leave", "contract", "lock-in", "quit"],
  },

  // === PLATFORM FEATURES ===
  {
    id: "what-features",
    question: "What features are included?",
    answer: "Everything you need to manage clients professionally: Weekly training plan builder (runs, strength, cross-training, rest days), Client dashboards (mobile-friendly, add-to-homescreen), Structured workout builders (intervals, tempo, circuits, sets/reps), In-app messaging with email notifications, Exercise library with video demos, Client progress tracking & stats, Draft & publish workflow, Multi-coach support, Strava integration, and more.",
    category: "Platform Features",
    tags: ["features", "included", "what", "tools", "capabilities"],
  },
  {
    id: "training-plan-builder",
    question: "How does the training plan builder work?",
    answer: "You create weekly training plans (Monday–Sunday) for each client. For each day you choose a workout type (Run, Walk, Cross Training, Cycling, Stretching, Strength, HIIT, Swimming, or Rest), then add details like distance, pace targets, coaching notes, and structured breakdowns. Save as a draft to review later, or publish directly so your client sees it immediately.",
    category: "Platform Features",
    tags: ["plan", "builder", "create", "weekly", "workout", "programming"],
  },
  {
    id: "structured-workouts",
    question: "Can I build structured interval/tempo sessions?",
    answer: "Yes! The Structured Run Builder lets you create step-by-step interval sessions with warmup, work blocks (distance or time-based), recovery jogs, and cooldown — each with its own pace target. For strength/cross-training, the Structured Cross-Training Builder lets you define exercises with sets, reps, rest periods, and supersets. Clients see a clear visual breakdown.",
    category: "Platform Features",
    tags: ["structured", "intervals", "tempo", "builder", "workout"],
  },
  {
    id: "exercise-library",
    question: "What is the Exercise Library?",
    answer: "It's your personal database of exercises. Add exercises with names, muscle groups, equipment needed, instructions, and video links (YouTube, Vimeo, etc.). When building cross-training or strength workouts, you can pull exercises from your library — clients see the exercise details and can tap to watch demo videos right in their dashboard.",
    category: "Platform Features",
    tags: ["exercise", "library", "video", "demo", "database"],
  },
  {
    id: "messaging-system",
    question: "How does messaging work?",
    answer: "Each client has their own conversation thread — like texting. You send a message, they get an email notification. They reply, you get an email notification. Full history is preserved so you never lose context. There are also per-workout comment threads for specific feedback on individual sessions.",
    category: "Platform Features",
    tags: ["messaging", "chat", "communication", "email", "notifications"],
  },
  {
    id: "progress-tracking",
    question: "How do I track my clients' progress?",
    answer: "When clients log workouts, you see their data: actual distance, pace, duration, RPE (effort rating), sleep quality, heart rate (if Strava-connected), and personal notes. The Stats tab shows aggregated metrics: total miles, completion rate, average RPE, and trends over time. You can filter by current week, current plan, or all time.",
    category: "Platform Features",
    tags: ["progress", "tracking", "stats", "data", "metrics", "results"],
  },
  {
    id: "draft-publish",
    question: "What's the draft and publish system?",
    answer: "You can save training weeks as drafts (invisible to clients) so you can prepare plans in advance without them seeing unfinished work. When ready, publish with one click — the client gets notified. This lets you batch-program multiple weeks on a Sunday evening without flooding inboxes. Your dashboard shows how many drafts are waiting to be published.",
    category: "Platform Features",
    tags: ["draft", "publish", "workflow", "advance", "prepare"],
  },
  {
    id: "templates",
    question: "Can I save and reuse training templates?",
    answer: "Yes! Save any week as a template (e.g., 'Base Building Week', 'Recovery Week', 'Taper'). When creating a new week for any client, load a template as your starting point and customize from there. You can also save individual day templates for common workouts. There are also multi-week Program Templates that auto-populate based on race date.",
    category: "Platform Features",
    tags: ["templates", "reuse", "save", "copy", "program"],
  },
  {
    id: "multi-coach",
    question: "Can I have multiple coaches on one account?",
    answer: "Yes. If you run a small coaching team, you can invite other coaches and assign them to specific clients. Each coach sees only their assigned clients, while the account owner (head coach) has full visibility. Clients only see their assigned coach's name and photo.",
    category: "Platform Features",
    tags: ["multi-coach", "team", "multiple", "coaches", "assign"],
  },
  {
    id: "strava-integration",
    question: "Does it integrate with Strava?",
    answer: "Yes. Clients can connect their Strava account so their GPS activities auto-sync to the platform. When a Strava activity matches a programmed workout (same day, type, and similar distance), it auto-completes the workout with real data — pace, distance, duration, and heart rate. No manual logging needed for Strava-connected clients.",
    category: "Platform Features",
    tags: ["strava", "integration", "sync", "garmin", "watch", "gps"],
  },
  {
    id: "email-notifications",
    question: "What email notifications does the platform send?",
    answer: "Coaches get notified when: clients log workouts, send messages, or reply to comments. Clients get notified when: their coach publishes a new training plan, sends a message, or comments on their workout. All notifications are configurable — turn individual types on or off as needed.",
    category: "Platform Features",
    tags: ["email", "notifications", "alerts", "notify"],
  },
  {
    id: "dark-light-mode",
    question: "Is there a dark mode?",
    answer: "Yes! Both coaches and clients can toggle between dark mode and light mode using the sun/moon icon. The preference is saved per device and synced across sessions. Dark mode is the default.",
    category: "Platform Features",
    tags: ["dark", "light", "mode", "theme", "display"],
  },

  // === CLIENT EXPERIENCE ===
  {
    id: "what-clients-see",
    question: "What do my clients see?",
    answer: "Clients get their own clean dashboard showing: their current week's training plan with workout details, the ability to log completed workouts (mark done, skip, or partial), direct messaging with their coach, workout comments for specific feedback, their progress stats, Strava integration for automatic logging, and account settings. It's mobile-first and can be added to their homescreen like an app.",
    category: "Client Experience",
    tags: ["client", "see", "dashboard", "view", "experience"],
  },
  {
    id: "how-clients-join",
    question: "How do my clients get access?",
    answer: "When you add a client (just their name and email), they receive an invite email with a link to set their password. Once they set up their account, they can access their dashboard immediately. The invite expires after 7 days — you can resend it from their Account tab if needed.",
    category: "Client Experience",
    tags: ["client", "invite", "join", "access", "onboard", "email"],
  },
  {
    id: "clients-log-workouts",
    question: "Can clients log their workouts?",
    answer: "Yes! For each workout, clients can mark it as: 'I Did This' (with RPE, distance, pace, notes), 'Partially Done' (with what they actually completed), or 'I Skipped This' (with a reason). You see all of this data in your admin panel and can adjust future plans accordingly.",
    category: "Client Experience",
    tags: ["client", "log", "workout", "complete", "track"],
  },
  {
    id: "clients-add-own-workouts",
    question: "Can clients add their own workouts?",
    answer: "Yes. Clients can add workouts that aren't on their plan (a spontaneous run, an extra gym session, etc.). These appear with a 'Your Workout' badge so you can distinguish them from programmed workouts. They count toward weekly stats and you can see everything they did.",
    category: "Client Experience",
    tags: ["client", "add", "own", "extra", "workout"],
  },
  {
    id: "clients-reschedule",
    question: "Can clients reschedule workouts?",
    answer: "Yes. If a client needs to move a workout to a different day within the same week, they can use the reschedule/move feature. The workout moves to the new day and you're notified of the change. This is great for when life gets in the way and plans need to shuffle.",
    category: "Client Experience",
    tags: ["client", "reschedule", "move", "swap", "change day"],
  },
  {
    id: "pwa-homescreen",
    question: "Do clients need to download an app?",
    answer: "No app download needed! First Mile Coach is a Progressive Web App (PWA). Clients can add it to their homescreen on any phone (iPhone or Android) and it opens full-screen like a native app. This also means no app store fees — which is why we can keep pricing so low.",
    category: "Client Experience",
    tags: ["app", "download", "pwa", "homescreen", "install", "phone"],
  },
  {
    id: "client-offline",
    question: "Does it work offline?",
    answer: "Clients can view their last-loaded training plan offline after adding the app to their homescreen. However, logging workouts and sending messages requires an internet connection. It's designed to work great on mobile data — pages are lightweight and fast.",
    category: "Client Experience",
    tags: ["offline", "internet", "data", "connection"],
  },

  // === COACH WORKFLOW ===
  {
    id: "typical-workflow",
    question: "What does a typical coaching workflow look like?",
    answer: "A suggested weekly flow: Sunday/Monday — publish training plans for the upcoming week. Daily — check for client messages and respond. Mid-week — review completed workouts, leave comments on standout efforts or concerns. End of week — review stats, identify who's on track vs. struggling. Weekend — draft next week's plans. The platform is designed around this rhythm.",
    category: "Coach Workflow",
    tags: ["workflow", "routine", "weekly", "process", "how to coach"],
  },
  {
    id: "plan-required",
    question: "Do I need to set up a 'plan' before I can program weeks?",
    answer: "Yes. Each client needs an active Plan (set in their Account tab) before you can create training weeks. A Plan defines the training period (start & end dates), goal, race details, and payment terms. All training weeks must fall within the plan dates. This ensures clean tracking of goals, progress, and billing. Only one plan can be active at a time.",
    category: "Coach Workflow",
    tags: ["plan", "required", "setup", "before", "account", "dates"],
  },
  {
    id: "program-templates-how",
    question: "How do Program Templates work?",
    answer: "Program Templates are multi-week structured training plans (e.g., '20-Week Marathon Program'). You assign them to a client's Plan — not individual weeks. The system uses the Race Date to calculate which program week to auto-load when you create a new week. Pick a date range in the Create Week form, and it auto-fills with the correct program week. You can still customize everything after it loads.",
    category: "Coach Workflow",
    tags: ["program", "template", "multi-week", "auto", "race date"],
  },
  {
    id: "manage-many-clients",
    question: "How do I manage lots of clients efficiently?",
    answer: "The sidebar shows your full client list with search and status filters (Active/Archived/All). Unread message badges show who needs attention. The dashboard gives you an overview of drafts to publish and outstanding payments. Use templates and program templates to speed up programming. Batch your weekly programming in one session rather than doing it daily.",
    category: "Coach Workflow",
    tags: ["manage", "many", "clients", "efficient", "organize"],
  },
  {
    id: "archive-clients",
    question: "What happens when I archive a client?",
    answer: "Archiving a client: blocks them from logging in (they can't access their dashboard), disconnects their Strava connection, moves them to the Archived filter in your client list, and does NOT delete any data. You can unarchive them anytime to restore full access. Archived clients don't count toward your billing.",
    category: "Coach Workflow",
    tags: ["archive", "inactive", "remove", "pause", "client"],
  },

  // === DATA & PRIVACY ===
  {
    id: "data-ownership",
    question: "Who owns the data?",
    answer: "You do. Your client data, training plans, workout logs, and messages are yours. We'll never sell your data, use it for advertising, or share it with third parties. If you ever decide to leave, you can export everything as a spreadsheet. No lock-in, no hostage situation.",
    category: "Data & Privacy",
    tags: ["data", "ownership", "privacy", "export", "mine"],
  },
  {
    id: "data-export",
    question: "Can I export my data?",
    answer: "Yes. You can export your clients, plans, and notes anytime. We believe your data should never be held hostage — if you want to move to another platform, take everything with you. No export fees, no restrictions.",
    category: "Data & Privacy",
    tags: ["export", "download", "data", "leave", "migrate"],
  },
  {
    id: "client-privacy",
    question: "Is my clients' data private?",
    answer: "Absolutely. Client data is only visible to their assigned coach(es). We use Supabase (backed by PostgreSQL) with row-level security, meaning database queries only return data the authenticated user is authorized to see. We don't sell data, and we don't use it for anything other than running the platform.",
    category: "Data & Privacy",
    tags: ["privacy", "secure", "client", "data", "protection"],
  },
  {
    id: "cycle-tracking-privacy",
    question: "How does menstrual cycle tracking work privacy-wise?",
    answer: "Cycle tracking is 100% opt-in. The coach can request it, but the client gets a one-time consent prompt. If they opt in, they see a 'On period today' checkbox when logging. If they opt out, the feature stays hidden and the coach is NEVER told their choice. Privacy is fully respected — it's a sensitive feature handled with care.",
    category: "Data & Privacy",
    tags: ["cycle", "period", "privacy", "consent", "tracking"],
  },

  // === TECHNICAL ===
  {
    id: "what-devices",
    question: "What devices does it work on?",
    answer: "Everything with a web browser. iPhone, Android, iPad, desktop (Mac, Windows, Linux, Chromebook). It's a web app that works in any modern browser — Chrome, Safari, Firefox, Edge. Both coaches and clients can add it to their homescreen for an app-like experience.",
    category: "Technical",
    tags: ["devices", "phone", "computer", "browser", "compatibility"],
  },
  {
    id: "native-app",
    question: "Why isn't there a native app?",
    answer: "By design. Native apps require paying Apple and Google a 30% tax on all revenue. That's a massive cost that platforms pass on to coaches as higher subscription fees. By being a web app (PWA), we avoid that tax entirely — which is the main reason we can charge {PRICE_PER_MONTH} instead of {PRICE50_PER_MONTH}. The web app experience is nearly identical to a native app when added to your homescreen.",
    category: "Technical",
    tags: ["native", "app", "ios", "android", "why", "web app"],
  },
  {
    id: "browser-support",
    question: "Which browsers are supported?",
    answer: "All modern browsers: Chrome, Safari (iOS and Mac), Firefox, Edge, and Samsung Internet. We recommend keeping your browser updated to the latest version for the best experience. The app is optimized for mobile Safari and Chrome since most clients access it from their phones.",
    category: "Technical",
    tags: ["browser", "chrome", "safari", "firefox", "support"],
  },
  {
    id: "how-secure",
    question: "How secure is the platform?",
    answer: "We use industry-standard security: HTTPS everywhere, authentication via Supabase Auth (battle-tested by thousands of apps), row-level security in the database, bcrypt password hashing, and short-lived session tokens. We don't store passwords in plain text and all communication is encrypted in transit.",
    category: "Technical",
    tags: ["security", "secure", "safe", "password", "encryption"],
  },
  {
    id: "uptime-reliability",
    question: "How reliable is the platform?",
    answer: "We're hosted on Vercel (for the app) and Supabase (for the database) — both are enterprise-grade infrastructure providers used by millions of applications. We have automatic deployments, zero-downtime updates, and global CDN distribution. If something goes wrong, we're notified immediately.",
    category: "Technical",
    tags: ["reliable", "uptime", "hosting", "server", "downtime"],
  },

  // === COMPARISON ===
  {
    id: "vs-other-platforms",
    question: "How does First Mile Coach compare to TrainHeroic, TrueCoach, etc.?",
    answer: "Those are excellent platforms for established coaches with bigger operations and budgets ({PRICE50}–{PRICE200}+/month). They have advanced analytics, automated programming, retention tools, and more. First Mile Coach is specifically for coaches who are just starting out and need professional basics at a fraction of the cost. Think of us as your starting platform — when you're ready for those advanced features and can afford them, we'll even help you export your data to migrate.",
    category: "Comparison",
    tags: ["compare", "trainheroic", "truecoach", "competitor", "alternative", "vs"],
  },
  {
    id: "vs-spreadsheets",
    question: "Why not just use Google Sheets or a calendar?",
    answer: "You absolutely can — many coaches do! But First Mile Coach gives you: a professional client-facing dashboard (not a shared spreadsheet), automatic notifications, built-in messaging, workout logging with effort tracking, Strava integration, structured workout builders, and progress stats. All for {PRICE_PER_MONTH}. It's the jump from 'managing in notebooks' to 'looking like a real coaching business' without the real coaching business price tag.",
    category: "Comparison",
    tags: ["spreadsheet", "google sheets", "calendar", "manual", "alternative"],
  },
  {
    id: "vs-whatsapp",
    question: "Why not just use WhatsApp or text messages?",
    answer: "WhatsApp/texting works, but: you lose context (what did I assign last week?), everything mixes with personal messages, you can't track what clients actually did, there's no structured plan view, and it looks unprofessional. First Mile Coach keeps coaching communication separate, with full history per client, tied to their actual training data. And at {PRICE_PER_MONTH} it costs less than the time you waste scrolling through WhatsApp groups.",
    category: "Comparison",
    tags: ["whatsapp", "text", "messaging", "communication", "vs"],
  },

  // === BETA SPECIFIC ===
  {
    id: "what-is-beta",
    question: "What does 'beta' mean?",
    answer: "Beta means we're in the early access phase. The platform is fully functional and safe to use with real clients, but we're still actively adding features and polishing based on feedback from our first coaches. You might encounter the occasional rough edge — and we want to hear about it. In exchange, you get free access until June 30, 2027.",
    category: "Beta",
    tags: ["beta", "early", "access", "what", "mean"],
  },
  {
    id: "beta-limits",
    question: "Are there limits during the beta?",
    answer: "No artificial limits. You can add as many clients as you want, create unlimited plans, send unlimited messages. The only 'limit' is that some features are still being built (we're always shipping new things). If something is missing that you need, tell us — beta feedback directly shapes what we build next.",
    category: "Beta",
    tags: ["beta", "limits", "restrictions", "unlimited"],
  },
  {
    id: "beta-feedback",
    question: "How do I give feedback during the beta?",
    answer: "There's a feedback button in the app (bottom corner). Use it anytime to report bugs, suggest features, or tell us what's confusing. We read every single submission and respond directly. You can also message us through the platform or email. Beta coaches have a direct line to the development team.",
    category: "Beta",
    tags: ["feedback", "report", "bug", "suggest", "contact"],
  },
  {
    id: "beta-data-safe",
    question: "Is my data safe during the beta? Will it be deleted?",
    answer: "Your data is safe and will NOT be deleted. We're using the same production infrastructure that will run after beta ends. Everything you build now — clients, plans, messages, workout logs — carries forward. There is no 'wipe' when beta ends.",
    category: "Beta",
    tags: ["data", "safe", "delete", "keep", "beta", "permanent"],
  },
  {
    id: "after-beta",
    question: "What happens when beta ends?",
    answer: "After June 30, 2027, billing starts at {PRICE_PER_MONTH} per 10 active clients. Your data stays exactly where it is. You'll get plenty of advance notice before billing begins, and you can choose to continue or export your data and leave. No surprises.",
    category: "Beta",
    tags: ["after", "beta", "ends", "billing", "what happens"],
  },
  {
    id: "join-without-beta",
    question: "Can I join now without being part of the beta?",
    answer: "Not at the moment. We're currently in beta-only mode while we build and refine the platform with our first coaches. There's no way to skip the beta and go straight to a paid plan — everyone who joins right now is part of the beta (which is free). Once beta ends and we're confident the platform is rock-solid, we'll open up general access. For now, apply for beta and you'll get the same full platform for free.",
    category: "Beta",
    tags: ["join", "without beta", "skip", "paid", "now", "general access"],
  },
  {
    id: "first-50-coaches",
    question: "What does 'first 50 coaches' mean?",
    answer: "We're accepting the first 50 coaches into our beta program. This keeps the community small enough that we can give personal attention to each coach, respond to feedback quickly, and build features that real coaches actually need. Once we hit 50, we may pause new sign-ups temporarily while we catch up on feedback.",
    category: "Beta",
    tags: ["50", "coaches", "limit", "first", "spots"],
  },

  // === ACCOUNT & SUPPORT ===
  {
    id: "forgot-password",
    question: "What if I forget my password?",
    answer: "Click 'Forgot Password' on the login page. You'll receive a reset link via email. Click it, set a new password, and you're back in. The same process works for clients. If you're having trouble, contact us directly and we can help.",
    category: "Account & Support",
    tags: ["password", "forgot", "reset", "login", "access"],
  },
  {
    id: "change-email",
    question: "Can I change my email address?",
    answer: "Contact us directly and we can update your email. This applies to both coach accounts and client accounts. We verify ownership before making changes to prevent unauthorized access.",
    category: "Account & Support",
    tags: ["email", "change", "update", "account"],
  },
  {
    id: "contact-support",
    question: "How do I get help or contact support?",
    answer: "Email us at hello@firstmilecoach.com — we read and respond to every message personally. You can also use the feedback button in the app (bottom corner of any page) or the 'Contact Us' form on this page. During beta, response times are typically within a few hours. We're a small team that genuinely cares about every coach's experience.",
    category: "Account & Support",
    tags: ["help", "support", "contact", "email", "assistance", "hello"],
  },
  {
    id: "delete-account",
    question: "Can I delete my account?",
    answer: "Yes. Contact us and we'll permanently delete your account and all associated data. If you have clients, we recommend exporting their data and notifying them first. Account deletion is irreversible — we can't recover data once it's removed.",
    category: "Account & Support",
    tags: ["delete", "account", "remove", "permanent"],
  },
];

const categories = [
  "All",
  "Getting Started",
  "Pricing & Billing",
  "Platform Features",
  "Client Experience",
  "Coach Workflow",
  "Data & Privacy",
  "Technical",
  "Comparison",
  "Beta",
  "Account & Support",
];

function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim(), source: 'faq_page' }),
      });
      if (res.ok) {
        setResult({ type: 'success', text: "Message sent! We'll get back to you soon." });
        setName(''); setEmail(''); setMessage('');
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ type: 'error', text: data.error || 'Something went wrong. Please try again or email us directly.' });
      }
    } catch {
      setResult({ type: 'error', text: 'Network error. Please try emailing hello@firstmilecoach.com directly.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="fmc-faq-contact-form">
      <p className="fmc-faq-contact-form-label">Or send us a message:</p>
      <div className="fmc-faq-contact-fields">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required className="fmc-faq-contact-input" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" required className="fmc-faq-contact-input" />
      </div>
      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Your question or message..." required rows={3} className="fmc-faq-contact-textarea" />
      <button type="submit" disabled={sending} className="fmc-faq-contact-submit">
        {sending ? 'Sending...' : 'Send Message'}
      </button>
      {result && (
        <p className={`fmc-faq-contact-result ${result.type === 'success' ? 'fmc-faq-contact-success' : 'fmc-faq-contact-error'}`}>
          {result.text}
        </p>
      )}
    </form>
  );
}

export default function FAQPageClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const formatPrice = usePrice();

  // Replace price tokens in FAQ answer strings with dynamic currency
  const renderAnswer = (answer: string) => {
    return answer
      .replace(/\{PRICE_PER_MONTH\}/g, `${formatPrice(1)}/month`)
      .replace(/\{PRICE2_PER_MONTH\}/g, `${formatPrice(2)}/month`)
      .replace(/\{PRICE3_PER_MONTH\}/g, `${formatPrice(3)}/month`)
      .replace(/\{PRICE10_PER_MONTH\}/g, `${formatPrice(10)}/month`)
      .replace(/\{PRICE50_PER_MONTH\}/g, `${formatPrice(50)}/month`)
      .replace(/\{PRICE50\}/g, formatPrice(50))
      .replace(/\{PRICE200\}/g, formatPrice(200));
  };

  const filteredItems = faqItems.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    if (!searchQuery.trim()) return matchesCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.tags.some(t => t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fmc">
      <FirstMileAnimations />

      {/* Sticky Nav Banner */}
      <div className="fmc-beta-banner">
        <div className="fmc-beta-banner-content">
          <span className="fmc-beta-banner-badge">BETA</span>
          <span className="fmc-beta-banner-text">Now accepting the first 50 coaches — free until June 30, 2027</span>
          <Link href="/" className="fmc-features-nav-link">Home</Link>
          <Link href="/faq" className="fmc-features-nav-link fmc-features-nav-link-active">FAQ</Link>
          <a href="/#beta" className="fmc-beta-banner-link">Apply Now &rarr;</a>
          <div className="fmc-banner-divider" />
          <RegionToggle />
          <div className="fmc-banner-divider" />
          <a href="/login?role=coach" className="fmc-banner-login">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Coach Login
          </a>
          <a href="/login?role=client" className="fmc-banner-login fmc-banner-login-client">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Client Login
          </a>
        </div>
        {/* Mobile-only login buttons row */}
        <div className="fmc-banner-mobile-logins">
          <a href="/login?role=coach" className="fmc-banner-mobile-login-btn fmc-banner-mobile-login-coach">
            Coach Login
          </a>
          <a href="/login?role=client" className="fmc-banner-mobile-login-btn fmc-banner-mobile-login-client">
            Client Login
          </a>
        </div>
      </div>

      {/* FAQ Hero */}
      <section className="fmc-features-hero">
        <div className="fmc-hero-bg" />
        <div className="fmc-features-hero-content">
          <span className="fmc-features-hero-badge">FAQ</span>
          <h1>Frequently Asked<br />Questions</h1>
          <p className="fmc-features-hero-sub">
            Everything you need to know about First Mile Coach. Can&apos;t find your answer? <a href="/#beta" className="fmc-faq-link">Get in touch</a>.
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="fmc-faq-section">
        <div className="fmc-container">
          {/* Search */}
          <div className="fmc-faq-search-wrapper fmc-fade-in">
            <div className="fmc-faq-search-box">
              <svg className="fmc-faq-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search FAQs... (e.g. 'pricing', 'strava', 'client')"
                className="fmc-faq-search-input"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="fmc-faq-search-clear">✕</button>
              )}
            </div>
            {searchQuery && (
              <p className="fmc-faq-search-count">
                {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </div>

          {/* Category Tags */}
          <div className="fmc-faq-categories fmc-fade-in">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`fmc-faq-category-btn ${activeCategory === cat ? 'fmc-faq-category-active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ Items */}
          <div className="fmc-faq-list">
            {filteredItems.length === 0 && (
              <div className="fmc-faq-empty">
                <p>No matching questions found. Try a different search term.</p>
              </div>
            )}
            {filteredItems.map(item => (
              <div key={item.id} className={`fmc-faq-item ${expandedItem === item.id ? 'fmc-faq-item-open' : ''}`}>
                <button
                  onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  className="fmc-faq-item-header"
                >
                  <div className="fmc-faq-item-left">
                    <span className="fmc-faq-item-badge">{item.category}</span>
                    <span className="fmc-faq-item-question">{item.question}</span>
                  </div>
                  <svg className={`fmc-faq-item-arrow ${expandedItem === item.id ? 'fmc-faq-item-arrow-open' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedItem === item.id && (
                  <div className="fmc-faq-item-body">
                    <p className="fmc-faq-item-answer">{renderAnswer(item.answer)}</p>
                    <div className="fmc-faq-item-tags">
                      {item.tags.map(tag => (
                        <span
                          key={tag}
                          onClick={() => { setSearchQuery(tag); setActiveCategory('All'); }}
                          className="fmc-faq-tag"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="fmc-faq-contact-section">
        <div className="fmc-container">
          <div className="fmc-faq-contact-content fmc-fade-in">
            <h2>Have a question not listed here?</h2>
            <p>Get in touch — we respond to every message personally.</p>
            <div className="fmc-faq-contact-methods">
              <a href="mailto:hello@firstmilecoach.com" className="fmc-faq-contact-email">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                hello@firstmilecoach.com
              </a>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="fmc-features-cta">
        <div className="fmc-container">
          <div className="fmc-features-cta-content fmc-fade-in">
            <h2>Still have questions?</h2>
            <p>Apply for beta access and we&apos;ll be happy to answer anything personally.</p>
            <div className="fmc-features-cta-buttons">
              <a href="/#beta" className="fmc-features-cta-btn fmc-features-cta-btn-primary">
                Apply for Beta Access &rarr;
              </a>
              <Link href="/" className="fmc-features-cta-btn fmc-features-cta-btn-secondary">
                &larr; Back to Home
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="fmc-footer">
        <p className="fmc-footer-brand-text">First Mile Coach</p>
        <p className="fmc-footer-tagline">The {formatPrice(1)}/month platform for new coaches.</p>
        <p className="fmc-footer-copy">&copy; {new Date().getFullYear()} First Mile Coach. All rights reserved.</p>
      </footer>
    </div>
  )
}
