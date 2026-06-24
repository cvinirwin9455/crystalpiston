"use client";

import { useState, useEffect } from "react";

// Last time the changelog was updated — used for "new updates" badge
export const CHANGELOG_LAST_UPDATED = "2026-06-24T22:00:00Z";

const updates = [
  {
    date: "June 24, 2026",
    items: [
      { area: "Client", text: "Strava activities now auto-match to your programmed workout when it's an obvious fit (same day, same type, similar distance) — no more manual confirmation needed" },
      { area: "Client", text: "Auto-matched Strava workouts show the orange Strava badge and your miles/pace/duration/HR automatically on the programmed card" },
      { area: "Client", text: "No more 'Extra' workout appearing when Strava clearly matches your plan — only shows as Extra when the match isn't clear" },
      { area: "Admin", text: "Crystal gets notified immediately when a client's Strava auto-matches to their programmed workout" },
      { area: "All", text: "Fixed duplicate showing on dashboard — matched Strava workouts no longer appear as both 'completed programmed' AND a separate 'Extra' entry" },
      { area: "Client", text: "You can now edit your workout log after submitting — tap the Edit button on any completed workout to fix mistakes (wrong miles, RPE, notes, etc.)" },
    ],
  },
  {
    date: "June 22, 2026",
    items: [
      { area: "All", text: "Workout cards redesigned — cleaner layout with compact metric pills (RPE, Miles, Pace, Duration, HR, Sleep) all in one line" },
      { area: "All", text: "Consistent source badges on every workout: 'Programmed' (purple), 'Your Workout/Client' (cyan), 'Extra' (yellow for Strava standalone)" },
      { area: "All", text: "Strava-synced workouts now show the orange Strava logo + activity name (e.g. 'Morning Trail Run') as a badge" },
      { area: "All", text: "Removed redundant 'Synced from Strava' and 'Kept as extra from Strava' text — the badge handles it now" },
      { area: "All", text: "Removed green 'Completed' badge — the green checkmark circle is enough" },
      { area: "All", text: "Distance display improved — actual (green) and target (gray) shown side by side, not stacked" },
      { area: "All", text: "Comments now available on all workout types — client-created and Strava extras, not just programmed workouts" },
      { area: "Admin", text: "Admin side now matches client side — same badges, same metrics layout, same distance display" },
      { area: "Admin", text: "Fixed week templates showing 'Run' for every day — now shows the correct workout type for each day" },
      { area: "Admin", text: "Week and day templates now have an Edit button — edit name, category, workouts right on the card" },
      { area: "Admin", text: "Create templates directly from the Templates view (+ Create Week Template, + Create Day Template)" },
      { area: "Admin", text: "Templates sorted alphabetically by name" },
      { area: "Admin", text: "Template summary now correctly counts runs, cross training, walks, and rest days" },
      { area: "Admin", text: "Editing a draft now scrolls smoothly to the edit form instead of jumping to the top" },
    ],
  },
  {
    date: "June 21, 2026",
    items: [
      { area: "Client", text: "New notification toggles: Strava Activity Synced + Workout Comments (on by default, can turn off)" },
      { area: "Admin", text: "Crystal now sees all Strava data on client workouts: activity name, miles, pace, duration, heart rate" },
      { area: "Admin", text: "Client-created and Strava workouts show completed status with green badge" },
      { area: "Admin", text: "Heart rate (avg + max) now shows on programmed workout logs too" },
      { area: "Admin", text: "Strava workouts have orange border, client-created have cyan border" },
      { area: "Client", text: "Header now sticks to the top when scrolling — always accessible" },
      { area: "Client", text: "Bell icon in header shows new updates with a red dot badge" },
      { area: "Client", text: "Click the bell to see what's new — only shows unread updates" },
      { area: "Client", text: "Click off dropdown to mark updates as read" },
      { area: "Client", text: "'View all updates' opens a full-screen history" },
      { area: "Client", text: "Logout is now an icon in the header (cleaner look)" },
      { area: "Client", text: "Strava imports now match to your own client-created workouts (not just Crystal's programmed ones)" },
      { area: "Client", text: "Client-created workout matches show the same dotted-line visual as programmed workout matches" },
      { area: "Client", text: "Done button hides when Strava has a pending match for your workout — reappears if you reject the match" },
      { area: "Client", text: "Heart rate data (avg + max) now shows on all Strava-imported workouts" },
      { area: "Admin", text: "Heart rate data visible on Crystal's side for Strava-synced workouts" },
      { area: "Client", text: "Strava 'Keep as extra workout' now actually saves — won't ask again after page reload" },
      { area: "Client", text: "Extra Strava workouts now count in 'Your Workouts' stats (completed + total)" },
      { area: "Client", text: "After matching a Strava import to your workout, miles/pace/duration/HR now show on the card" },
      { area: "Client", text: "Right-side number on workout card now shows actual miles (green) after completion, with programmed miles crossed out below" },
      { area: "Client", text: "MI/KM toggle on a workout now also converts logged data (actual miles, pace)" },
      { area: "Client", text: "MI/KM toggle added to client-created workouts and Strava imports with distance" },
      { area: "All", text: "Stats miles now correctly convert between MI/KM when workouts are programmed in different units" },
      { area: "Client", text: "RPE and Sleep sliders now stack vertically on mobile — full width, much easier to use on phones" },
      { area: "Client", text: "Email sent to client when Strava syncs a new activity — tells them match status and asks to log in" },
      { area: "All", text: "Strava webhook now registered and pushing real-time activity updates" },
      { area: "All", text: "Strava activities imported before Crystal publishes a week now auto-link when the week goes live" },
      { area: "Admin", text: "Removed confusing 0/0 stat from the client sidebar" },
    ],
  },
  {
    date: "June 20, 2026",
    items: [
      { area: "All", text: "New logo now shows as the browser tab icon (favicon) — looks more professional" },
      { area: "All", text: "Apple devices and Android home screen bookmarks now use the new logo" },
      { area: "All", text: "Web app manifest added for better mobile experience when saving to home screen" },
      { area: "Client", text: "Strava imports now visually attach to the programmed workout they match — connected by a dotted line" },
      { area: "Client", text: "Unmatched Strava imports clearly show 'No Match Found' with dashed border styling" },
      { area: "Client", text: "No more guessing which workout is which — Strava imports appear right below the workout they belong to" },
      { area: "Client", text: "'I Did This' and 'I Skipped This' buttons hide when a Strava match is pending" },
      { area: "All", text: "Strava reconnection now works after revoking access in Strava settings" },
      { area: "All", text: "Stats miles/KM now only counts Run + Walk activities (not cycling, cross training, etc.)" },
      { area: "Client", text: "Strava match confirmation now requires RPE, Sleep, and Notes before completing" },
      { area: "All", text: "Crystal gets emailed when a client completes a workout via Strava or manually" },
    ],
  },
  {
    date: "June 18, 2026",
    items: [
      { area: "All", text: "Text is now brighter and easier to read across the whole app" },
      { area: "All", text: "Keyboard users now see visible focus rings when tabbing through inputs" },
      { area: "All", text: "Stats section now adjusts nicely on smaller screens (mobile-friendly)" },
      { area: "All", text: "Screen reader support improved throughout the app" },
      { area: "Client", text: "Your added workouts now save when you mark them Done (persists after logout)" },
      { area: "Admin", text: "Crystal can no longer accidentally edit workouts that clients have already completed" },
      { area: "Admin", text: "Drafts are now sorted by date (earliest first) then by client name" },
      { area: "Admin", text: "Editing published workouts now saves correctly" },
      { area: "All", text: "Distance preference (Miles/KM) and default week view now save properly" },
    ],
  },
  {
    date: "June 16, 2026",
    items: [
      { area: "All", text: "Day blocks are now collapsible — click any day to expand/collapse it" },
      { area: "All", text: "Expand All / Collapse All buttons at the top of the week view" },
      { area: "All", text: "Default Week View preference in Account Preferences (choose Expanded or Collapsed)" },
      { area: "All", text: "Each day header now shows the full date (e.g., 16 June 2026)" },
      { area: "All", text: "Rest days no longer count in the workout total on collapsed headers" },
      { area: "All", text: "'Go to current week' arrow now points in the right direction depending on past/future" },
      { area: "Client", text: "Client-added workouts no longer auto-complete — they show as planned until you mark them Done" },
      { area: "Client", text: "'Client Added' tag renamed to 'Your Added Workout'" },
      { area: "Client", text: "Stats: 'Workouts Marked' renamed to 'Programmed Workouts'" },
      { area: "Client", text: "Stats: new 'Your Workouts' column shows completed/total of your own added workouts" },
      { area: "Admin", text: "Crystal can now add workouts to a day when editing a published week" },
      { area: "Admin", text: "Stats: 'Workouts Marked' renamed to 'Programmed Workouts'" },
      { area: "Admin", text: "Stats: new 'Client Workouts' column shows how many the client added" },
      { area: "Admin", text: "Dashboard now shows Drafts Ready to Publish immediately on first login" },
      { area: "Admin", text: "Duplicate weeks can no longer be created (database constraint added)" },
      { area: "Marketing", text: "Added Tracie B.'s client story to the homepage" },
    ],
  },
  {
    date: "June 15, 2026",
    items: [
      { area: "Client", text: "Clients can now add their own workouts (runs, walks, cross training, strength, etc.) under each day" },
      { area: "Client", text: "Client-added workouts show with a cyan 'Your Added Workout' badge" },
      { area: "Client", text: "Run/walk client workouts count toward weekly total miles/km" },
      { area: "Client", text: "Rest days simplified — just an optional comment button (no completion needed)" },
      { area: "Client", text: "Workout log simplified: RPE + Sleep at top, then Miles, Pace, Stress, Notes" },
      { area: "Client", text: "Crystal can comment on completed workouts — client sees it and can reply" },
      { area: "Client", text: "Comments show at the bottom of each workout card as a threaded conversation" },
      { area: "Client", text: "Email notification sent when Crystal comments on a workout" },
      { area: "Admin", text: "Crystal can see client-added workouts grouped with the same day's programmed workout" },
      { area: "Admin", text: "Crystal can comment on any completed workout — client gets an email notification" },
      { area: "Admin", text: "MI/KM toggle in edit mode now works per-workout" },
      { area: "Admin", text: "Distance unit is now saved per workout — Crystal can mix MI and KM in the same week" },
      { area: "Admin", text: "Crystal can navigate forward to all programmed weeks (not limited to one week out)" },
      { area: "Admin", text: "Gaps between published weeks show 'No published plan for this week'" },
    ],
  },
  {
    date: "June 14, 2026",
    items: [
      { area: "Admin", text: "Distance unit preference added — switch between Miles and Kilometers in Account Preferences" },
      { area: "Client", text: "Distance unit preference added — set default to Miles or KM in Account Preferences" },
      { area: "Client", text: "Per-workout toggle lets you quickly switch between miles and km on any workout" },
      { area: "Admin", text: "Added Progressive and Trail as new run types" },
      { area: "Admin", text: "Crystal and Curtis can now both see all client messages" },
      { area: "Admin", text: "Workout completion, skip, and partial emails now send correctly" },
      { area: "Client", text: "Your name now shows at the top of the dashboard" },
      { area: "Marketing", text: "Vercel Analytics added to track website visitors" },
    ],
  },
  {
    date: "June 13, 2026",
    items: [
      { area: "Admin", text: "New workout types: Walk (Power/Recovery), Cycling, Stretching (Stretching/Foam Roll/Yoga)" },
      { area: "Admin", text: "Notification emails now send when clients complete, skip, or partially complete workouts" },
      { area: "Admin", text: "Invite status now correctly shows 'pending' until a client actually signs in" },
      { area: "Admin", text: "Create Client form simplified — only Name, Email, Gender" },
      { area: "Client", text: "Period tracking only shows for female clients" },
      { area: "Client", text: "Notification preferences added to Account tab" },
      { area: "Marketing", text: "Added Karlee H. testimonial to the homepage" },
    ],
  },
  {
    date: "June 12, 2026",
    items: [
      { area: "Admin", text: "Training Templates system — save and reuse entire weeks or individual days" },
      { area: "Admin", text: "Multiple workouts per day — '+ Add another workout' now works" },
      { area: "Admin", text: "Week date validation shows immediately when selecting a week" },
      { area: "Client", text: "Messages auto-scroll to newest message" },
      { area: "Client", text: "Unread message badge fixed — only marks read when Messages tab is opened" },
    ],
  },
  {
    date: "June 11, 2026",
    items: [
      { area: "Admin", text: "Edit Week 'Save Changes' button now actually saves workout edits" },
      { area: "Admin", text: "Payment history now persists in the database" },
      { area: "All", text: "Password reset flow fixed — now redirects to correct page" },
      { area: "All", text: "Invite flow deployed for new clients" },
    ],
  },
];

export default function Changelog() {
  const [expandedDate, setExpandedDate] = useState<string | null>(updates[0]?.date || null);

  // Mark changelog as seen in localStorage
  useEffect(() => {
    localStorage.setItem("changelog_last_seen", CHANGELOG_LAST_UPDATED);
  }, []);

  const getAreaBadge = (area: string) => {
    switch (area) {
      case "Admin": return "bg-accent/20 text-accent";
      case "Client": return "bg-blue-500/20 text-blue-400";
      case "Marketing": return "bg-gold/20 text-gold";
      case "All": return "bg-green-500/20 text-green-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl uppercase text-white">What&apos;s New</h2>
        <span className="text-gray-500 text-xs">Last updated: {new Date(CHANGELOG_LAST_UPDATED).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
      </div>
      <p className="text-gray-400 text-sm">Updates and improvements to the platform.</p>

      <div className="space-y-3">
        {updates.map((update, updateIdx) => (
          <div key={updateIdx} className="bg-secondary/50 border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedDate(expandedDate === update.date ? null : update.date)}
              className="w-full text-left px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-white font-heading text-sm uppercase">{update.date}</span>
                <span className="text-gray-500 text-xs">{update.items.length} updates</span>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedDate === update.date ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {expandedDate === update.date && (
              <div className="px-5 pb-4 space-y-2">
                {update.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 py-1.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${getAreaBadge(item.area)}`}>{item.area}</span>
                    <p className="text-gray-300 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
