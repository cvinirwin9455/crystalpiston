"use client";

import { useState } from "react";

const updates = [
  {
    date: "June 15, 2026",
    items: [
      { area: "Client", text: "Clients can now add their own workouts — runs, strength, stretching, etc. — under each day" },
      { area: "Client", text: "Client-added workouts show with a cyan 'Client Added' badge so they're easy to spot" },
      { area: "Client", text: "Run/walk client workouts count toward the weekly total miles/km" },
      { area: "Client", text: "Clients can delete their own added workouts (only current week)" },
      { area: "Admin", text: "Crystal can see client-added workouts grouped with the same day's programmed workout" },
      { area: "Admin", text: "Client-added run/walk miles are included in Crystal's stats view" },
      { area: "Admin", text: "Crystal cannot edit/delete client-added workouts (read-only)" },
      { area: "Admin", text: "Stats card now shows This Week / Current Plan / All Time toggle with Avg Effort and Completion %" },
      { area: "Admin", text: "Total miles/km now visible on week headers, draft cards, and Drafts Ready to Publish" },
      { area: "All", text: "Distance conversion now exact to 2 decimal places (e.g. 5 mi = 8.05 km)" },
    ],
  },
  {
    date: "June 14, 2026",
    items: [
      { area: "Admin", text: "Distance unit preference added — Crystal can switch between Miles and Kilometers in Account Preferences and all client views update automatically" },
      { area: "Admin", text: "Client stats (Done, Distance, Dollars) now default to showing the current plan instead of all time" },
      { area: "Admin", text: "Toggle added to switch between 'Current Plan' and 'All Time' stats when viewing a client" },
      { area: "Client", text: "Distance unit preference added — clients can set their default to Miles or KM in Account Preferences" },
      { area: "Client", text: "Per-workout toggle lets clients quickly switch between miles and km on any individual workout" },
      { area: "Client", text: "Renamed 'Notification Preferences' to 'Account Preferences' to match the admin side" },
      { area: "Admin", text: "Added Progressive and Trail as new run types" },
      { area: "Admin", text: "Crystal and Curtis can now both see all client messages regardless of who sent them" },
      { area: "Admin", text: "Fixed an issue where Crystal couldn't see updates when Curtis was also logged in" },
      { area: "Admin", text: "Notification settings now only show options that are fully working (Immediately or Off)" },
      { area: "Admin", text: "Workout completion, skip, and partial emails now send correctly to Crystal" },
      { area: "Admin", text: "Crystal's name shows in the sidebar so she knows who is logged in" },
      { area: "Admin", text: "Logo made bigger and easier to see across the entire site" },
      { area: "Client", text: "Clients can now see their name at the top of the dashboard so they know they're logged in" },
      { area: "Marketing", text: "Crystal's face is now always visible in the hero background photo at any screen width" },
      { area: "Marketing", text: "Vercel Analytics added to track website visitors" },
    ],
  },
  {
    date: "June 13, 2026",
    items: [
      { area: "Admin", text: "New workout types added: Walk (Power/Recovery), Cycling, Stretching (Stretching/Foam Roll/Yoga)" },
      { area: "Admin", text: "Run and Walk types now require a subtype and distance to be filled in before saving" },
      { area: "Admin", text: "Cycling and Stretching simplified — only need to fill in workout details" },
      { area: "Admin", text: "Fartlek added as a run type" },
      { area: "Admin", text: "Crystal can now edit an active plan (goal, dates, cost) without completing it first" },
      { area: "Admin", text: "Notification emails now send when clients complete, skip, or partially complete workouts" },
      { area: "Admin", text: "Notification emails send when a client messages Crystal" },
      { area: "Admin", text: "Notification settings wired up to database — preferences save and persist" },
      { area: "Admin", text: "Send Notifications To field now saves email addresses to the database" },
      { area: "Admin", text: "Invite status now correctly shows 'pending' until a client actually signs in" },
      { area: "Admin", text: "Resend Invite works for clients who already exist in the system" },
      { area: "Admin", text: "When Crystal updates a client's email, it now also updates their login email" },
      { area: "Admin", text: "Create Client form simplified — only Name, Email, Gender. Plan details added separately" },
      { area: "Admin", text: "Sidebar shows invite status, active goal, or 'No active plan' under each client's name" },
      { area: "Admin", text: "Removed the Delete Client button (only Archive is available now)" },
      { area: "Client", text: "Period tracking only shows for female clients (hidden for males)" },
      { area: "Client", text: "Programmed miles now clearly visible on each workout card" },
      { area: "Client", text: "Notification preferences added to client Account tab (plan published + message frequency)" },
      { area: "Client", text: "Notification preferences save to database and persist" },
      { area: "Marketing", text: "Added Karlee H. testimonial to the homepage" },
    ],
  },
  {
    date: "June 12, 2026",
    items: [
      { area: "Admin", text: "Training Templates system built — save and reuse entire weeks or individual days" },
      { area: "Admin", text: "Templates tab added to sidebar for viewing and deleting saved templates" },
      { area: "Admin", text: "Load from Template button at top of Create Week form" },
      { area: "Admin", text: "Load Day Template and Save Day as Template on each individual day" },
      { area: "Admin", text: "Multiple workouts per day — '+ Add another workout' now works" },
      { area: "Admin", text: "Week date validation shows immediately when selecting a week (not after filling out the form)" },
      { area: "Admin", text: "Can't create a week without an active plan — shows explanation and link to Account tab" },
      { area: "Admin", text: "Week dates must fall within the active plan dates" },
      { area: "Admin", text: "Can't create a duplicate week for the same date range" },
      { area: "Admin", text: "Cancel button added to Create Week form" },
      { area: "Admin", text: "Required field indicators added (date range, subtypes, distance)" },
      { area: "Admin", text: "Save as Template scrolls into view when clicked" },
      { area: "Admin", text: "Removed 'Done' tag from completed workouts (the circle icon is enough)" },
      { area: "Admin", text: "Removed templates from the dashboard overview (moved to Templates tab)" },
      { area: "Admin", text: "Plan completion now requires a reason if there's an outstanding balance" },
      { area: "Admin", text: "Can't create a new plan while one is active — must complete the current one first" },
      { area: "Admin", text: "Completed plans show goal, balance due, and completion notes in history" },
      { area: "Admin", text: "Financial data now comes from Plans (not the old legacy fields)" },
      { area: "Client", text: "Rest days simplified — just a 'Mark Complete' button with optional notes" },
      { area: "Client", text: "Partially Done now shows the same full metrics form as 'I Did This' plus a reason field" },
      { area: "Client", text: "Messages auto-scroll to newest message" },
      { area: "Client", text: "Unread message badge fixed — only marks read when Messages tab is opened" },
      { area: "Client", text: "Message polling added — checks for new messages every 30 seconds" },
    ],
  },
  {
    date: "June 11, 2026",
    items: [
      { area: "Admin", text: "Edit Week 'Save Changes' button now actually saves workout edits" },
      { area: "Admin", text: "Draft Edit button loads the draft into the Create Week form for editing" },
      { area: "Admin", text: "Draft Delete button now works" },
      { area: "Admin", text: "Payment history now persists in the database (individual payments saved, not just totals)" },
      { area: "Admin", text: "Messages auto-scroll to newest message" },
      { area: "Admin", text: "Year no longer hardcoded — works correctly in any year" },
      { area: "Admin", text: "Calendar week picker starts on current month" },
      { area: "All", text: "Password reset flow fixed — now redirects to correct page" },
      { area: "All", text: "Invite flow code deployed (inline script catches auth tokens and redirects)" },
    ],
  },
];

export default function Changelog() {
  const [expandedDate, setExpandedDate] = useState<string | null>(updates[0]?.date || null);

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
      </div>
      <p className="text-gray-400 text-sm">Updates and improvements to the platform.</p>

      <div className="space-y-3">
        {updates.map((update) => (
          <div key={update.date} className="bg-secondary/50 border border-white/10 rounded-xl overflow-hidden">
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
