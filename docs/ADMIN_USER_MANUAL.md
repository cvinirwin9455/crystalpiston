# Crystal Pistol Performance — Admin User Manual

*Last updated: July 3, 2026*

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Client Sidebar](#client-sidebar)
4. [Training & Logs Tab](#training--logs-tab)
5. [Create Week Tab](#create-week-tab)
6. [AI Week Planner](#ai-week-planner)
7. [Structured Run Builder](#structured-run-builder)
8. [Structured Cross-Training Builder](#structured-cross-training-builder)
9. [Drafts Tab](#drafts-tab)
10. [Messages Tab](#messages-tab)
11. [Account Tab](#account-tab)
12. [Plans & Payments](#plans--payments)
13. [Templates](#templates)
14. [AI Coach Assistant](#ai-coach-assistant)
15. [Multi-Coach System](#multi-coach-system)
16. [Notification Settings](#notification-settings)
17. [Preferences (Units, Dates, Display)](#preferences)
18. [Strava Integration (Admin View)](#strava-integration)
19. [Changelog](#changelog)

---

## Getting Started

Log in at your app URL. As an admin/coach, you'll land on the admin panel. The panel has:
- A **sidebar** on the left with your client list
- A **main area** in the center with tabs for the selected client
- A **floating AI button** (purple, bottom-right corner) for the AI Coach Assistant
- A **gear menu** (top-right) for settings, templates, manage coaches, and changelog

---

## Dashboard Overview

When you first open the admin panel (no client selected), you'll see:

- **Drafts Ready to Publish** — Shows the first 3 draft weeks waiting to be published. Click "Show all" to expand.
- **Outstanding Payments** — Clients with unpaid balances. Shows first 3, expand for more.
- **Unread Messages** — Count of messages you haven't read yet across all clients.

---

## Client Sidebar

The left sidebar shows all your clients. Key features:

### Searching & Filtering
- **Search bar** at the top — type to filter clients by name
- **Filter buttons** — Active, Archived, or All clients

### Client List Indicators
- **Purple dot** — Client has recent workout comments (last 14 days)
- **Unread badge** (number) — Unread messages from this client
- **Strava profile picture** — Shows if client has Strava connected

### Creating a New Client
1. Click **"+ New Client"** button at the top of the sidebar
2. Fill in: Name, Email, Gender
3. Click **Create** — an invite email is sent to the client
4. The client shows as "Pending" until they accept and set their password

### Re-sending an Invite
If a client's invite expired, you'll see a "Resend Invite" button on their profile.

---

## Training & Logs Tab

This is where you view published training plans and client progress.

### Week Navigation
- **Arrow buttons** (< >) move between published weeks
- **"Go to current week"** arrow jumps to the current calendar week
- **"Current Week"** badge shows which week matches the current date

### What You See Per Day
Each day is **collapsible** (click the day header to expand/collapse).

- **Expand All / Collapse All** buttons at the top
- When collapsed, a summary shows: workout count, total miles for that day

### Workout Cards
Each workout shows:
- **Type badge**: Programmed (purple), Client-Added (cyan), Strava Extra (yellow/orange)
- **Status**: Green checkmark (completed), red X (skipped), yellow partial
- **Metrics** (after completion): RPE, Miles (actual in green / programmed in gray), Pace, Duration, Heart Rate (avg/max), Sleep rating
- **Strava badge** (orange) — shows if synced from Strava, with activity name
- **Skip reason** — if skipped, shows why the client gave
- **Comments thread** — coach and client conversation on that workout

### Editing a Published Week
1. Click **"Edit"** on the week header
2. You can change workout types, miles, descriptions, add/remove workouts per day
3. Click **"Save Changes"** when done
4. **Note**: You cannot edit workouts that clients have already completed

### Stats Section
At the top of the week view you'll see:
- **Programmed Workouts**: completed / total (only non-rest workouts, only counts completed+partial)
- **Client Workouts**: how many the client added themselves
- **Total Miles/KM**: sum of actual miles logged
- **Average RPE**: across all completed workouts

### Workout Comments
- Click the comment icon on any completed workout
- Type your message and send
- The client gets an email notification
- Other assigned coaches also get notified
- Comments appear as a threaded conversation at the bottom of the workout card

---

## Create Week Tab

This is where you build a new training week for a client.

### Step 1: Pick a Date
1. Click **"Select Week"** to open the calendar picker
2. Navigate months with < > arrows
3. Click any Monday to select that week (Mon–Sun)
4. **Colored dots** on the calendar show: green = published, yellow = draft
5. The system warns if a week already exists for those dates or if dates fall outside the active plan

### Step 2: Set Week Details
- **Focus** — e.g., "Speed Work", "Recovery Week", "Long Run Build"
- **Coach Message** — a personal note the client sees at the top of their week

### Step 3: Build Each Day
For each day (Monday–Sunday):
- **Type** dropdown: Run, Cross Training, Walk, Rest, Cycling, Stretching
- **Training Type** (depends on type chosen):
  - Run: Easy, Tempo, Intervals, Long Run, Recovery, Progressive, Trail, Fartlek, Strides, Hill Repeats
  - Cross: Strength, Yoga, Cycling, Swimming, Core, Other
  - Walk: Power Walk, Recovery Walk
  - Stretching: Stretching, Foam Roll, Yoga
- **Title** — custom workout name (e.g., "Track Tuesday 800s")
- **Distance** — miles or km (toggle the MI/KM button per workout)
- **Pace Target** — e.g., "9:30/mi" or "5:00/km"
- **Location** — where to do it
- **Description** — detailed instructions
- **Coach Notes** — private notes only you see (not visible to client)

### Multiple Workouts Per Day
Click **"+ Add another workout"** to add a second workout to any day (e.g., AM run + PM strength).

### Structured Builders
- For **Runs**: Click "Add Structure" to open the [Structured Run Builder](#structured-run-builder)
- For **Cross Training**: The [Structured Cross-Training Builder](#structured-cross-training-builder) appears automatically

### Using Templates
- Click **"Load Template"** (📋 icon) on any day to load a saved day template
- Click **"Load Week Template"** in the header to load an entire week
- You can also save the current week or day as a new template

### Saving
- **Save as Draft** — saves without publishing (client won't see it)
- **Publish** — client immediately sees the week and can start logging
- You can publish a draft later from the Drafts tab

---

## AI Week Planner

The AI can suggest an entire training week based on the client's history.

### How to Use
1. Go to **Create Week** tab
2. Select a date (optional, but recommended)
3. (Optional) Type **Coach Notes** for the AI — things like:
   - "Keep it easy this week, she's feeling tired"
   - "Race in 2 weeks, start tapering"
   - "Focus on speed, she's ready for it"
4. Click **"AI Suggest Week"**
5. Wait 10-20 seconds while AI analyzes the client

### What the AI Considers
- Last 6 weeks of workouts, completion rates, RPE, energy, sleep
- Strava data (actual paces, heart rate, duration)
- Training profile (experience level, current mileage, goal pace, injuries)
- Active plan (goal, target distance, race date, timeline position)
- Workout comments between you and the client
- Your coach notes (highest priority — overrides other signals)

### After AI Suggests
- The entire form fills in with the AI's suggestion
- An **"AI Reasoning"** box appears explaining why it chose this plan (only you see this)
- **You can edit anything** — it's a starting point, not final
- Change workouts, miles, descriptions, add/remove days — then Publish or Save as Draft

### AI Budget
- The purple badge shows your monthly AI spend (e.g., "$0.07 / $5.00")
- Budget resets automatically on the 1st of each month
- Hover the badge to see the month and total query count
- Badge turns yellow at 80% budget, red when exceeded

---

## Structured Run Builder

When creating a run workout, click **"Add Structure"** to get the visual interval builder.

### Components

**Warm-Up** (optional)
- Type: Distance or Time
- Value: e.g., "1" mile, "10" minutes

**Work Blocks** — Click "Add Block" to add workout segments:

| Block Type | What It Does |
|---|---|
| **Intervals / Repeats** | X reps of work + recovery (e.g., 6 x 800m with 400m jog) |
| **Tempo / Continuous** | Single continuous effort at a pace (e.g., 3 miles at threshold) |
| **Progression Run** | Multiple segments at increasing pace (e.g., 2mi easy → 2mi moderate → 1mi tempo) |
| **Strides** | Short accelerations (e.g., 6 x 100m strides) |
| **Hill Repeats** | Hill intervals with recovery (e.g., 8 x 200m hill sprint) |
| **Fartlek** | Alternating work/rest without strict recovery (e.g., 1min hard / 1min easy x 8) |

**For each block you set:**
- Reps (how many)
- Work type: Distance (miles/km/meters) or Time (min/sec/hours)
- Work value: how far or how long
- Intensity: Easy, Moderate, Marathon Pace, Threshold, Tempo, 10K Pace, 5K Pace, VO2 Max, Sprint, RPE, HR Zone, Custom
- Recovery type: Walk, Jog, Standing, Easy Run, Custom
- Recovery value: distance or time

**Cool-Down** (optional)
- Same options as warm-up

### Auto-Calculated Total
The builder automatically calculates total distance and shows it (e.g., "Total: 6.2 mi"). This auto-fills the Distance field on the workout.

### Client View
The client sees a clean text summary like:
```
Warm-up: 1 mile easy
6 x 800m at Tempo (400m jog recovery)
Cool-down: 1 mile easy
```

---

## Structured Cross-Training Builder

For cross-training days, you get a structured exercise builder instead of a free-text box.

### Adding Exercises
Click **"+ Add"** to add exercises. For each one:

| Field | Options |
|---|---|
| **Name** | Free text (e.g., "Squats", "Plank", "Lat Pulldown") |
| **Measure Type** | Reps, Time, or Distance |
| **Measure Value** | e.g., "12" reps, "45" seconds, "200" meters |
| **Weight** | Optional — number with kg/lbs toggle |
| **Sets** | Use +/- buttons to adjust (default: 3) |
| **Rest** | Time between sets in mm:ss format (e.g., "01:00") |

### Reordering
**Drag and drop** exercises to reorder them (grab the drag handle on the left).

### Client View
The client sees a formatted summary like:
```
3 sets x Squats — 12 reps @ 60kg | Rest: 01:30
3 sets x Plank — 45 seconds
3 sets x Romanian Deadlift — 10 reps @ 40kg | Rest: 01:00
```

---

## Drafts Tab

Shows all saved drafts (unpublished weeks) for the selected client.

- **First 3 shown** by default — click "Show all" to expand
- Each draft shows: date range, focus, and a summary of the workouts
- **Edit** — loads the draft back into the Create Week form for changes
- **Publish** — pushes it live to the client immediately
- **Delete** — permanently removes the draft
- Drafts are sorted by date (earliest first)

---

## Messages Tab

A simple chat between you and the client.

### Sending Messages
1. Click into the Messages tab for a client
2. Type your message in the input box
3. Click **Send**
4. The client gets an email notification (if they have notifications enabled)

### Reading Messages
- Messages show in chronological order (newest at bottom)
- Auto-scrolls to the newest message
- When multiple coaches are assigned, each message shows which coach sent it
- Unread count clears when you open the Messages tab

### Unread Indicators
- Red number badge on the Messages tab
- Number badge on the client name in the sidebar
- Total unread count shown in the admin menu
- Polls every 30 seconds for new messages

---

## Account Tab

Manages the selected client's profile, plans, and account status.

### Client Details
View/edit: Name, Email, Gender, Birthday (with auto-calculated age)

Click **"Edit"** to modify, then **"Save Changes"**.

### Plans & Payments
See the [Plans & Payments](#plans--payments) section below.

### Account Actions
- **Archive Client** — hides them from the active list (can be reactivated later)
- **Reactivate** — brings an archived client back to active
- **Delete Account** — permanently removes the client (requires confirmation)

---

## Plans & Payments

Each client can have one active plan at a time.

### Creating a Plan
1. Go to Account tab → Plans & Payments
2. Click **"+ New Plan"** (only available when no active plan exists)
3. Fill in:
   - **Goal** — what they're training for (e.g., "War Eagle 50K")
   - **Target Distance** — 5K, 10K, Half Marathon, Marathon, Ultra, or No Race
   - **Race Date** — when the target race is
   - **Start Date / End Date** — the plan duration
   - **Plan Cost ($)** — how much you're charging
   - **Goal Race Pace** — e.g., "8:45/mi"
   - **Injuries / Notes** — important health info (e.g., "History of shin splints")
4. Click **"Create Plan"**

### Recording Payments
On the active plan card:
- Current balance shows (cost vs. paid)
- Enter a payment amount and click **"Record Payment"**
- Payment history is tracked with dates

### Completing a Plan
- Click **"Mark Complete"** on the active plan
- If there's an outstanding balance, you must explain why (e.g., "Client dropped out at week 6")
- The explanation is saved for your records
- Once completed, you can create a new plan

### Week Validation
When creating weeks, the system validates that the selected week falls within the active plan dates. If it doesn't, you'll see a warning.

---

## Templates

Save and reuse workout plans.

### Accessing Templates
Click the **gear icon** (top-right) → **"Templates"**

### Week Templates
- Save an entire week as a template (all 7 days with workouts, focus, coach message)
- Load a week template when creating a new week — fills in everything
- Edit templates: change name, category, focus, coach message, and workouts
- Delete templates you no longer need
- Create new templates from scratch in the Templates view

### Day Templates
- Save a single day's workout as a template
- Load a day template into any day when building a week
- Useful for workouts you repeat often (e.g., "Easy 5" or "Track Tuesday")

### Categories
Both template types support categories (e.g., "Base Building", "Speed", "Taper") for organization.

### Saving from the Create Week Form
- While building a week, click the save icon to save the current week as a template
- Or save an individual day as a template using the day's save button

---

## AI Coach Assistant

The floating purple button in the bottom-right corner opens your AI coaching assistant.

### Opening & Using
1. Click the **purple sparkle button** (bottom-right)
2. Select a client (or "All Active Clients")
3. Choose data depth:
   - **Light** (2 weeks) — fastest, least detail
   - **Standard** (4 weeks) — balanced
   - **Deep** (all) — most detail, slower
4. Ask a question or use a quick action

### Quick Actions
Pre-built prompts available with one click:
- "How's [client name] doing this week?"
- "What should I focus on?"
- "Are there any concerns?"
- "Weekly summary for all clients"
- "Who might be struggling?"

### Custom Questions
Type anything in the "Ask anything" box:
- "Should I increase her mileage next week?"
- "Why does he keep skipping Thursdays?"
- "Compare her last 4 weeks of progress"
- "What should I message her about?"

### What the AI Knows
- All workout data (programmed, completed, skipped with reasons)
- RPE, pace, miles, duration, heart rate
- Client-added workouts
- Strava synced data
- Workout comments
- Training profile (injuries, goals, experience, paces)
- Plan details and timeline
- Your preferences (from thumbs up/down feedback)

### Thumbs Up / Down
- After every response, rate it with 👍 or 👎
- The AI learns your preferred style over time
- Thumbs-up responses are used as examples for future answers
- Thumbs-down responses are avoided in future answers

### Monthly Budget
- **$5.00/month** default budget (configurable)
- Badge shows: "$X.XX / $5.00"
- Hover to see: month name + query count
- Color coding: purple = normal, yellow = 80%+ used, red = budget exceeded
- Resets automatically on the 1st of each month
- Powered by Vercel AI Gateway footer shows the provider

---

## Multi-Coach System

Multiple coaches can be assigned to a single client.

### How It Works
- Each client has one **default coach** (shown with a gold star ⭐)
- Additional coaches can be added/removed
- All assigned coaches can view the client, create plans, send messages, and comment
- Email notifications only go to coaches assigned to that client

### Managing Coaches on a Client
1. Click the **"+"** button next to the coach badges in the client header
2. A dropdown shows all coaches in the system
3. Click a coach to assign them
4. Click **"X"** on a badge to remove a coach
5. Click the **star icon** to change who is the default coach

### Adding Coaches to the System
1. Click the **gear icon** → **"Manage Coaches"**
2. Enter the new coach's **Name** and **Email**
3. Click **"Invite Coach"** — they receive an invite email
4. Once they accept and set their password, they have full admin access

### Removing Coaches
- In Manage Coaches, click **"Remove"** next to a coach
- They lose admin access immediately
- Their existing plans, comments, and history remain
- If they were default on any clients, the next coach is auto-promoted
- You cannot remove yourself

### What Clients See
- The client sees the name of their **default coach** everywhere (not "Crystal" generically)
- Workout comments show which specific coach wrote them
- Messages show which coach sent each one

---

## Notification Settings

### Accessing
Click the **gear icon** → **"Notification Settings"**

### Email Notifications You Receive
| Event | Options |
|---|---|
| Client completes a workout | Immediate / Off |
| Client skips a workout | Immediate / Off |
| Client partially completes | Immediate / Off |
| Client sends a message | Immediate / Off |
| Daily summary | On / Off |

### Notification Email
Set which email address receives notifications (can be different from your login email).

### How It Works
- "Immediate" means you get an email within a few minutes of the event
- Notifications only fire for clients assigned to you
- When another coach comments, all other assigned coaches get notified

---

## Preferences

### Accessing
Click the **gear icon** → **"Notification Settings"** (preferences are in the same panel)

### Distance Unit
- **Miles (MI)** or **Kilometers (KM)**
- This sets the default for new workouts you create
- You can still toggle individual workouts to the other unit
- Your preference is independent of other coaches

### Weight Unit
- **Kilograms (kg)** or **Pounds (lbs)**
- Used in the Cross-Training Builder for exercise weights

### Date Format
- **MM/DD/YYYY** (June 15, 2026)
- **DD/MM/YYYY** (15 June 2026)
- Applies everywhere: plan dates, birthdays, payment dates

### Default Week View
- **Expanded** — all days open by default
- **Collapsed** — all days collapsed by default (click to expand)
- Each coach's preference is independent

---

## Strava Integration

### What You See (Admin Side)
When a client connects Strava:
- Their **Strava profile picture** shows in the header
- Strava-synced workouts show with an **orange Strava badge** and the activity name
- Metrics auto-fill: miles, pace, duration, average heart rate, max heart rate
- Orange border around Strava-connected workout cards

### How Strava Matching Works
1. Client does a workout and it syncs from their Strava
2. If it's an obvious match (same day, same type, similar distance) → **auto-matches** to the programmed workout
3. If no clear match → shows as an "Extra" workout with yellow badge
4. The client can accept/reject matches on their side

### What You Should Know
- Auto-matched workouts still need the client to add RPE and Sleep
- Strava activities with 0 miles (accidental starts) are ignored
- Activities import automatically via webhook (real-time)
- If a client disconnects/reconnects Strava, their data stays intact

---

## Changelog

### Accessing
Click the **gear icon** → **"What's New"**

### What It Shows
- A chronological list of every update to the platform
- Grouped by date
- Color-coded badges: Admin (red), Client (blue), All (green), Marketing (gold)
- Click a date to expand/collapse its items
- Most recent updates are at the top

### New Updates Badge
- A **dot indicator** appears on the gear icon when there are updates you haven't seen
- Opening the Changelog marks them as read

---

## Tips & Tricks

1. **Use templates for recurring weeks** — save a "Base Week" template and load it, then just tweak the details
2. **Coach Notes field** — use this to leave yourself reminders (clients never see it)
3. **AI Coach before messaging** — ask the AI about a client before reaching out, it might spot something you missed
4. **Thumbs up the AI** — the more feedback you give, the better the AI learns your style
5. **Keyboard shortcuts** — use Tab/Enter to quickly navigate workout forms
6. **Deep mode for struggling clients** — use "Deep (all)" data depth in the AI Coach for clients you're concerned about
7. **Draft before publish** — save as draft if you want to come back and finalize later
8. **Check outstanding payments regularly** — the dashboard shows them prominently
9. **Archive inactive clients** — keeps your sidebar clean, you can always reactivate later
10. **Comment on workouts** — clients love feedback on specific workouts, not just messages

---

## Common Workflows

### Starting a New Client
1. Click "+ New Client" → fill Name, Email, Gender → Create
2. Client receives invite email and sets password
3. Go to Account tab → Create a Plan (goal, dates, cost)
4. Go to Create Week → build their first week
5. Publish → client sees their plan!

### Weekly Planning Routine
1. Open each active client
2. Check Training & Logs for the current week — review completion, RPE, comments
3. Go to Create Week → pick next week's dates
4. (Optional) Click "AI Suggest Week" or load a template
5. Customize the plan based on how they did this week
6. Save as Draft or Publish

### When a Client Finishes Their Plan
1. Account tab → Plans & Payments → Mark Complete
2. Record final payment if needed
3. Create a new plan for the next training block
4. Continue building weeks

### Checking on All Clients at Once
1. Open the AI Coach Assistant (purple button)
2. Select "All Active Clients"
3. Ask: "Who needs attention this week?" or "Weekly summary"
4. The AI gives you a prioritized overview

---

*Questions? Issues? Contact your developer for technical support.*
