'use client'

import Image from 'next/image'
import BetaSignupForm from './BetaSignupForm'
import FirstMileAnimations from './FirstMileAnimations'
import RegionToggle from './RegionToggle'
import Price, { PricePerMonth, PriceRange } from './Price'
import './firstmile.css'

export default function FirstMileContent() {
  return (
    <div className="fmc">
      <FirstMileAnimations />

      {/* Sticky Beta Banner */}
      <div className="fmc-beta-banner">
        <div className="fmc-beta-banner-content">
          <span className="fmc-beta-banner-badge">BETA</span>
          <span className="fmc-beta-banner-text">Now accepting the first 50 coaches — free until June 30, 2027</span>
          <a href="#beta" className="fmc-beta-banner-link">Apply Now &rarr;</a>
          <div className="fmc-banner-divider" />
          <RegionToggle />
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
            The simplest platform for new running coaches and personal trainers to manage clients — for just <strong><PricePerMonth amount={1} /> per 10 active clients</strong>. No complex features you don&apos;t need. No lock-in. Just the tools to get you started.
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
            Other platforms charge <PriceRange low={50} high={200} suffix="/month" /> before you&apos;ve even landed your first client. You shouldn&apos;t have to choose between professional tools and paying your bills. We built First Mile Coach so you can have both from day one.
          </p>
          <div className="fmc-fork-grid fmc-fade-in">
            <div className="fmc-fork-card fmc-fork-guide">
              <span className="fmc-fork-emoji">🏃</span>
              <h3>Running Coaches</h3>
              <p>You&apos;ve got your qualification or you&apos;re coaching friends and local club runners. You need a simple way to send plans, track progress, and communicate — without the overhead.</p>
            </div>
            <div className="fmc-fork-card fmc-fork-runner">
              <span className="fmc-fork-emoji">💪</span>
              <h3>Personal Trainers</h3>
              <p>You&apos;re starting out, maybe working from a park or a small gym. You need client management that doesn&apos;t eat into the little revenue you&apos;re building.</p>
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
              Handwritten calendars. Scribbled plans. Crossed-out sessions. This is how most new coaches manage their clients — because the &ldquo;proper&rdquo; tools cost more than they&apos;re earning.
            </p>
            <p className="fmc-reality-pitch">
              It doesn&apos;t have to be like this. For <PricePerMonth amount={1} /> you can look professional from day one — with digital plans, client dashboards, and everything in one place. No more flipping through notebooks to remember what you assigned last week.
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
              <li><strong>Up to 10 clients</strong> — more than enough to get started and build momentum</li>
              <li><strong>Training plan builder</strong> — create and assign weekly/monthly plans</li>
              <li><strong>Client dashboard</strong> — your clients see their plans, log sessions, leave feedback</li>
              <li><strong>In-app messaging</strong> — keep all communication in one place</li>
              <li><strong>Email notifications</strong> — clients get notified when you assign a new plan, send a message, or leave feedback. You get notified when they log a session or reply.</li>
              <li><strong>Progress tracking</strong> — see how your clients are doing at a glance</li>
              <li><strong>Session notes</strong> — record what happened, what to adjust next time</li>
            </ul>
          </div>

          <div className="fmc-no-app-section fmc-fade-in">
            <h3>No app. That&apos;s on purpose.</h3>
            <p className="fmc-no-app-explain">
              No native app means no 30% app store tax — that&apos;s a big reason we can keep this so cheap. First Mile Coach works in your browser on any device, and both you and your clients can add it to your homescreen so it looks and feels like an app.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="fmc-pricing-section" id="pricing">
        <div className="fmc-container">
          <div className="fmc-pricing-content fmc-fade-in">
            <h2>Pricing that grows with you.<br />Not ahead of you.</h2>
            <div className="fmc-price-card">
              <div className="fmc-price-amount">
                <span className="fmc-price-currency"><Price amount={1} /></span>
                <span className="fmc-price-period">/month per 10 active clients</span>
              </div>
              <p className="fmc-price-desc">All features included. Cancel anytime. No surprises.</p>
            </div>

            <div className="fmc-pricing-examples fmc-fade-in">
              <h3>Simple maths:</h3>
              <div className="fmc-pricing-table">
                <div className="fmc-pricing-row">
                  <span className="fmc-pricing-clients">1–10 active clients</span>
                  <span className="fmc-pricing-cost"><PricePerMonth amount={1} /></span>
                </div>
                <div className="fmc-pricing-row">
                  <span className="fmc-pricing-clients">11–20 active clients</span>
                  <span className="fmc-pricing-cost"><PricePerMonth amount={2} /></span>
                </div>
                <div className="fmc-pricing-row">
                  <span className="fmc-pricing-clients">21–30 active clients</span>
                  <span className="fmc-pricing-cost"><PricePerMonth amount={3} /></span>
                </div>
                <div className="fmc-pricing-row fmc-pricing-row-highlight">
                  <span className="fmc-pricing-clients">100 active clients</span>
                  <span className="fmc-pricing-cost"><PricePerMonth amount={10} /></span>
                </div>
              </div>
            </div>

            <div className="fmc-pricing-mau fmc-fade-in">
              <h3>Based on monthly active clients</h3>
              <p>
                You only pay for clients who are <strong>active that month</strong>. Had 15 clients last month but only 8 this month? Your bill drops from <Price amount={2} /> to <Price amount={1} />. Just archive clients who aren&apos;t currently training with you — they won&apos;t count towards your active total. Unarchive them anytime they come back.
              </p>
            </div>

            <p className="fmc-pricing-note">
              That&apos;s not a typo. We&apos;re not trying to make money off coaches who are just starting out. We charge <Price amount={1} /> per 10 clients to keep the lights on and the spammers out.
            </p>
            <p className="fmc-pricing-note">
              How? No native app means no 30% app store tax. No bloated feature set means low running costs. We pass those savings directly to you.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="fmc-path-section fmc-runner-path" id="philosophy">
        <div className="fmc-container">
          <div className="fmc-path-header fmc-fade-in">
            <span className="fmc-path-label fmc-runner-label">Our Philosophy</span>
            <h2>We want to help you take off.<br />Not hold you back.</h2>
            <p>Here&apos;s the honest truth: other platforms might have more features for bigger operations. But if you want to stay with us as you grow, you can — and it&apos;ll only ever cost <Price amount={1} /> per 10 active clients. We&apos;re your first mile, but we&apos;re happy to be your hundredth too.</p>
          </div>

          <div className="fmc-path-how fmc-fade-in">
            <h3>Here&apos;s how we think about it:</h3>
            <div className="fmc-path-steps">
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-runner-num">✓</div>
                <div>
                  <strong>Other platforms have incredible analytics and features — and we get it</strong>
                  <p>TrainHeroic, TrueCoach, My PT Hub — they offer detailed performance analytics, automated programming, client retention tools, and more. Those features are genuinely valuable. We totally understand when you&apos;re ready and able to pay for them — that means your business is working.</p>
                </div>
              </div>
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-runner-num">✓</div>
                <div>
                  <strong>Your data is yours. Always.</strong>
                  <p>We&apos;ll never hold your data hostage. Export your clients, plans, and notes anytime as a spreadsheet. No lock-in, no hostage situation — if you want to leave, take everything with you.</p>
                </div>
              </div>
              <div className="fmc-path-step">
                <div className="fmc-path-step-num fmc-runner-num">✓</div>
                <div>
                  <strong>If you find our platform enough, that&apos;s cool</strong>
                  <p>Stay with us as long as you want. It&apos;s just <Price amount={1} /> per 10 active clients per month — so even at 100 clients you&apos;re paying <PricePerMonth amount={10} />. No obligation to leave, ever. And if you have a quiet month, your bill goes down automatically.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="fmc-path-quote fmc-fade-in">
            <blockquote>
              <p>&ldquo;We&apos;re not building a platform to compete with the big guys. We&apos;re building the platform that gets you to them — or lets you stay and grow with us for pennies.&rdquo;</p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="fmc-why-section">
        <div className="fmc-container">
          <div className="fmc-why-content fmc-fade-in">
            <h2>Why we&apos;re building this</h2>
            <p>We&apos;ve seen too many new coaches stuck in a catch-22: you need clients to afford tools, but you need tools to manage clients professionally. The big platforms price you out before you&apos;ve earned a penny.</p>
            <p>First Mile Coach exists because every coach deserves a professional setup from day one — even if they only have 2 clients and zero revenue. Especially then.</p>
            <p className="fmc-why-bold">Your first mile matters most.</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="fmc-stats">
        <div className="fmc-container">
          <div className="fmc-stats-grid fmc-fade-in">
            <div className="fmc-stat">
              <div className="fmc-stat-number"><Price amount={1} /></div>
              <div className="fmc-stat-label">Per 10 active clients/month</div>
            </div>
            <div className="fmc-stat">
              <div className="fmc-stat-number"><Price amount={10} /></div>
              <div className="fmc-stat-label">For 100 clients. Seriously.</div>
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
            <h2>Join the Beta — Free Until June 30, 2027</h2>
            <p className="fmc-beta-intro">
              We&apos;re opening First Mile Coach to the <strong>first 50 coaches</strong> who sign up. Get full access to the platform — completely free, unlimited clients — and help shape what it becomes.
            </p>
          </div>

          <div className="fmc-beta-terms fmc-fade-in">
            <h3>What you&apos;re signing up for:</h3>
            <ul className="fmc-beta-terms-list">
              <li><strong>Limited to the first 50 coaches.</strong> Once 50 spots are filled, signups close. If you&apos;re in, you&apos;re in for the full beta period.</li>
              <li><strong>Free until June 30, 2027 — unlimited clients.</strong> The beta has a fixed end date. No matter when you join, beta access ends June 30, 2027. You pay nothing during this time.</li>
              <li><strong>After beta: earn 30 free clients/month for life.</strong> To qualify, you must: sign up at least 10 clients, remain active for at least 3 months, and provide at least 3 feedback responses on how to improve the platform.</li>
              <li><strong>Don&apos;t qualify? Standard pricing applies.</strong> If you don&apos;t meet the criteria above, you&apos;ll move to our standard pricing (<PricePerMonth amount={1} /> per 10 active clients) when the beta ends. We&apos;ll email you before the transition.</li>
              <li><strong>This is beta software.</strong> Nothing is guaranteed in terms of data persistence or usability. Features may change, be removed, or break. There are no uptime or SLA guarantees.</li>
              <li><strong>You must provide feedback.</strong> We&apos;ll ask for your input regularly. Your honest feedback directly shapes what gets built.</li>
              <li><strong>Submit any client feedback you receive.</strong> Your clients are not required to give feedback, but if they share thoughts on their experience with you, you agree to pass that along to us.</li>
              <li><strong>Features may change without notice.</strong> We&apos;re iterating fast. Things will move, look different, or work differently week to week.</li>
              <li><strong>No public reviews during beta.</strong> Please don&apos;t publicly review or rate the platform until official launch.</li>
              <li><strong>Either party can leave at any time.</strong> No lock-in. If it&apos;s not working for you, you can walk away. We reserve the same right.</li>
            </ul>
          </div>

          <BetaSignupForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="fmc-footer">
        <div className="fmc-container">
          <div className="fmc-footer-brand">
            <Image src="/firstmile/logo.png" alt="First Mile Coach" width={120} height={50} className="fmc-footer-logo" />
          </div>
          <p className="fmc-footer-tagline">The cheapest, simplest way to start coaching. <PricePerMonth amount={1} /> per 10 active clients.</p>
          <p className="fmc-footer-copy">&copy; 2026 First Mile Coach</p>
        </div>
      </footer>
    </div>
  )
}
