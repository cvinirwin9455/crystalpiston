'use client'

import Image from 'next/image'
import Link from 'next/link'
import FirstMileAnimations from './FirstMileAnimations'
import './firstmile.css'

export default function FeaturesPageClient() {
  return (
    <div className="fmc">
      <FirstMileAnimations />

      {/* Sticky Nav Banner */}
      <div className="fmc-beta-banner">
        <div className="fmc-beta-banner-content">
          <Link href="/" className="fmc-features-nav-logo">
            <Image
              src="/firstmile/logo.png"
              alt="First Mile Coach"
              width={32}
              height={32}
              className="fmc-features-nav-logo-img"
            />
          </Link>
          <Link href="/" className="fmc-features-nav-link">Home</Link>
          <Link href="/features" className="fmc-features-nav-link fmc-features-nav-link-active">Features</Link>
          <a href="/#pricing" className="fmc-features-nav-link">Pricing</a>
          <a href="/#beta" className="fmc-beta-banner-link">Apply Now &rarr;</a>
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

      {/* Features Hero */}
      <section className="fmc-features-hero">
        <div className="fmc-hero-bg" />
        <div className="fmc-features-hero-content">
          <span className="fmc-features-hero-badge">PLATFORM TOUR</span>
          <h1>Everything you need.<br />Nothing you don&apos;t.</h1>
          <p className="fmc-features-hero-sub">
            First Mile Coach gives new running coaches and personal trainers all the essentials to manage clients professionally — without the bloat or the price tag. Here&apos;s what&apos;s inside.
          </p>
        </div>
      </section>

      {/* Feature 1: Weekly Training Plan Builder */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Weekly Training Plan Builder</h2>
              <p>
                Build structured weekly training plans with an intuitive drag-and-drop interface. Add runs, strength sessions, cross-training, rest days — whatever your client needs. Each day has its own card where you can set workout type, distance, pace guidance, and coaching notes.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Drag-and-drop workout cards across days</li>
                <li>Set distance, time, pace, RPE targets</li>
                <li>Add detailed coaching notes per session</li>
                <li>Copy plans between clients or weeks</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
                <span>Weekly Plan Builder</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Client Dashboard */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-feature-row-reverse fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-client">Client</span>
              <h2>Client Training Dashboard</h2>
              <p>
                Your clients get their own clean, mobile-friendly dashboard where they can see their current training week at a glance. No clutter — just today&apos;s workout, this week&apos;s plan, and their progress. Works beautifully on phone, tablet, or desktop.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Today&apos;s workout highlighted front and center</li>
                <li>Week-at-a-glance calendar view</li>
                <li>Mobile-first design — add to homescreen as an app</li>
                <li>Instant access to coach notes and instructions</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder fmc-feature-placeholder-dark">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="9" x2="14" y2="9"/><line x1="8" y1="12" x2="12" y2="12"/></svg>
                <span>Client Dashboard</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Client Management */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Simple Client Management</h2>
              <p>
                Add clients in seconds — just their name and email. They get an invite to set up their own login. View all your clients at a glance, see who has plans assigned, who&apos;s active, and quickly jump into any client&apos;s training. Archive clients who take a break (they won&apos;t count towards your bill).
              </p>
              <ul className="fmc-feature-bullets">
                <li>One-click client invites via email</li>
                <li>At-a-glance client status overview</li>
                <li>Archive/unarchive clients freely</li>
                <li>Quick-access to each client&apos;s full history</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <span>Client Management</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 4: Structured Run Builder */}
      <section className="fmc-feature-section fmc-feature-warm">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-feature-row-reverse fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Structured Run Builder</h2>
              <p>
                Build complex interval sessions, tempo runs, and structured workouts with a visual step-by-step builder. Add warm-up, work intervals, recovery jogs, cool-down — each step with its own pace, distance, or time target. Your client sees it as a clear, easy-to-follow session breakdown.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Visual step-by-step interval builder</li>
                <li>Set pace/distance/time per interval</li>
                <li>Repeat groups for interval sets</li>
                <li>Clients see a clear session breakdown</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <span>Structured Run Builder</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 5: In-App Messaging */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-both">Coach + Client</span>
              <h2>In-App Messaging</h2>
              <p>
                Keep all your coaching communication in one place. No more digging through WhatsApp, text messages, and emails to find what you said last week. Threaded conversations per client with full history, so context is never lost.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Per-client conversation threads</li>
                <li>Full message history — never lose context</li>
                <li>Email notifications for new messages</li>
                <li>Quick-reply from email without opening the app</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
                <span>In-App Messaging</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 6: Email Notifications */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-feature-row-reverse fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-both">Coach + Client</span>
              <h2>Smart Email Notifications</h2>
              <p>
                Nobody wants to check another app. That&apos;s why First Mile Coach emails your clients when something important happens — a new plan is published, a message arrives, or feedback is ready. Coaches get notified when clients log sessions or reply. Everyone stays in the loop without extra effort.
              </p>
              <ul className="fmc-feature-bullets">
                <li>New plan published → client gets notified</li>
                <li>New message → email notification with preview</li>
                <li>Client logs a session → coach gets notified</li>
                <li>Reply directly from email</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder fmc-feature-placeholder-dark">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span>Email Notifications</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 7: Exercise Library */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Custom Exercise Library</h2>
              <p>
                Build your own library of exercises with descriptions, video links, and categories. When you add a cross-training or strength session to a plan, pull exercises directly from your library. Your clients see the exercise name, instructions, and can tap through to any video demo you&apos;ve linked.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Create and categorize your own exercises</li>
                <li>Add video links (YouTube, Vimeo, etc.)</li>
                <li>Pull from library when building workouts</li>
                <li>Clients see instructions + demo videos</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>
                <span>Exercise Library</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 8: Cross-Training Builder */}
      <section className="fmc-feature-section fmc-feature-warm">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-feature-row-reverse fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Structured Cross-Training Builder</h2>
              <p>
                Create full strength and cross-training sessions with sets, reps, rest periods, and supersets. Pull exercises from your library and organize them into circuits or straight sets. Your clients get a clear, gym-ready workout they can follow on their phone.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Sets × reps with rest periods</li>
                <li>Superset and circuit grouping</li>
                <li>Pull exercises from your custom library</li>
                <li>Clients follow along on their phone</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 6.5h11M6.5 17.5h11"/><rect x="2" y="4" width="4" height="5" rx="1"/><rect x="18" y="4" width="4" height="5" rx="1"/><rect x="2" y="15" width="4" height="5" rx="1"/><rect x="18" y="15" width="4" height="5" rx="1"/><line x1="4" y1="9" x2="4" y2="15"/><line x1="20" y1="9" x2="20" y2="15"/></svg>
                <span>Cross-Training Builder</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 9: AI-Powered Week Planning */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>AI-Powered Week Suggestions</h2>
              <p>
                Stuck on what to program next? Our AI assistant can suggest a full training week based on your client&apos;s goals, recent history, and your coaching style. You stay in control — review, tweak, and approve before anything goes to your client. Think of it as a brainstorming partner, not a replacement.
              </p>
              <ul className="fmc-feature-bullets">
                <li>AI suggests a full week based on context</li>
                <li>Takes into account recent training load</li>
                <li>You review and edit before publishing</li>
                <li>Learn your coaching patterns over time</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder fmc-feature-placeholder-dark">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 014 4c0 1.5-.8 2.8-2 3.5v1h-4v-1c-1.2-.7-2-2-2-3.5a4 4 0 014-4z"/><path d="M10 10.5v1.5h4v-1.5"/><line x1="10" y1="14" x2="14" y2="14"/><line x1="10" y1="16" x2="14" y2="16"/><path d="M10 18h4l-1 3h-2l-1-3z"/></svg>
                <span>AI Week Suggestions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 10: Client Progress & Stats */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-feature-row-reverse fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Client Progress Tracking</h2>
              <p>
                See how each client is progressing at a glance. Weekly mileage totals, session completion rates, and trend lines so you can spot when someone&apos;s falling off or crushing it. No complex analytics — just the numbers that matter when you&apos;re coaching individuals.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Weekly and monthly volume summaries</li>
                <li>Session completion tracking</li>
                <li>Simple trend indicators (up/down/steady)</li>
                <li>Quick-view stats on your coach dashboard</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
                <span>Progress Tracking</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 11: Publish & Draft System */}
      <section className="fmc-feature-section fmc-feature-warm">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Draft &amp; Publish Workflow</h2>
              <p>
                Plan weeks in advance without your clients seeing unfinished work. Build training weeks as drafts, review them when you&apos;re ready, then publish with one click. Your client gets notified only when you hit publish — so you can prep a full month on Sunday evening without flooding their inbox.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Save plans as drafts until ready</li>
                <li>Batch-prepare weeks in advance</li>
                <li>One-click publish sends notification</li>
                <li>Dashboard shows what&apos;s ready to publish</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>Draft & Publish</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 12: Client Feedback & Session Logging */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-feature-row-reverse fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-client">Client</span>
              <h2>Session Logging &amp; Feedback</h2>
              <p>
                Clients can log how each session went — what they actually did, how they felt, and any notes for you. RPE scores, actual distance/time, and free-text feedback all in one place. You see it instantly and can adjust next week&apos;s plan accordingly.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Log actual vs. planned for each session</li>
                <li>Rate effort (RPE) and energy levels</li>
                <li>Add notes and comments per workout</li>
                <li>Coach sees feedback in real-time</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder fmc-feature-placeholder-dark">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
                <span>Session Logging</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 13: Multi-Coach Platform */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Works for Any Coaching Type</h2>
              <p>
                Whether you&apos;re a running coach, personal trainer, CrossFit coach, or hybrid — First Mile Coach adapts. Running coaches get structured run builders. Personal trainers get the cross-training builder with sets and reps. You can use both. The platform doesn&apos;t force you into one mold.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Running-specific tools (intervals, tempo, long runs)</li>
                <li>Strength/PT tools (sets, reps, supersets)</li>
                <li>Mix both in the same training week</li>
                <li>Customize to match your coaching style</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                <span>Any Coaching Type</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 14: PWA / Add to Homescreen */}
      <section className="fmc-feature-section fmc-feature-warm">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-feature-row-reverse fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-both">Coach + Client</span>
              <h2>Add to Homescreen — Feels Like an App</h2>
              <p>
                No app store download needed. Both you and your clients can add First Mile Coach to your homescreen on any device. It opens full-screen, works offline for viewing plans, and feels exactly like a native app — because we built it as a Progressive Web App. This is also why we can keep prices so low (no 30% app store tax).
              </p>
              <ul className="fmc-feature-bullets">
                <li>Works on iPhone, Android, tablet, desktop</li>
                <li>Full-screen app experience from homescreen</li>
                <li>View plans offline after first load</li>
                <li>No app store fees = savings passed to you</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/><path d="M9 9l3-3 3 3"/><line x1="12" y1="6" x2="12" y2="14"/></svg>
                <span>Add to Homescreen</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 15: Data Export & No Lock-in */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-row fmc-fade-in">
            <div className="fmc-feature-text">
              <span className="fmc-feature-badge fmc-feature-badge-coach">Coach</span>
              <h2>Your Data is Yours. Always.</h2>
              <p>
                We&apos;ll never hold your data hostage. Export your entire client list, training history, plans, and notes anytime as a spreadsheet. If you outgrow us and want to move to a bigger platform — take everything with you. No lock-in, no hostage situation, no guilt trip.
              </p>
              <ul className="fmc-feature-bullets">
                <li>Full data export anytime (CSV/spreadsheet)</li>
                <li>Client data, plans, messages — all exportable</li>
                <li>No contracts, cancel anytime</li>
                <li>We celebrate when you outgrow us</li>
              </ul>
            </div>
            <div className="fmc-feature-image-wrap">
              <div className="fmc-feature-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Data Export</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="fmc-features-cta">
        <div className="fmc-container">
          <div className="fmc-features-cta-content fmc-fade-in">
            <h2>Ready to get started?</h2>
            <p>Join our beta — free until June 30, 2027. No credit card required.</p>
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
        <p className="fmc-footer-tagline">The $1/month platform for new coaches.</p>
        <p className="fmc-footer-copy">&copy; {new Date().getFullYear()} First Mile Coach. All rights reserved.</p>
      </footer>
    </div>
  )
}
