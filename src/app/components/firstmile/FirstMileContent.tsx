'use client'

import Image from 'next/image'
import Link from 'next/link'
import BetaSignupForm from './BetaSignupForm'
import FirstMileAnimations from './FirstMileAnimations'
import './firstmile.css'

export default function FirstMileContent() {
  return (
    <div className="fmc">
      <FirstMileAnimations />

      {/* Sticky Nav Banner */}
      <div className="fmc-beta-banner">
        <div className="fmc-beta-banner-content">
          <span className="fmc-beta-banner-badge">BETA</span>
          <span className="fmc-beta-banner-text">Now accepting beta coaches — completely free</span>
          <Link href="/faq" className="fmc-features-nav-link">FAQ</Link>
          <a href="#beta" className="fmc-beta-banner-link">Sign Up for Beta &rarr;</a>
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

      {/* Hero */}
      <section className="fmc-hero">
        <div className="fmc-hero-bg" />
        <div className="fmc-hero-content">
          <Image
            src="/firstmile/logo.png"
            alt="First Mile Coach"
            width={280}
            height={280}
            className="fmc-hero-logo"
            priority
          />
          <h1>Your first clients<br />shouldn&apos;t cost a fortune<br />to manage.</h1>
          <p className="fmc-hero-subhead">
            A simple, free platform for new coaches and personal trainers who are just getting started — or coaching on the side. No complex features you don&apos;t need. No lock-in. Just the tools to get you going.
          </p>
        </div>
        <div className="fmc-scroll-indicator">
          <span />
        </div>
      </section>

      {/* The Problem */}
      <section className="fmc-the-fork">
        <div className="fmc-container">
          <h2 className="fmc-fade-in">Starting out as a coach is expensive enough.</h2>
          <p className="fmc-fork-sub fmc-fade-in">
            Platforms like TrueCoach, TrainHeroic, and My PT Hub are great — but they charge $50–$200+/month. That&apos;s a lot when you&apos;ve only got a handful of clients and you&apos;re doing this on top of a full-time job. You shouldn&apos;t have to choose between professional tools and paying your bills.
          </p>
          <div className="fmc-fork-grid fmc-fade-in">
            <div className="fmc-fork-card fmc-fork-guide">
              <span className="fmc-fork-emoji">🏃</span>
              <h3>Running Coaches</h3>
              <p>You&apos;ve got your qualification or you&apos;re coaching friends and local club runners. You need a simple way to send plans, track progress, and communicate — without the overhead of platforms built for full-time operations.</p>
            </div>
            <div className="fmc-fork-card fmc-fork-runner">
              <span className="fmc-fork-emoji">💪</span>
              <h3>Personal Trainers</h3>
              <p>You&apos;re starting out, maybe working from a park or a small gym. You&apos;ve got a few clients and you&apos;re not ready to spend money on software that&apos;s designed for coaches with 50+ athletes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Reality */}
      <section className="fmc-reality-section">
        <div className="fmc-container">
          <div className="fmc-reality-content fmc-fade-in">
            <h2>Look familiar?</h2>
            <div className="fmc-reality-image">
              <Image
                src="/firstmile/image.png"
                alt="A handwritten calendar showing a coach's training plans for clients"
                width={600}
                height={400}
                className="fmc-reality-img"
              />
            </div>
            <p className="fmc-reality-caption">
              Handwritten calendars. Scribbled plans. Crossed-out sessions. This is how most new coaches manage their clients — because the &ldquo;proper&rdquo; tools are built and priced for bigger operations.
            </p>
            <p className="fmc-reality-pitch">
              It doesn&apos;t have to be like this. First Mile Coach gives you a professional setup from day one — digital plans, client dashboards, and everything in one place. And right now, it&apos;s completely free.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="fmc-path-section fmc-guide-path" id="how-it-works">
        <div className="fmc-container">
          <div className="fmc-path-header fmc-fade-in">
            <span className="fmc-path-label fmc-guide-label">How It Works</span>
            <h2>Dead simple. That&apos;s the point.</h2>
            <p>We stripped out everything you don&apos;t need when you&apos;re starting out. No marketing funnels, no payment processing, no 47-feature dashboard. Just the essentials to manage your first clients professionally.</p>
          </div>

          <div className="fmc-path-how fmc-fade-in">
            <h3>Get up and running in minutes:</h3>
            <div className="fmc-path-steps">
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-guide-num">1</div>
                <div>
                  <strong>Sign up &amp; set up your profile</strong>
                  <p>Create your coach profile in under 2 minutes. Add your name, your sport, and a quick bio. That&apos;s it.</p>
                </div>
              </div>
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-guide-num">2</div>
                <div>
                  <strong>Invite your clients</strong>
                  <p>Send a simple invite link. Your clients get their own login to see plans, log sessions, and message you.</p>
                </div>
              </div>
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-guide-num">3</div>
                <div>
                  <strong>Build &amp; assign training plans</strong>
                  <p>Create weekly plans, assign them to clients, and track their progress. Simple drag-and-drop interface, no learning curve.</p>
                </div>
              </div>
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-guide-num">4</div>
                <div>
                  <strong>Communicate &amp; adapt</strong>
                  <p>Built-in messaging, session notes, and progress tracking. Everything in one place so nothing falls through the cracks.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="fmc-path-details fmc-fade-in">
            <h3>What&apos;s included:</h3>
            <ul className="fmc-check-list">
              <li><strong>Unlimited clients</strong> — no caps, no tiers, no paywalls</li>
              <li><strong>Training plan builder</strong> — create and assign weekly/monthly plans</li>
              <li><strong>Client dashboard</strong> — your clients see their plans, log sessions, leave feedback</li>
              <li><strong>In-app messaging</strong> — keep all communication in one place</li>
              <li><strong>Email notifications</strong> — clients get notified when you assign a new plan, send a message, or leave feedback. You get notified when they log a session or reply.</li>
              <li><strong>Progress tracking</strong> — see how your clients are doing at a glance</li>
              <li><strong>Session notes</strong> — record what happened, what to adjust next time</li>
            </ul>
          </div>

          <div className="fmc-no-app-section fmc-fade-in">
            <h3>No app store download needed.</h3>
            <p className="fmc-no-app-explain">
              First Mile Coach works in your browser on any device. Both you and your clients can add it to your homescreen so it looks and feels like an app — no download required.
            </p>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="fmc-features-showcase" id="features">
        <div className="fmc-container">
          <div className="fmc-features-showcase-header fmc-fade-in">
            <span className="fmc-features-showcase-badge">FEATURES</span>
            <h2>See what&apos;s inside the platform</h2>
            <p className="fmc-features-showcase-sub">
              Everything you need to manage clients professionally — built for simplicity, designed for coaches who are just getting started.
            </p>
          </div>

          <div className="fmc-features-showcase-grid fmc-fade-in">
            <div className="fmc-features-showcase-card">
              <div className="fmc-features-showcase-icon">📅</div>
              <h3>Weekly Plan Builder</h3>
              <p>Drag-and-drop training plans with pace, distance, and coaching notes.</p>
            </div>

            <div className="fmc-features-showcase-card">
              <div className="fmc-features-showcase-icon">📱</div>
              <h3>Client Dashboard</h3>
              <p>Mobile-first view for your clients — today&apos;s workout, weekly plan, progress.</p>
            </div>

            <div className="fmc-features-showcase-card">
              <div className="fmc-features-showcase-icon">💬</div>
              <h3>In-App Messaging</h3>
              <p>Threaded conversations with email notifications. No more WhatsApp chaos.</p>
            </div>

            <div className="fmc-features-showcase-card">
              <div className="fmc-features-showcase-icon">⚡</div>
              <h3>Structured Workouts</h3>
              <p>Visual interval, tempo, and strength session builders with video links.</p>
            </div>

            <div className="fmc-features-showcase-card">
              <div className="fmc-features-showcase-icon">📝</div>
              <h3>Draft &amp; Publish</h3>
              <p>Prep plans in advance, publish with one click when you&apos;re ready.</p>
            </div>

            <div className="fmc-features-showcase-card">
              <div className="fmc-features-showcase-icon">📊</div>
              <h3>Progress Tracking</h3>
              <p>Volume charts, completion rates, and trend indicators at a glance.</p>
            </div>
          </div>

          <div className="fmc-features-showcase-cta fmc-fade-in">
            <Link href="/faq" className="fmc-features-showcase-btn">
              Frequently Asked Questions &rarr;
            </Link>
            <p className="fmc-features-showcase-more">Find answers to common questions about the platform</p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="fmc-path-section fmc-runner-path" id="philosophy">
        <div className="fmc-container">
          <div className="fmc-path-header fmc-fade-in">
            <span className="fmc-path-label fmc-runner-label">Our Philosophy</span>
            <h2>We&apos;re not trying to compete<br />with the big platforms.</h2>
            <p>Platforms like TrueCoach and TrainHeroic are excellent. They have advanced analytics, automated programming, retention tools, marketplace features, and more. If you&apos;re a full-time coach with a big client roster and the revenue to match — those platforms are worth every penny.</p>
          </div>

          <div className="fmc-path-how fmc-fade-in">
            <h3>Here&apos;s how we see it:</h3>
            <div className="fmc-path-steps">
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-runner-num">✓</div>
                <div>
                  <strong>We&apos;re the introduction — not the destination</strong>
                  <p>First Mile Coach is built for coaches who are just starting out, coaching on the side, or have a handful of clients. We don&apos;t have all the features those premium platforms have — and that&apos;s by design. We give you what you need right now, without the complexity or cost you can&apos;t justify yet.</p>
                </div>
              </div>
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-runner-num">✓</div>
                <div>
                  <strong>When you outgrow us, we&apos;ll be happy for you</strong>
                  <p>If you grow to the point where you need advanced analytics, payment processing, and enterprise features — amazing. That means your coaching business is working. We&apos;ll help you export your data and move on to whichever platform fits your new needs. No hard feelings. That&apos;s literally what we&apos;re here for.</p>
                </div>
              </div>
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-runner-num">✓</div>
                <div>
                  <strong>Your data is yours. Always.</strong>
                  <p>We&apos;ll never hold your data hostage. Export your clients, plans, and notes anytime. No lock-in, no hostage situation — if you want to leave, take everything with you.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="fmc-path-quote fmc-fade-in">
            <blockquote>
              <p>&ldquo;We&apos;re not building a platform to compete with the big guys. We&apos;re building the platform that gets you to them — or stays with you for as long as you need.&rdquo;</p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="fmc-why-section">
        <div className="fmc-container">
          <div className="fmc-why-content fmc-fade-in">
            <h2>Why we&apos;re building this</h2>
            <p>We&apos;ve seen too many new coaches stuck in a catch-22: you need clients to afford tools, but you need tools to manage clients professionally. The big platforms are priced for established businesses — not for someone with 3 clients and a dream.</p>
            <p>First Mile Coach exists because every coach deserves a professional setup from day one — even if they only have 2 clients and zero revenue. Especially then.</p>
            <p className="fmc-why-bold">Your first mile matters most.</p>
          </div>
        </div>
      </section>

      {/* About Us */}
      <section className="fmc-about-section" id="about">
        <div className="fmc-container">
          <div className="fmc-about-header fmc-fade-in">
            <span className="fmc-about-label">Who We Are</span>
            <h2>Built by a brother for his sister.<br />Now built for you.</h2>
            <p className="fmc-about-intro">
              First Mile Coach isn&apos;t a faceless startup backed by venture capital. It&apos;s a family project — built by two people who saw a problem and decided to fix it.
            </p>
          </div>

          <div className="fmc-about-grid fmc-fade-in">
            {/* Crystal */}
            <div className="fmc-about-card">
              <div className="fmc-about-photo">
                <Image
                  src="/IMG_0995.JPG"
                  alt="Crystal Irwin — Running Coach"
                  width={200}
                  height={200}
                  className="fmc-about-img"
                />
              </div>
              <h3>Crystal Irwin</h3>
              <p className="fmc-about-role">Running Coach &amp; Co-Founder</p>
              <p className="fmc-about-location">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Springfield, Missouri, USA
              </p>
              <p className="fmc-about-bio">
                Crystal is a running coach with a diverse athletic background spanning CrossFit (L1 certified), boxing, kickboxing coaching, and running roads and trails — from 5K to ultramarathons. She coaches runners of all levels on top of her full-time job because she genuinely loves helping people set goals and crush them.
              </p>
              <p className="fmc-about-bio">
                Crystal is the reason First Mile Coach exists. She needed a simple way to manage her growing client list without paying for platforms designed for massive coaching operations.
              </p>
              <a href="https://www.crystalpistolperformance.com" target="_blank" rel="noopener noreferrer" className="fmc-about-link">
                Visit Crystal&apos;s coaching site &rarr;
              </a>
            </div>

            {/* Curtis */}
            <div className="fmc-about-card">
              <div className="fmc-about-photo">
                <Image
                  src="/IMG_8868.jpeg"
                  alt="Curtis Irwin — Platform Builder"
                  width={200}
                  height={200}
                  className="fmc-about-img"
                />
              </div>
              <h3>Curtis Irwin</h3>
              <p className="fmc-about-role">Builder &amp; Co-Founder</p>
              <p className="fmc-about-location">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                London, England, United Kingdom
              </p>
              <p className="fmc-about-bio">
                Curtis is an L&amp;D leader at Amazon, where he helps transform how thousands of people learn and develop. He built First Mile Coach for his sister Crystal when he saw her juggling notebooks, spreadsheets, and WhatsApp messages to manage her coaching clients.
              </p>
              <p className="fmc-about-bio">
                What started as a side project to make Crystal&apos;s life easier quickly became something bigger — a platform built specifically for coaches who are just getting started and shouldn&apos;t have to pay a fortune for basic client management.
              </p>
              <a href="https://curtisirwin.com" target="_blank" rel="noopener noreferrer" className="fmc-about-link">
                Learn more about Curtis &rarr;
              </a>
            </div>
          </div>

          <div className="fmc-about-story fmc-fade-in">
            <h3>The story behind First Mile Coach</h3>
            <p>
              Crystal lives in Missouri. Curtis lives in London. They&apos;re brother and sister separated by 4,000 miles — but connected by a shared frustration.
            </p>
            <p>
              Crystal had been coaching runners for years, managing everything through handwritten plans and scattered messages. The &ldquo;professional&rdquo; platforms cost $50–$200/month — way more than made sense when you&apos;re coaching a handful of people on top of a full-time job. Curtis saw the problem and thought: <em>&ldquo;I can build something better than a notebook for way less than $50 a month.&rdquo;</em>
            </p>
            <p>
              So he did. And once Crystal started using it, they realised this wasn&apos;t just her problem — it was every new coach&apos;s problem. That&apos;s how First Mile Coach was born.
            </p>
            <p className="fmc-about-tagline">
              Real people. Real problem. Real solution.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="fmc-stats">
        <div className="fmc-container">
          <div className="fmc-stats-grid fmc-fade-in">
            <div className="fmc-stat">
              <div className="fmc-stat-number">Free</div>
              <div className="fmc-stat-label">During the beta period</div>
            </div>
            <div className="fmc-stat">
              <div className="fmc-stat-number">∞</div>
              <div className="fmc-stat-label">Unlimited clients. No caps.</div>
            </div>
            <div className="fmc-stat">
              <div className="fmc-stat-number">0</div>
              <div className="fmc-stat-label">Lock-in. Leave anytime.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Signup */}
      <section className="fmc-beta-signup" id="beta">
        <div className="fmc-container">
          <div className="fmc-beta-header fmc-fade-in">
            <span className="fmc-beta-badge">Beta Program</span>
            <h2>Sign Up for Beta — It&apos;s Free</h2>
            <p className="fmc-beta-intro">
              We&apos;re looking for coaches to help us build this platform. Sign up, use it with your real clients, and tell us what works and what doesn&apos;t. Your feedback directly shapes what gets built next.
            </p>
          </div>

          <div className="fmc-beta-what-is fmc-fade-in">
            <h3>What&apos;s a &ldquo;beta user&rdquo;?</h3>
            <p>
              It just means you&apos;re getting early access to the platform while we&apos;re still building it. The app is fully functional — you can use it with real clients right now — but we&apos;re still adding features and improving things based on your feedback. In return for helping us test and improve, you get full access for free. Think of it as: you help us build the best tool possible, and you get to use it at no cost while we figure things out together.
            </p>
          </div>

          <div className="fmc-beta-terms fmc-fade-in">
            <h3>What you&apos;re signing up for:</h3>
            <ul className="fmc-beta-terms-list">
              <li><strong>Completely free.</strong> No credit card. No hidden fees. No surprise charges. Ever during beta.</li>
              <li><strong>Unlimited clients.</strong> Add as many clients as you want — no artificial limits.</li>
              <li><strong>This is beta software.</strong> The platform works and is safe to use with real clients, but features may change, move around, or occasionally have rough edges. That&apos;s normal — we&apos;re building in the open.</li>
              <li><strong>Your feedback matters.</strong> We&apos;ll ask for your input regularly. What&apos;s working? What&apos;s confusing? What&apos;s missing? Your honest answers directly shape what we build next.</li>
              <li><strong>Pass along client feedback too.</strong> If your clients share thoughts on their experience, pass that along to us. Their perspective is just as valuable.</li>
              <li><strong>Your data is safe.</strong> Everything you build — clients, plans, messages — carries forward. There&apos;s no wipe when beta ends.</li>
              <li><strong>No lock-in.</strong> If it&apos;s not working for you, leave anytime. Export your data and take everything with you.</li>
              <li><strong>No public reviews during beta.</strong> We&apos;d appreciate if you held off on public reviews until we&apos;re officially launched — we want the first impression to be the finished product.</li>
            </ul>
          </div>

          <BetaSignupForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="fmc-footer">
        <div className="fmc-container">
          <p className="fmc-footer-brand-text">First Mile Coach</p>
          <p className="fmc-footer-tagline">The free platform for coaches who are just getting started.</p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#9e9e9e' }}>
            <a href="mailto:hello@firstmilecoach.com" style={{ color: '#9e9e9e', textDecoration: 'none' }}>hello@firstmilecoach.com</a>
          </p>
          <p className="fmc-footer-copy">&copy; 2026 First Mile Coach</p>
        </div>
      </footer>
    </div>
  )
}
