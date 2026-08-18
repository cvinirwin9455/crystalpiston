'use client'

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
          <Link href="/" className="fmc-features-nav-brand">
            First Mile Coach
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
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 2: Client Dashboard */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 3: Client Management */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 4: Structured Run Builder */}
      <section className="fmc-feature-section fmc-feature-warm">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 5: In-App Messaging */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 6: Email Notifications */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 7: Exercise Library */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 8: Cross-Training Builder */}
      <section className="fmc-feature-section fmc-feature-warm">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 9: Client Progress & Stats */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 10: Publish & Draft System */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 11: Client Feedback & Session Logging */}
      <section className="fmc-feature-section fmc-feature-warm">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 12: Multi-Coach Platform */}
      <section className="fmc-feature-section fmc-feature-dark">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
        </div>
      </section>

      {/* Feature 13: PWA / Add to Homescreen */}
      <section className="fmc-feature-section fmc-feature-light">
        <div className="fmc-container">
          <div className="fmc-feature-block fmc-fade-in">
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
