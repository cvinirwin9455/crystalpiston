"use client";

import { useState } from "react";

const sections = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: `Log in at your app URL. As an admin/coach, you'll land on the admin panel. The panel has:
- A sidebar on the left with your client list
- A main area in the center with tabs for the selected client
- A floating AI button (purple, bottom-right) for the AI Coach Assistant
- A gear menu (bottom of sidebar) for settings, templates, manage coaches, and changelog`,
  },
  {
    id: "dashboard",
    title: "Dashboard Overview",
    content: `When no client is selected, you'll see:

**Drafts Ready to Publish** — Draft weeks waiting to be published. Click "Show all" to expand.

**Outstanding Payments** — Clients with unpaid balances.

**Unread Messages** — Count of messages you haven't read yet across all clients.`,
  },
  {
    id: "client-sidebar",
    title: "Client Sidebar",
    content: `The left sidebar shows all your clients.

**Searching & Filtering**
- Search bar at the top — type to filter clients by name
- Filter buttons — Active, Archived, or All clients

**Indicators**
- Purple dot — Client has recent workout comments (last 14 days)
- Number badge — Unread messages from this client
- Strava profile picture — Shows if client has Strava connected

**Creating a New Client**
1. Click "+ New Client" at the top of the sidebar
2. Fill in: Name, Email, Gender, Birthday
3. Click Create — an invite email is sent to the client
4. The client shows as "Pending" until they accept and set their password

**Re-sending an Invite**
If a client's invite expired, you'll see a "Resend Invite" button on their profile.`,
  },
  {
    id: "training-logs",
    title: "Training & Logs Tab",
    content: `This is where you view published training plans and client progress.

**Week Navigation**
- Arrow buttons (< >) move between published weeks
- "Go to current week" jumps to the current calendar week
- "Current Week" badge shows which week matches today

**What You See Per Day**
Each day is collapsible (click the day header to expand/collapse).
- Expand All / Collapse All buttons at the top
- When collapsed, shows: workout count + total miles

**Workout Cards**
- Type badge: Programmed (purple), Client-Added (cyan), Strava Extra (yellow)
- Status: Green checkmark (completed), red X (skipped), yellow partial
- Metrics: RPE, Miles (actual/programmed), Pace, Duration, HR, Sleep
- Strava badge (orange) — shows if synced from Strava
- Skip reason — why the client skipped
- Comments thread — coach/client conversation on that workout

**Editing a Published Week**
1. Click "Edit" on the week header
2. Change workout types, miles, descriptions, add/remove workouts
3. Click "Save Changes"
4. Note: You cannot edit workouts clients have already completed

**Stats Section**
- Programmed Workouts: completed / total
- Client Workouts: how many they added themselves
- Total Miles/KM
- Average RPE

**Workout Comments**
- Click the comment icon on any completed workout
- Type your message and send
- Client gets an email notification
- Other assigned coaches also get notified`,
  },
  {
    id: "create-week",
    title: "Create Week Tab",
    content: `This is where you build a new training week.

**Step 1: Pick a Date**
1. Click "Select Week" to open the calendar picker
2. Navigate months with < > arrows
3. Click any Monday to select that week (Mon-Sun)
4. Colored dots: green = published, yellow = draft
5. System warns if week already exists or is outside plan dates

**Step 2: Set Week Details**
- Focus — e.g., "Speed Work", "Recovery Week"
- Coach Message — personal note the client sees at top of their week

**Step 3: Build Each Day**
For each day (Monday-Sunday):
- Type: Run, Cross Training, Walk, Rest, Cycling, Stretching
- Training Type (depends on type):
  - Run: Easy, Tempo, Intervals, Long Run, Recovery, Progressive, Trail, Fartlek, Strides, Hill Repeats
  - Cross: Strength, Yoga, Cycling, Swimming, Core, Other
  - Walk: Power Walk, Recovery Walk
  - Stretching: Stretching, Foam Roll, Yoga
- Title — custom name (e.g., "Track Tuesday 800s")
- Distance — miles or km (toggle MI/KM per workout)
- Pace Target — e.g., "9:30/mi"
- Location
- Description — detailed instructions
- Coach Notes — private (client never sees this)

**Multiple Workouts Per Day**
Click "+ Add another workout" for a second workout (e.g., AM run + PM strength)

**Using Templates**
- Load Template icon on any day to load a saved day template
- Load Week Template in the header to load an entire week
- Save current week or day as a new template

**Saving**
- Save as Draft — saves without publishing (client won't see it)
- Publish — client immediately sees the week`,
  },
  {
    id: "ai-planner",
    title: "AI Week Planner",
    content: `The AI can suggest an entire training week based on client history.

**How to Use**
1. Go to Create Week tab
2. Select a date (optional, but recommended)
3. (Optional) Type Coach Notes for the AI, like:
   - "Keep it easy this week, she's feeling tired"
   - "Race in 2 weeks, start tapering"
   - "Focus on speed, she's ready for it"
4. Click "AI Suggest Week"
5. Wait 10-20 seconds

**What the AI Considers**
- Last 6 weeks of workouts, completion rates, RPE, energy, sleep
- Strava data (paces, heart rate, duration)
- Training profile (experience, mileage, goal pace, injuries)
- Active plan (goal, target distance, race date, timeline)
- Workout comments between you and the client
- Your coach notes (highest priority)

**After AI Suggests**
- The entire form fills in with the AI's suggestion
- "AI Reasoning" box shows why (only you see this)
- You can edit anything — it's a starting point
- Then Publish or Save as Draft

**Budget**
- Purple badge shows monthly spend (e.g., "$0.07 / $5.00")
- Resets automatically on the 1st of each month
- Hover badge to see month + query count
- Yellow at 80%, red when exceeded`,
  },
  {
    id: "structured-run",
    title: "Structured Run Builder",
    content: `For run workouts, click "Add Structure" to get the visual interval builder.

**Warm-Up** (optional)
- Distance or Time (e.g., "1 mile easy" or "10 minutes easy")

**Work Blocks** — Click "Add Block":
- Intervals / Repeats — X reps of work + recovery (e.g., 6 x 800m with 400m jog)
- Tempo / Continuous — Single effort at pace (e.g., 3 miles at threshold)
- Progression Run — Multiple segments at increasing pace
- Strides — Short accelerations (e.g., 6 x 100m)
- Hill Repeats — Hill intervals with recovery
- Fartlek — Alternating work/rest without strict recovery

**For each block:**
- Reps (how many)
- Work: Distance (miles/km/meters) or Time
- Intensity: Easy, Moderate, Marathon Pace, Threshold, Tempo, 10K Pace, 5K Pace, VO2 Max, Sprint, Custom
- Recovery type: Walk, Jog, Standing, Easy Run, Custom
- Recovery value: distance or time

**Cool-Down** (optional)

**Auto-Calculated Total**
The builder calculates total distance and fills the Distance field automatically.

**Client sees a clean summary like:**
Warm-up: 1 mile easy
6 x 800m at Tempo (400m jog recovery)
Cool-down: 1 mile easy`,
  },
  {
    id: "cross-training",
    title: "Structured Cross-Training Builder",
    content: `For cross-training days, you get a structured exercise builder.

**Adding Exercises**
Click "+ Add" to add exercises. For each one:
- Name — free text (e.g., "Squats", "Plank")
- Measure Type — Reps, Time, or Distance
- Measure Value — e.g., "12" reps, "45" seconds
- Weight — optional, with kg/lbs toggle
- Sets — use +/- buttons (default: 3)
- Rest — time between sets (mm:ss format)

**Reordering**
Drag and drop exercises to reorder (grab the handle on the left).

**Client sees:**
3 sets x Squats — 12 reps @ 60kg | Rest: 01:30
3 sets x Plank — 45 seconds
3 sets x Romanian Deadlift — 10 reps @ 40kg | Rest: 01:00`,
  },
  {
    id: "drafts",
    title: "Drafts Tab",
    content: `Shows all saved drafts (unpublished weeks) for the selected client.

- First 3 shown by default — click "Show all" to expand
- Each draft shows: date range, focus, workout summary
- Edit — loads the draft back into the Create Week form
- Publish — pushes it live immediately
- Delete — permanently removes the draft
- Sorted by date (earliest first)`,
  },
  {
    id: "messages",
    title: "Messages Tab",
    content: `A simple chat between you and the client.

**Sending Messages**
1. Click into the Messages tab
2. Type your message
3. Click Send
4. Client gets an email notification

**Reading Messages**
- Chronological order (newest at bottom)
- Auto-scrolls to newest
- With multiple coaches, shows which coach sent each message
- Unread count clears when you open Messages tab

**Unread Indicators**
- Red badge on Messages tab
- Number badge on client in sidebar
- Total unread in admin menu
- Polls every 30 seconds for new messages`,
  },
  {
    id: "account-tab",
    title: "Account Tab",
    content: `Manages the selected client's profile, plans, and status.

**Client Details**
View/edit: Name, Email, Gender, Birthday (auto-calculates age)
Click "Edit" to modify, then "Save Changes"

**Account Actions**
- Archive Client — hides from active list (can reactivate later)
- Reactivate — brings an archived client back
- Delete Account — permanently removes (requires confirmation)`,
  },
  {
    id: "plans-payments",
    title: "Plans & Payments",
    content: `Each client can have one active plan at a time.

**Creating a Plan**
1. Account tab > Plans & Payments > "+ New Plan"
2. Fill in:
   - Goal — what they're training for (e.g., "War Eagle 50K")
   - Target Distance — 5K, 10K, Half, Marathon, Ultra, or No Race
   - Race Date
   - Start Date / End Date
   - Plan Cost ($)
   - Goal Race Pace (e.g., "8:45/mi")
   - Injuries / Notes
3. Click "Create Plan"

**Recording Payments**
- On the active plan card, enter amount and click "Record Payment"
- Payment history is tracked with dates

**Completing a Plan**
- Click "Mark Complete" on the active plan
- If there's an outstanding balance, explain why
- Once completed, you can create a new plan

**Week Validation**
When creating weeks, the system validates dates fall within the active plan.`,
  },
  {
    id: "templates",
    title: "Templates",
    content: `Save and reuse workout plans.

**Accessing** — Gear menu > "Templates"

**Week Templates**
- Save entire weeks (7 days + focus + coach message)
- Load when creating a new week
- Edit: change name, category, workouts
- Delete or create new from scratch

**Day Templates**
- Save a single day's workout
- Load into any day when building a week
- Great for recurring workouts (e.g., "Easy 5", "Track Tuesday")

**Categories**
Both types support categories (e.g., "Base Building", "Speed", "Taper")

**Saving from Create Week**
- Save icon on the week header saves current week as template
- Save icon per day saves that day as template`,
  },
  {
    id: "ai-coach",
    title: "AI Coach Assistant",
    content: `The floating purple button (bottom-right) opens the AI coaching assistant.

**Using It**
1. Click the purple sparkle button
2. Select a client (or "All Active Clients")
3. Choose data depth:
   - Light (2 weeks) — fastest
   - Standard (4 weeks) — balanced
   - Deep (all) — most detail, slower
4. Ask a question or use a quick action

**Quick Actions**
- "How's [client] doing this week?"
- "What should I focus on?"
- "Are there any concerns?"
- "Weekly summary for all clients"
- "Who might be struggling?"

**Custom Questions**
Type anything:
- "Should I increase her mileage next week?"
- "Why does he keep skipping Thursdays?"
- "Compare her last 4 weeks of progress"

**What the AI Knows**
- All workout data (programmed, completed, skipped with reasons)
- RPE, pace, miles, duration, heart rate
- Strava data, workout comments, training profile
- Plan details and timeline

**Thumbs Up / Down**
- Rate every response with thumbs up/down
- AI learns your preferred style over time
- Good responses used as examples; bad ones avoided

**Monthly Budget**
- $5.00/month default (configurable)
- Badge: "$X.XX / $5.00"
- Resets on the 1st of each month automatically
- Purple = normal, Yellow = 80%+, Red = exceeded`,
  },
  {
    id: "multi-coach",
    title: "Multi-Coach System",
    content: `Multiple coaches can be assigned to a single client.

**How It Works**
- Each client has one default coach (gold star)
- Additional coaches can be added/removed
- All assigned coaches can view, create plans, message, and comment
- Email notifications only go to assigned coaches

**Managing Coaches on a Client**
1. Click "+" next to coach badges in the client header
2. Dropdown shows all coaches in the system
3. Click a coach to assign them
4. Click "X" to remove a coach
5. Click star to change the default

**Adding Coaches to the System**
1. Gear menu > "Manage Coaches"
2. Enter Name and Email
3. Click "Invite Coach" — they receive an invite email
4. Once they accept, they have full admin access

**Removing Coaches**
- In Manage Coaches, click "Remove"
- They lose admin access immediately
- Existing plans/comments remain
- If they were default, next coach auto-promoted
- You cannot remove yourself

**What Clients See**
- Client sees default coach's name everywhere
- Comments show which specific coach wrote them
- Messages show which coach sent each one`,
  },
  {
    id: "notifications",
    title: "Notification Settings",
    content: `**Accessing** — Gear menu > "Account Preferences"

**Email Notifications You Receive**
- Client completes a workout — Immediate / Off
- Client skips a workout — Immediate / Off
- Client partially completes — Immediate / Off
- Client sends a message — Immediate / Off
- Daily summary — On / Off

**How It Works**
- "Immediate" = email within a few minutes
- Notifications only fire for clients assigned to you
- Other assigned coaches get notified when you comment`,
  },
  {
    id: "preferences",
    title: "Preferences (Units, Dates, Display)",
    content: `**Accessing** — Gear menu > "Account Preferences"

**Distance Unit**
- Miles (MI) or Kilometers (KM)
- Sets default for new workouts
- Can still toggle individual workouts
- Independent of other coaches

**Weight Unit**
- Kilograms (kg) or Pounds (lbs)
- Used in Cross-Training Builder

**Date Format**
- MM/DD/YYYY (June 15, 2026)
- DD/MM/YYYY (15 June 2026)
- Applies everywhere

**Default Week View**
- Expanded — all days open by default
- Collapsed — all days collapsed (click to expand)`,
  },
  {
    id: "strava",
    title: "Strava Integration (Admin View)",
    content: `**What You See**
- Client's Strava profile picture in the header
- Orange Strava badge + activity name on synced workouts
- Auto-filled metrics: miles, pace, duration, avg/max heart rate
- Orange border on Strava-connected cards

**How Matching Works**
1. Client does a workout, syncs from Strava
2. If obvious match (same day, type, similar distance) — auto-matches
3. If no clear match — shows as "Extra" with yellow badge
4. Client can accept/reject matches on their side

**What to Know**
- Auto-matched workouts still need client to add RPE and Sleep
- 0-mile activities (accidental starts) are ignored
- Real-time sync via webhook
- Disconnect/reconnect keeps data intact`,
  },
  {
    id: "workflows",
    title: "Common Workflows",
    content: `**Starting a New Client**
1. "+ New Client" > fill Name, Email, Gender, Birthday > Create
2. Client receives invite email and sets password
3. Account tab > Create a Plan (goal, dates, cost)
4. Create Week > build their first week
5. Publish — client sees their plan!

**Weekly Planning Routine**
1. Open each active client
2. Check Training & Logs — review completion, RPE, comments
3. Create Week > pick next week's dates
4. (Optional) "AI Suggest Week" or load a template
5. Customize based on how they did this week
6. Save as Draft or Publish

**When a Client Finishes Their Plan**
1. Account tab > Plans & Payments > Mark Complete
2. Record final payment if needed
3. Create a new plan for next training block

**Checking on All Clients at Once**
1. Open AI Coach Assistant (purple button)
2. Select "All Active Clients"
3. Ask: "Who needs attention?" or "Weekly summary"`,
  },
  {
    id: "tips",
    title: "Tips & Tricks",
    content: `1. **Use templates for recurring weeks** — save a "Base Week" template, load it, tweak details

2. **Coach Notes field** — leave yourself reminders (clients never see it)

3. **AI Coach before messaging** — ask AI about a client before reaching out

4. **Thumbs up the AI** — more feedback = better responses

5. **Deep mode for struggling clients** — use "Deep (all)" for clients you're concerned about

6. **Draft before publish** — save as draft to come back and finalize later

7. **Check outstanding payments regularly** — dashboard shows them prominently

8. **Archive inactive clients** — keeps sidebar clean, can reactivate later

9. **Comment on workouts** — clients love specific workout feedback

10. **Multiple workouts per day** — AM run + PM strength on the same day works great`,
  },
];

export default function UserManual() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = searchQuery
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sections;

  // Simple markdown-like rendering for bold text and line breaks
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <h4 key={i} className="text-white font-heading text-sm uppercase mt-4 mb-2">
            {line.replace(/\*\*/g, "")}
          </h4>
        );
      }
      if (line.match(/^\*\*.*\*\*$/)) {
        return (
          <h4 key={i} className="text-white font-heading text-sm uppercase mt-4 mb-2">
            {line.replace(/\*\*/g, "")}
          </h4>
        );
      }
      // Bold heading with content after
      if (line.match(/^\*\*.*?\*\*/)) {
        const parts = line.split(/\*\*/);
        return (
          <p key={i} className="text-gray-300 text-sm mb-1">
            <span className="text-white font-semibold">{parts[1]}</span>
            {parts[2] || ""}
          </p>
        );
      }
      if (line.startsWith("- ")) {
        return (
          <li key={i} className="text-gray-300 text-sm ml-4 mb-1 list-disc">
            {line.slice(2)}
          </li>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        return (
          <li key={i} className="text-gray-300 text-sm ml-4 mb-1 list-decimal">
            {line.replace(/^\d+\.\s/, "")}
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={i} className="h-3" />;
      }
      return (
        <p key={i} className="text-gray-300 text-sm mb-1">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl uppercase text-white">User Manual</h2>
      </div>
      <p className="text-gray-400 text-sm">
        Everything you need to know about managing your coaching platform.
      </p>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search the manual..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-primary/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {filteredSections.map((section) => (
          <div
            key={section.id}
            className="bg-secondary/50 border border-white/10 rounded-xl overflow-hidden"
          >
            <button
              onClick={() =>
                setActiveSection(activeSection === section.id ? null : section.id)
              }
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
            >
              <span
                className={`text-sm font-heading uppercase ${
                  activeSection === section.id ? "text-purple-400" : "text-white"
                }`}
              >
                {section.title}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  activeSection === section.id ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {activeSection === section.id && (
              <div className="px-5 pb-5 border-t border-white/5 pt-4">
                {renderContent(section.content)}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredSections.length === 0 && (
        <div className="text-center py-10">
          <p className="text-gray-500 text-sm">
            No sections match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
