'use client'

import { useState } from 'react'
import Link from 'next/link'
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
    answer: "First Mile Coach is a free platform built specifically for new coaches and personal trainers who need professional tools to manage their clients — without paying for expensive software designed for bigger operations. It includes training plan builders, client dashboards, messaging, progress tracking, and more. We're currently in beta and completely free to use.",
    category: "Getting Started",
    tags: ["overview", "what", "about", "platform"],
  },
  {
    id: "who-created-this",
    question: "Who created this?",
    answer: "First Mile Coach was built by Curtis Irwin (a learning & development leader at Amazon, based in London) for his sister Crystal Irwin (a running coach in Springfield, Missouri). Crystal needed a simple way to manage her growing client list without paying for expensive tools designed for massive coaching operations. What started as a side project to make Crystal's life easier became a platform for every coach who's just starting out. Real people, real problem, real solution.",
    category: "Getting Started",
    tags: ["who", "created", "built", "founder", "team", "about us"],
  },
  {
    id: "who-is-it-for",
    question: "Who is First Mile Coach designed for?",
    answer: "It's designed for coaches who are just starting out, coaching on the side, or running a small operation: new running coaches with their first few clients, personal trainers working from a park or small gym, CrossFit coaches managing a handful of athletes, or any fitness professional who needs simple client management without the complexity and cost of enterprise platforms like TrueCoach or TrainHeroic.",
    category: "Getting Started",
    tags: ["who", "target", "audience", "coaches", "trainers"],
  },
  {
    id: "experienced-coach",
    question: "I'm an experienced coach or PT — is this platform for me?",
    answer: "It depends on what you need. If you want a simple, clean platform without the bloat of enterprise tools, it works great regardless of your experience level. But we're honest: if you need advanced analytics, automated periodisation, payment processing, or complex team management — platforms like TrainHeroic or TrueCoach are probably a better fit. Those are great tools for established coaches with bigger budgets. We're specifically built for coaches who are just getting started or doing this on the side and can't justify those costs yet.",
    category: "Getting Started",
    tags: ["experienced", "advanced", "professional", "established", "PT", "personal trainer"],
  },
  {
    id: "how-to-sign-up",
    question: "How do I sign up?",
    answer: "We're currently in beta. Scroll to the 'Sign Up for Beta' section on our home page and fill in your details: name, email, coaching type, and expected number of clients. We'll review your application and get back to you with access details. It's completely free.",
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

  // === PLATFORM FEATURES ===
  {
    id: "what-features",
    question: "What features are included?",
    answer: "Everything you need to manage clients professionally: Weekly training plan builder (runs, strength, cross-training, rest days), Client dashboards (mobile-friendly, add-to-homescreen), Structured workout builders (intervals, tempo, circuits, sets/reps), In-app messaging with email notifications, Exercise library with video demos, Client progress tracking & stats, Draft & publish workflow, Multi-coach support, Strava integration, and more. All features are included — no tiers, no paywalls.",
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
    answer: "No app download needed! First Mile Coach is a Progressive Web App (PWA). Clients can add it to their homescreen on any phone (iPhone or Android) and it opens full-screen like a native app — no app store required.",
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
    answer: "The sidebar shows your full client list with search and status filters (Active/Archived/All). Unread message badges show who needs attention. The dashboard gives you an overview of drafts to publish. Use templates and program templates to speed up programming. Batch your weekly programming in one session rather than doing it daily.",
    category: "Coach Workflow",
    tags: ["manage", "many", "clients", "efficient", "organize"],
  },
  {
    id: "archive-clients",
    question: "What happens when I archive a client?",
    answer: "Archiving a client: blocks them from logging in (they can't access their dashboard), disconnects their Strava connection, moves them to the Archived filter in your client list, and does NOT delete any data. You can unarchive them anytime to restore full access.",
    category: "Coach Workflow",
    tags: ["archive", "inactive", "remove", "pause", "client"],
  },

  // === DATA & PRIVACY ===
  {
    id: "data-ownership",
    question: "Who owns the data?",
    answer: "You do. Your client data, training plans, workout logs, and messages are yours. We'll never sell your data, use it for advertising, or share it with third parties. If you ever decide to leave, you can export everything. No lock-in, no hostage situation.",
    category: "Data & Privacy",
    tags: ["data", "ownership", "privacy", "export", "mine"],
  },
  {
    id: "data-export",
    question: "Can I export my data?",
    answer: "Yes. You can export your clients, plans, and notes anytime. We believe your data should never be held hostage — if you want to move to another platform (or if you outgrow us and move to TrueCoach, TrainHeroic, etc.), take everything with you. No export fees, no restrictions.",
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
    answer: "By design. Native apps require paying Apple and Google a 30% tax on all revenue. That's a massive cost that gets passed on to users. By being a web app (PWA), we avoid that overhead entirely — which helps keep the platform free. The web app experience is nearly identical to a native app when added to your homescreen.",
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
    answer: "Those are excellent platforms for established coaches with bigger operations and budgets. They have advanced analytics, automated programming, retention tools, marketplace features, and more. We don't have all those features — and we're not trying to. First Mile Coach is specifically for coaches who are just starting out, coaching on the side, or have a few clients and can't justify those costs yet. Think of us as the introduction: we give you what you need to get going professionally, and when you're ready for those premium features and have the revenue to support them, we'll help you move on.",
    category: "Comparison",
    tags: ["compare", "trainheroic", "truecoach", "competitor", "alternative", "vs"],
  },
  {
    id: "vs-spreadsheets",
    question: "Why not just use Google Sheets or a calendar?",
    answer: "You absolutely can — many coaches do! But First Mile Coach gives you: a professional client-facing dashboard (not a shared spreadsheet), automatic notifications, built-in messaging, workout logging with effort tracking, Strava integration, structured workout builders, and progress stats. It's the jump from 'managing in notebooks' to 'looking like a real coaching business' — and it's free during beta.",
    category: "Comparison",
    tags: ["spreadsheet", "google sheets", "calendar", "manual", "alternative"],
  },
  {
    id: "vs-whatsapp",
    question: "Why not just use WhatsApp or text messages?",
    answer: "WhatsApp/texting works, but: you lose context (what did I assign last week?), everything mixes with personal messages, you can't track what clients actually did, there's no structured plan view, and it looks unprofessional. First Mile Coach keeps coaching communication separate, with full history per client, tied to their actual training data.",
    category: "Comparison",
    tags: ["whatsapp", "text", "messaging", "communication", "vs"],
  },

  // === BETA ===
  {
    id: "what-is-beta",
    question: "What does 'beta' mean?",
    answer: "It just means you're getting early access to the platform while we're still building it. The app is fully functional — you can use it with real clients right now — but we're still actively adding features and improving things based on your feedback. In return for helping us test and shape the product, you get full access for free. Think of it as: you help us build the best tool possible, and you get to use it at no cost while we figure things out together.",
    category: "Beta",
    tags: ["beta", "early", "access", "what", "mean"],
  },
  {
    id: "beta-is-it-safe",
    question: "Is it safe to use with real clients?",
    answer: "Yes. The platform is fully functional and we use it with real coaching clients every day. 'Beta' doesn't mean broken — it means we're still adding features and improving based on feedback. Your data is stored on production-grade infrastructure (Supabase + Vercel) and is safe. You might encounter the occasional rough edge, but nothing that would affect your clients' experience in a meaningful way.",
    category: "Beta",
    tags: ["safe", "real", "clients", "beta", "production"],
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
    answer: "There's a Feedback button in the bottom corner of the app — both coaches and clients have it. Use it anytime to report bugs, suggest features, or ask questions. We read every single submission and respond directly. We may also occasionally send a short email asking for your thoughts on new features.",
    category: "Beta",
    tags: ["feedback", "report", "bug", "suggest", "contact"],
  },
  {
    id: "beta-data-safe",
    question: "Will my data be deleted when beta ends?",
    answer: "No. Your data is safe and will NOT be deleted. We're using the same production infrastructure that will run after beta ends. Everything you build now — clients, plans, messages, workout logs — carries forward. There is no 'wipe' when beta ends.",
    category: "Beta",
    tags: ["data", "safe", "delete", "keep", "beta", "permanent"],
  },
  {
    id: "after-beta",
    question: "What happens when beta ends?",
    answer: "We're still working that out. Our goal is to always be the most affordable option for coaches who are just getting started. We'll give you plenty of notice before anything changes, and we'll never surprise you with charges. Your data stays exactly where it is regardless.",
    category: "Beta",
    tags: ["after", "beta", "ends", "what happens", "future"],
  },
  {
    id: "beta-free-how-long",
    question: "How long is it free for?",
    answer: "For the entire beta period. We haven't set a hard end date — we'll keep it free until we're confident the platform is polished and ready. You'll get plenty of advance notice before anything changes. Right now, just focus on using it and giving us feedback.",
    category: "Beta",
    tags: ["free", "how long", "duration", "beta", "time"],
  },
  {
    id: "join-without-beta",
    question: "Can I join now without being part of the beta?",
    answer: "Not at the moment. We're currently in beta-only mode while we build and refine the platform with our first coaches. Everyone who joins right now is part of the beta (which is free). Once beta ends and we're confident the platform is solid, we'll open up general access.",
    category: "Beta",
    tags: ["join", "without beta", "skip", "paid", "now", "general access"],
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
    answer: "Use the feedback button in the app (bottom corner of any page) or the 'Contact Us' form on this page to send us a message. You can also select 'Question' in the feedback popup to ask us anything directly. During beta, response times are typically within a few hours. We're a small team that genuinely cares about every coach's experience.",
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
  {
    id: "can-i-leave",
    question: "Can I leave anytime?",
    answer: "Yes. No contracts, no lock-in, no cancellation fees. If you decide to leave, you can export all your data (clients, plans, logs) and take everything with you. We'll never hold your data hostage. And if you're leaving because you've outgrown us and are moving to a bigger platform — that's exactly what we're here for. Congrats!",
    category: "Account & Support",
    tags: ["cancel", "leave", "contract", "lock-in", "quit"],
  },
];

const categories = [
  "All",
  "Getting Started",
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
      setResult({ type: 'error', text: 'Network error. Please try again later.' });
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
          <span className="fmc-beta-banner-text">Now accepting beta coaches — completely free</span>
          <Link href="/" className="fmc-features-nav-link">Home</Link>
          <Link href="/faq" className="fmc-features-nav-link fmc-features-nav-link-active">FAQ</Link>
          <a href="/#beta" className="fmc-beta-banner-link">Sign Up for Beta &rarr;</a>
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
            Everything you need to know about First Mile Coach. Can&apos;t find your answer? <a href="#contact" className="fmc-faq-link">Get in touch</a> or email <a href="mailto:hello@firstmilecoach.com" className="fmc-faq-link">hello@firstmilecoach.com</a>.
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
                placeholder="Search FAQs... (e.g. 'strava', 'client', 'beta')"
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
                    <p className="fmc-faq-item-answer">{item.answer}</p>
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
      <section className="fmc-faq-contact-section" id="contact">
        <div className="fmc-container">
          <div className="fmc-faq-contact-content fmc-fade-in">
            <h2>Have a question not listed here?</h2>
            <p>Get in touch — we respond to every message personally.</p>
            <div className="fmc-faq-contact-methods">
              <ContactForm />
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#9e9e9e' }}>
                or email us directly at <a href="mailto:hello@firstmilecoach.com" style={{ color: '#f26522', textDecoration: 'none' }}>hello@firstmilecoach.com</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="fmc-footer">
        <p className="fmc-footer-brand-text">First Mile Coach</p>
        <p className="fmc-footer-tagline">The free platform for coaches who are just getting started.</p>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#9e9e9e' }}>
          <a href="mailto:hello@firstmilecoach.com" style={{ color: '#9e9e9e', textDecoration: 'none' }}>hello@firstmilecoach.com</a>
        </p>
        <p className="fmc-footer-copy">&copy; {new Date().getFullYear()} First Mile Coach. All rights reserved.</p>
      </footer>
    </div>
  )
}
