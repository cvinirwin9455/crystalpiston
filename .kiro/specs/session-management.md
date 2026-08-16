# Session Management Feature Spec

**Status:** Planned (not started)  
**Priority:** Next major feature  
**Prerequisite:** Set up staging environment (see below)  
**Date agreed:** August 16, 2026

---

## Overview

Add session management for in-person PT coaches to track client sessions, manage pre-paid session packages, and send automated reminders. This enables coaches who do in-person training (not just remote programming) to manage their business within First Mile Coach.

---

## Prerequisite: Staging Environment

Before building this feature, we MUST set up a staging environment:

1. Create a second Supabase project (free tier) as staging DB
2. Configure Vercel branch-specific env vars for `staging` branch:
   - `NEXT_PUBLIC_SUPABASE_URL` → staging URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → staging service role key
   - `RESEND_API_KEY` → empty or test key (no real emails)
3. Add staging preview URL to Supabase Auth → Redirect URLs
4. All feature work pushed to `staging` branch for testing
5. Merge `staging` → `main` only when fully tested

---

## Client Billing Modes

Each client can be set to one of:
- **Programming Only** — current behavior, pays for time period, gets training plans
- **Per-Session** — pre-pays for X sessions, balance tracked and deducted
- **Hybrid** — both programming AND tracked in-person sessions

---

## Session Packages

- Coach enters: total sessions purchased + total amount paid (flexible, can discount)
- Balance **stacks** (buy 10, use 3, buy 10 more = 17 remaining)
- Sessions do NOT expire
- **Independent** from existing programming payment tracking (separate system)
- Automated "low balance" email sent at coach-configurable threshold
- Client can see remaining balance in their account

---

## Sessions

### Fields:
- Date & time
- Duration (defaults from coach account setting, overridable per client, editable per session)
- Client assignment
- Location (optional, can have default)
- Session type/notes (e.g., "Upper Body", "Assessment")
- Link to programmed workout for that day (optional)
- Status

### Statuses:
- `scheduled` — upcoming, hasn't happened yet
- `completed` — happened, deducts from balance
- `cancelled_charged` — client cancelled, still counts against balance
- `cancelled_no_charge` — client cancelled, does NOT count against balance
- `no_show` — client didn't show, counts against balance
- `rescheduled` — moved to different date/time

### Creation:
- **One-off**: Coach clicks a day/time on calendar, picks client
- **Recurring**: Coach sets pattern (e.g., MWF @ 6am for Client X), auto-generates sessions for next N weeks, each individually editable/cancellable

---

## Coach Side UI

### Dashboard Landing Page (widget):
- New "Today's Sessions" widget alongside existing Drafts/Payments/Stats
- Shows today's + upcoming sessions in agenda format
- Quick-action buttons: Mark Complete, No-Show, Cancel (charged/no-charge)
- Dashboard is **customizable** — coach picks which widgets to show

### Global Weekly Calendar (new section):
- Weekly view with hour slots
- Shows ALL clients' sessions, color-coded by client
- Also shows programmed workouts for context (lighter styling)
- Click any time slot to create a new session
- Quick-glance view of full coaching week

### Individual Client View (new "Sessions" tab):
- Session balance: remaining / total purchased
- Purchase history (packages bought with dates/amounts)
- Session history log (date, status, deducted or not)
- Upcoming scheduled sessions list
- "Add Session" / "Add Package" buttons
- Recurring schedule setup (MWF @ 6am, etc.)

### Coach Account Settings:
- Default session duration (30/45/60/90 min)
- Low balance email threshold (configurable number, e.g., "notify at 3 remaining")
- Default session location (optional)

---

## Client Side UI

### Training Tab:
- Small "Upcoming Sessions" card near top showing next 2-3 sessions (date, time, location)
- Badge/indicator showing remaining session balance (e.g., "5 sessions remaining")

### Account Tab:
- Session balance display (X remaining)
- Package purchase history
- Full session history (completed, cancelled, no-show, etc.)

---

## Automated Emails

### 24-Hour Session Reminder:
- Sent to **client only**, 24 hours before scheduled session
- Includes: date, time, duration, location, what's planned (if workout linked)
- Footer: "Need to reschedule? Contact your coach" (with coach email)
- Respects notification preferences
- Implementation: Vercel Cron job hitting API route every hour to check for sessions within 24h window

### Low Balance Alert:
- Sent when remaining sessions ≤ coach-configured threshold
- "You have X sessions remaining. Contact your coach to purchase more."
- Triggered when a session is marked complete/charged

---

## Database Schema (Planned)

### New Tables:
- `session_packages` — id, client_id, sessions_purchased, sessions_remaining, amount_paid, purchased_at, notes
- `sessions` — id, client_id, coach_id, organization_id, scheduled_at, duration_minutes, location, session_type, notes, workout_id (FK nullable), status, marked_at, recurring_schedule_id (FK nullable)
- `recurring_schedules` — id, client_id, coach_id, days_of_week (array), time, duration_minutes, location, active, created_at

### Modified Tables:
- `clients` — add `billing_mode` ('programming_only' | 'per_session' | 'hybrid')
- `notification_preferences` — add `session_reminder` (boolean), `low_balance_threshold` (number)

---

## Build Order

1. ~~Set up staging environment~~ (PREREQUISITE — do first)
2. Database schema + API routes (foundation)
3. Coach: Individual client session management (add packages, create sessions, mark complete)
4. Coach: Dashboard widget (today's sessions, quick actions)
5. Coach: Weekly calendar view (global view of all sessions)
6. Client: Session display (upcoming + balance)
7. Recurring schedules (auto-generate from pattern)
8. Email reminders (24h + low balance via Vercel Cron)
9. Dashboard customization (coach picks which widgets to show)

---

## Other Planned Features (from this session)

### Already completed in this session:
- ✅ Drag-and-drop workout rescheduling (client side)
- ✅ New workout types: Strength, HIIT, Swimming, Stretching/Mobility
- ✅ HIIT timer configurations (EMOM, Tabata, AMRAP, Circuit, Intervals)
- ✅ All workout types toggleable per organization (including Run)
- ✅ Exercise library integration for Strength/HIIT/Stretching
- ✅ Super Admin opens in new tab

### Open issues (from learnings, not addressed this session):
- Drafts not showing on coach dashboard
- First Mile Coach mobile landing page login buttons
- Mobile UX for "New Client" and admin actions (off-screen forms)
- AI Assistant panel takes too much space (collapse into button)
- Test invite email flow (set password after invite link)
