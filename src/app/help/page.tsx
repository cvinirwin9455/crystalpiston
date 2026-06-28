"use client";

import { useState } from "react";
import Link from "next/link";

type HelpArticle = {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
};

const helpArticles: HelpArticle[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    category: "Basics",
    keywords: ["start", "begin", "new", "first", "setup", "how to"],
    content: `Welcome to Crystal Pistol Performance! Your dashboard is your home base for everything related to your training. Here's a quick overview:\n\n• **Training Tab** — View your weekly plan, log workouts, track progress\n• **Messages Tab** — Chat directly with Crystal\n• **Account Tab** — Manage your plan, Strava, notifications, and preferences\n\nYour weekly training plan is published by Crystal and appears on the Training tab. Each day shows your programmed workouts with details like distance, pace targets, and coach notes.`,
  },
  {
    id: "logging-workout",
    title: "Logging a Completed Workout",
    category: "Training",
    keywords: ["log", "complete", "done", "finish", "record", "i did this", "save"],
    content: `After completing a workout, tap **"I Did This"** on the workout card. A form will expand where you can enter:\n\n• **RPE (1–10)** — How hard did it feel? (Required)\n• **Sleep Quality (1–10)** — How well did you sleep last night?\n• **Actual Miles** — The distance you actually ran/walked\n• **Average Pace** — Your pace (e.g. 9:30/mi)\n• **Notes** — How it felt, conditions, anything notable\n• **On Period** — Track your cycle if applicable\n\nTap **"Complete & Save"** to submit. Your workout card will show a green checkmark and your logged metrics.`,
  },

  {
    id: "editing-workout",
    title: "Editing a Workout Log",
    category: "Training",
    keywords: ["edit", "change", "fix", "mistake", "wrong", "update", "correct"],
    content: `Made a mistake when logging? No problem. On any completed workout card, look for the **Edit** button (pencil icon) at the end of the metrics row (RPE, miles, pace, etc.).\n\nTap it to reopen the log form with your existing data pre-filled. Make your changes and tap **"Save Changes"**. This works for fixing typos in miles, updating RPE, adding notes you forgot, or toggling the period tracker.`,
  },
  {
    id: "skipping-workout",
    title: "Skipping or Partially Completing a Workout",
    category: "Training",
    keywords: ["skip", "partial", "half", "incomplete", "miss", "didn't finish"],
    content: `If you can't do a workout, tap **"I Skipped This"** and enter a reason (injury, sick, schedule conflict, etc.). Crystal will see your reason and can adjust future plans accordingly.\n\nIf you started but couldn't finish, use **"I Did This"** then select **"Partially Done"** in the form. Enter what you actually did (actual miles, pace) and explain what you couldn't complete. This counts differently in your stats than a full skip.`,
  },
  {
    id: "adding-workouts",
    title: "Adding Your Own Workouts",
    category: "Training",
    keywords: ["add", "extra", "my own", "client workout", "create", "additional"],
    content: `Want to log a workout that isn't on your plan? At the bottom of any day, tap **"+ Add Workout"**. Choose a type (Run, Walk, Cross Training, Cycling, Stretching), add a subtype if applicable, enter distance, and add any notes.\n\nYour added workouts appear with a cyan **"Your Workout"** badge. You can mark them as done separately, and Crystal can see them too. They count toward your weekly stats.`,
  },

  {
    id: "strava-connect",
    title: "Connecting Strava",
    category: "Strava",
    keywords: ["strava", "connect", "link", "sync", "watch", "garmin", "gps"],
    content: `Connect your Strava account to automatically sync your completed activities. Go to **Account Tab → Strava** and tap **"Connect Strava"**. You'll be redirected to Strava to authorize access.\n\nOnce connected, any activity you record on Strava (via your watch, phone, etc.) will automatically appear in your training log. The system will attempt to match it to your programmed workout for that day.\n\n**Requirements:** Grant "activity:read" permission when Strava asks. This lets us see your activities but we can never post to your Strava account.`,
  },
  {
    id: "strava-matching",
    title: "How Strava Matching Works",
    category: "Strava",
    keywords: ["strava", "match", "auto", "extra", "link", "wrong workout", "didn't match"],
    content: `When a Strava activity syncs, the system automatically matches it to your programmed workout if it's a clear fit (same day, same type, similar distance). When this happens:\n\n• Your programmed workout card shows as completed with the orange Strava badge\n• Miles, pace, duration, and heart rate from Strava appear automatically\n• No action needed from you\n\n**If it doesn't auto-match:** The activity appears as an "Extra" card. You can manually link it to your programmed workout by tapping **"Link to today's programmed workout"** on the Extra card.\n\n**If it matches wrong:** Use the Edit button on your workout to correct the data.`,
  },
  {
    id: "strava-import",
    title: "Importing Past Strava Activities",
    category: "Strava",
    keywords: ["strava", "import", "history", "past", "old", "before", "previous"],
    content: `If you connected Strava after you'd already done some workouts, you can import past activities. Go to **Account Tab → Strava → Import Past Activities**.\n\nSelect a date range and tap **"Import Activities"**. The system will pull in all your Strava activities from that period and match them to your programmed workouts where possible.\n\n**Tip:** The "To" date includes that entire day. So if you want today's activities, just set the "To" date to today.`,
  },
  {
    id: "strava-not-syncing",
    title: "My Strava Activity Didn't Sync",
    category: "Strava",
    keywords: ["strava", "missing", "not syncing", "didn't show", "lost", "where", "not showing", "failed", "sync failed"],
    content: `Sometimes Strava's automatic sync can miss an activity. This is rare but it happens — it's on Strava's end, not yours. If your activity isn't showing up after a few minutes:\n\n**Quick fix:** Go to **Account Tab → Strava → Import Past Activities**, set the "From" date to today (or the day of the missing activity), and tap **"Import Activities"**. This manually pulls it from Strava.\n\n**Automatic backup:** The system also runs a daily check at 6am UTC that catches any activities Strava's webhook missed in the past 24 hours. So even if you don't manually import, it should appear by the next morning.\n\n**Still not working?** Make sure the activity is fully saved in Strava (not still processing), and that your Strava connection is active in Account Tab.`,
  },

  {
    id: "strava-disconnect",
    title: "Disconnecting Strava",
    category: "Strava",
    keywords: ["strava", "disconnect", "remove", "unlink", "stop syncing"],
    content: `To disconnect Strava, go to **Account Tab → Strava** and tap **"Disconnect Strava"**. Your previously synced workouts will remain in your log, but new activities won't sync until you reconnect.`,
  },
  {
    id: "messages",
    title: "Messaging Your Coach",
    category: "Communication",
    keywords: ["message", "chat", "crystal", "coach", "talk", "ask", "question"],
    content: `Tap the **Messages** tab to open a direct chat with your coach. Type your message and tap **"Send"**. Your coach receives an email notification and will reply when available.\n\nYou'll get an email when your coach replies (configurable in Account → Notifications). Messages are organized chronologically like a text conversation. A red badge on the Messages tab shows your unread count.`,
  },
  {
    id: "comments",
    title: "Workout Comments",
    category: "Communication",
    keywords: ["comment", "reply", "feedback", "thread", "conversation", "workout comment"],
    content: `After completing a workout, a comment thread appears at the bottom of the card. Use this to:\n\n• Share how the workout felt\n• Ask your coach a question about that specific workout\n• Respond to your coach's feedback\n\nYour coach's comments appear with a purple badge. You'll receive an email when they comment (configurable in notifications). Comments are tied to the specific workout so context is always clear.`,
  },
  {
    id: "weekly-stats",
    title: "Understanding Your Stats",
    category: "Training",
    keywords: ["stats", "statistics", "miles", "progress", "completion", "rpe", "numbers"],
    content: `At the top of the Training tab, you'll see your weekly stats:\n\n• **Miles** — Actual miles completed vs. programmed (runs + walks only)\n• **Workouts** — How many programmed workouts you've marked (complete, partial, or skipped)\n• **Completion %** — Weighted score (complete = 100%, partial = 50%, skipped = 0%)\n• **Avg RPE** — Your average effort rating across completed workouts\n\nToggle between **"This Week"** and **"All Time"** to see your full training history. Your own added workouts and Strava extras count toward total miles.`,
  },

  {
    id: "week-navigation",
    title: "Navigating Between Weeks",
    category: "Training",
    keywords: ["week", "navigate", "previous", "next", "past", "future", "arrow", "history"],
    content: `Use the left and right arrows at the top of the Training tab to navigate between weeks. A **"Current Week"** indicator shows which week is active.\n\nYou can only view weeks that Crystal has published. You can log workouts for the **current week** only — past weeks are view-only. Future weeks show the plan but can't be logged until that week arrives.`,
  },
  {
    id: "day-blocks",
    title: "Expanding and Collapsing Days",
    category: "Training",
    keywords: ["expand", "collapse", "day", "open", "close", "toggle", "view"],
    content: `Each day of the week is a collapsible block. Tap the day header to expand or collapse it. When collapsed, you'll see a summary of workout count and total miles.\n\nYou can set your preferred default view (expanded or collapsed) in **Account Tab → Account Preferences → Default Week View**.`,
  },
  {
    id: "distance-units",
    title: "Switching Between Miles and Kilometers",
    category: "Preferences",
    keywords: ["miles", "km", "kilometers", "unit", "convert", "distance", "mi"],
    content: `Set your preferred distance unit in **Account Tab → Account Preferences → Distance Unit**. This affects all distance displays across your dashboard.\n\nYou can also toggle individual workouts between mi/km by tapping the small **"→km"** or **"→mi"** link next to the distance on any workout card. This is useful for quick conversions without changing your global preference.`,
  },
  {
    id: "notifications",
    title: "Managing Email Notifications",
    category: "Preferences",
    keywords: ["notification", "email", "alert", "turn off", "stop emails", "preferences"],
    content: `Control which emails you receive in **Account Tab → Account Preferences**:\n\n• **New Training Plan Published** — When Crystal publishes your weekly plan (recommended: keep on)\n• **Messages from Crystal** — Immediately, daily summary, or off\n• **Strava Activity Synced** — When a Strava activity needs your attention\n• **Workout Comments** — When Crystal comments on your workout\n\nEach notification can be configured independently. Changes save automatically.`,
  },

  {
    id: "plan-info",
    title: "Viewing Your Plan & Payment Status",
    category: "Account",
    keywords: ["plan", "payment", "cost", "paid", "balance", "owed", "goal", "duration"],
    content: `Go to the **Account Tab** to see your active training plan details:\n\n• **Goal** — What you're training for (e.g. "Bass Pro Marathon 4:30")\n• **Start Date & End Date** — Your plan timeline\n• **Payment Status** — How much you've paid vs. total cost, with a progress bar\n\nIf you have an outstanding balance, a red alert will show. Contact Crystal directly to arrange payment. Plan history is available below your active plan.`,
  },
  {
    id: "updates",
    title: "Checking What's New",
    category: "Basics",
    keywords: ["updates", "new", "changes", "bell", "notification", "what's new", "changelog"],
    content: `A red dot on the bell icon in your header means there are new app updates you haven't seen. Tap the bell to see a summary of recent changes.\n\nTap **"View all updates"** to see the complete history of every improvement made to the app. The dot disappears once you've viewed the updates.`,
  },
  {
    id: "workout-types",
    title: "Understanding Workout Types & Badges",
    category: "Training",
    keywords: ["type", "badge", "run", "cross", "rest", "walk", "stretching", "cycling", "programmed", "extra"],
    content: `Workouts are color-coded by type:\n\n• **RUN** (red) — Running workouts with subtypes like Easy, Tempo, Intervals, Long Run, Trail, etc.\n• **WALK** (blue) — Walking workouts\n• **CROSS** (teal) — Cross training (swimming, elliptical, etc.)\n• **CYCLING** (purple) — Bike workouts\n• **STRETCHING** (green) — Yoga, mobility, flexibility\n• **REST** (gray) — Recovery days\n\n**Source badges:**\n• **Programmed** (purple) — Created by Crystal as part of your plan\n• **Your Workout** (cyan) — Added by you\n• **Extra** (yellow) — Synced from Strava but not matched to a programmed workout`,
  },
  {
    id: "heart-rate",
    title: "Heart Rate Data",
    category: "Strava",
    keywords: ["heart rate", "hr", "bpm", "average", "max", "heartrate"],
    content: `If your Strava-connected device records heart rate, it automatically shows on your workout card after syncing:\n\n• **HR** — Your average heart rate during the activity\n• **Max** — Your maximum heart rate reached\n\nThis data helps Crystal understand your effort level and recovery. If you see heart rate on a workout, it came from your Strava-synced device (watch, chest strap, etc.).`,
  },
  {
    id: "coach-notes",
    title: "Reading Coach Notes",
    category: "Training",
    keywords: ["coach", "notes", "instructions", "crystal", "guidance", "advice"],
    content: `Some workouts include a gold **"Coach Notes"** section. These are specific instructions from Crystal for that workout — warmup guidance, pacing strategy, terrain advice, or technique cues.\n\nRead these before your workout. If you have questions, use the comment thread after completing the workout or send a message on the Messages tab.`,
  },
];


const categories = ["All", "Basics", "Training", "Strava", "Communication", "Preferences", "Account"];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const filteredArticles = helpArticles.filter(article => {
    const matchesCategory = activeCategory === "All" || article.category === activeCategory;
    if (!searchQuery.trim()) return matchesCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      article.title.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query) ||
      article.keywords.some(k => k.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-primary text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-primary/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <h1 className="font-heading text-xl uppercase text-white">Help Center</h1>
          </div>
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">Back to Dashboard</Link>
        </div>
      </header>


      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles... (e.g. 'strava', 'edit workout', 'miles')"
              className="w-full bg-secondary/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent placeholder:text-gray-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-gray-400 text-xs mt-2">{filteredArticles.length} result{filteredArticles.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;</p>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat ? "bg-accent/20 border border-accent/40 text-accent" : "bg-secondary/50 border border-white/10 text-gray-400 hover:text-white"}`}
            >
              {cat}
            </button>
          ))}
        </div>


        {/* Articles */}
        <div className="space-y-3">
          {filteredArticles.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" /></svg>
              <p className="text-gray-400 text-sm">No articles found. Try a different search term.</p>
            </div>
          )}
          {filteredArticles.map(article => (
            <div key={article.id} className="bg-secondary/50 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">{article.category}</span>
                  <h3 className="text-white font-medium text-sm">{article.title}</h3>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandedArticle === article.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {expandedArticle === article.id && (
                <div className="px-5 pb-5 pt-0 border-t border-white/5">
                  <div className="prose prose-sm prose-invert max-w-none pt-4">
                    {article.content.split('\n\n').map((para, i) => (
                      <p key={i} className="text-gray-300 text-sm leading-relaxed mb-3 last:mb-0">
                        {para.split('\n').map((line, j) => (
                          <span key={j}>
                            {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                              part.startsWith('**') && part.endsWith('**')
                                ? <strong key={k} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                                : <span key={k}>{part}</span>
                            )}
                            {j < para.split('\n').length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>


        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-gray-400 text-sm mb-2">Can&apos;t find what you&apos;re looking for?</p>
          <Link href="/dashboard?tab=messages" className="inline-flex items-center gap-2 text-accent hover:text-white text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Send Crystal a message
          </Link>
        </div>
      </main>
    </div>
  );
}
