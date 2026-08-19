"use client";

import { useState, useEffect } from "react";

type FeedbackItem = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  platform: "crystal-pistol" | "first-mile";
  user_role: "coach" | "client";
  type: "bug" | "feedback" | "question";
  description: string;
  page_url: string | null;
  screenshot_url: string | null;
  priority: "low" | "medium" | "high";
  status: "new" | "in_progress" | "implemented" | "wont_fix";
  admin_notes: string | null;
  resolution_message: string | null;
  created_at: string;
  updated_at: string;
};

export default function SuperAdminFeedbackTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);

  // Filters — status checkboxes, default to New + In Progress
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({
    new: true,
    in_progress: true,
    implemented: false,
    wont_fix: false,
  });
  const [typeFilter, setTypeFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Edit state for detail view
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editResolution, setEditResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [activityLog, setActivityLog] = useState<{ type: "note" | "message" | "status"; text: string; date: string }[]>([]);

  // Fetch feedback
  const fetchFeedback = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (platformFilter) params.set("platform", platformFilter);
      if (roleFilter) params.set("user_role", roleFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/feedback/admin?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load feedback");
      const data = await res.json();
      setAllFeedback(data.feedback || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [typeFilter, roleFilter]);

  // Filter displayed items by active status checkboxes (client-side)
  const feedback = allFeedback.filter(f => {
    const activeStatuses = Object.entries(statusFilters).filter(([_, v]) => v).map(([k]) => k);
    if (activeStatuses.length === 0) return true;
    return activeStatuses.includes(f.status);
  });

  // Counts from ALL feedback (always accurate regardless of filter state)
  const statusCounts: Record<string, number> = {
    new: allFeedback.filter(f => f.status === 'new').length,
    in_progress: allFeedback.filter(f => f.status === 'in_progress').length,
    implemented: allFeedback.filter(f => f.status === 'implemented').length,
    wont_fix: allFeedback.filter(f => f.status === 'wont_fix').length,
  };

  // Open detail view
  const openDetail = (item: FeedbackItem) => {
    setSelectedItem(item);
    setEditStatus(item.status);
    setEditNotes(item.admin_notes || "");
    setEditResolution("");
    setSaveSuccess("");
    // Load activity log from database
    const dbLog: { type: string; text: string; date: string }[] = (item as any).activity_log || [];
    // Ensure the resolution_message is in the log (for items where message was sent before activity_log existed)
    if (item.resolution_message) {
      const hasMessage = dbLog.some((entry) => entry.type === "message" && entry.text === item.resolution_message);
      if (!hasMessage) {
        // Prepend the old message as the earliest entry
        dbLog.unshift({ type: "message", text: item.resolution_message, date: item.updated_at });
      }
    }
    setActivityLog(dbLog);
  };

  // Save updates
  const handleSave = async (sendEmail: boolean) => {
    if (!selectedItem) return;
    setSaving(true);
    setSaveSuccess("");
    setError("");

    try {
      const body: any = {
        feedbackId: selectedItem.id,
        status: editStatus,
        adminNotes: editNotes,
      };

      // Only include resolutionMessage if sendEmail is true (triggers email to user)
      if (sendEmail && editResolution.trim()) {
        body.resolutionMessage = editResolution.trim();
      }

      // Build new log entries
      const now = new Date().toISOString();
      const newLogEntries: { type: string; text: string; date: string }[] = [];

      if (sendEmail && editResolution.trim()) {
        newLogEntries.push({ type: "message", text: editResolution.trim(), date: now });
      } else {
        if (editStatus !== selectedItem.status) {
          const statusLabels: Record<string, string> = { new: "New", in_progress: "In Progress", implemented: "Implemented", wont_fix: "Won't Fix" };
          newLogEntries.push({ type: "status", text: `Status changed to "${statusLabels[editStatus] || editStatus}"`, date: now });
        }
        if (editNotes && editNotes !== (selectedItem.admin_notes || "")) {
          newLogEntries.push({ type: "note", text: editNotes, date: now });
        }
      }

      if (newLogEntries.length > 0) {
        body.newLogEntries = newLogEntries;
      }

      const res = await fetch("/api/feedback/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      const data = await res.json();

      setAllFeedback((prev) =>
        prev.map((f) => (f.id === selectedItem.id ? data.feedback : f))
      );
      setSelectedItem(data.feedback);
      // Update local activity log from the saved data
      setActivityLog((data.feedback as any).activity_log || []);

      if (sendEmail && editResolution.trim()) {
        setEditResolution("");
        setSaveSuccess("Saved & email sent to user!");
      } else {
        setSaveSuccess("Saved!");
      }
      setTimeout(() => setSaveSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  // Detail View
  if (selectedItem) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedItem(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </button>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  selectedItem.type === "bug" ? "bg-red-100 text-red-700" : selectedItem.type === "question" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                }`}>
                  {selectedItem.type === "bug" ? "Bug Report" : selectedItem.type === "question" ? "Question" : "Feedback"}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  selectedItem.status === "new" ? "bg-blue-100 text-blue-700" :
                  selectedItem.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                  selectedItem.status === "implemented" ? "bg-green-100 text-green-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {selectedItem.status === "new" ? "New" :
                   selectedItem.status === "in_progress" ? "In Progress" :
                   selectedItem.status === "implemented" ? "Implemented" : "Won't Fix"}
                </span>
                {selectedItem.type === "bug" && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                    selectedItem.priority === "high" ? "bg-red-50 text-red-600" :
                    selectedItem.priority === "medium" ? "bg-yellow-50 text-yellow-600" :
                    "bg-blue-50 text-blue-600"
                  }`}>
                    {selectedItem.priority} priority
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                From {selectedItem.user_name || "Unknown User"}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {selectedItem.user_email} &bull; {selectedItem.user_role === "coach" ? "Coach" : "Client"} &bull;{" "}
                {selectedItem.platform === "crystal-pistol" ? "Crystal Pistol" : "First Mile Coach"} &bull;{" "}
                {formatDateTime(selectedItem.created_at)}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</p>
            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
          </div>

          {/* Page URL */}
          {selectedItem.page_url && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Page URL</p>
              <a href={selectedItem.page_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 text-sm break-all hover:underline">
                {selectedItem.page_url}
              </a>
            </div>
          )}

          {/* Screenshot */}
          {selectedItem.screenshot_url ? (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Screenshot</p>
              <a href={selectedItem.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={selectedItem.screenshot_url}
                  alt="Bug screenshot"
                  className="max-w-full max-h-64 rounded-xl border border-gray-200 hover:border-purple-300 transition cursor-pointer"
                />
              </a>
            </div>
          ) : (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Screenshot</p>
              <p className="text-gray-400 text-sm italic">No screenshot attached</p>
            </div>
          )}
        </div>

        {/* Admin Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Manage This Item</h4>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</label>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: "new", label: "New", color: "blue" },
                { value: "in_progress", label: "In Progress", color: "yellow" },
                { value: "implemented", label: "Implemented", color: "green" },
                { value: "wont_fix", label: "Won't Fix", color: "gray" },
              ] as const).map((s) => (
                <button
                  key={s.value}
                  onClick={() => setEditStatus(s.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    editStatus === s.value
                      ? s.color === "blue" ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                      : s.color === "yellow" ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-300"
                      : s.color === "green" ? "bg-green-100 text-green-700 border-2 border-green-300"
                      : "bg-gray-100 text-gray-700 border-2 border-gray-300"
                      : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Internal Notes <span className="text-gray-400 normal-case font-normal">(only you see this)</span>
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Your private notes about this item..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 resize-none"
            />
          </div>

          {/* Resolution Message (sent to user) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Message to User <span className="text-gray-400 normal-case font-normal">(sent via email when you click &ldquo;Save &amp; Notify User&rdquo;)</span>
            </label>
            <textarea
              value={editResolution}
              onChange={(e) => setEditResolution(e.target.value)}
              placeholder="Write a message to the user about the status of their report... This gets emailed to them."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save (No Email)"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || !editResolution.trim()}
              className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save & Notify User"}
            </button>
          </div>

          {/* Success/Error messages */}
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {saveSuccess}
            </div>
          )}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Activity Log */}
          {activityLog.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Activity Log</p>
              <div className="space-y-2">
                {[...activityLog].reverse().map((entry, i) => (
                  <div key={i} className={`rounded-lg p-3 ${
                    entry.type === "user_reply" ? "bg-indigo-50 border border-indigo-100" :
                    entry.type === "message" ? "bg-purple-50 border border-purple-100" :
                    entry.type === "note" ? "bg-yellow-50 border border-yellow-100" :
                    "bg-blue-50 border border-blue-100"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        entry.type === "user_reply" ? "text-indigo-600" :
                        entry.type === "message" ? "text-purple-500" :
                        entry.type === "note" ? "text-yellow-600" :
                        "text-blue-500"
                      }`}>
                        {entry.type === "user_reply" ? "User replied" :
                         entry.type === "message" ? "Email sent to user" :
                         entry.type === "note" ? "Internal note" :
                         "Status update"}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">{entry.text}</p>
                    {(entry as any).attachments && (entry as any).attachments.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {(entry as any).attachments.map((url: string, j: number) => (
                          <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="Attachment" className="max-h-32 rounded-lg border border-gray-200 hover:border-indigo-300 transition" />
                          </a>
                        ))}
                      </div>
                    )}
                    {(entry as any).from && (
                      <p className="text-gray-400 text-xs mt-1">From: {(entry as any).from}</p>
                    )}
                    <p className="text-gray-400 text-xs mt-1">{formatDateTime(entry.date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-purple-600">Feedback & Bugs</h2>
        <span className="text-xs text-gray-400 font-medium">{total} total</span>
      </div>

      {/* Status checkbox pills with counts */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "new", label: "New", color: "bg-blue-100 text-blue-700 border-blue-300" },
            { key: "in_progress", label: "In Progress", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
            { key: "implemented", label: "Implemented", color: "bg-green-100 text-green-700 border-green-300" },
            { key: "wont_fix", label: "Won't Fix", color: "bg-gray-100 text-gray-600 border-gray-300" },
          ].map(({ key, label, color }) => {
            const count = statusCounts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => setStatusFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  statusFilters[key]
                    ? color
                    : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                  statusFilters[key] ? "border-current" : "border-gray-300"
                }`}>
                  {statusFilters[key] && (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {label} ({count})
              </button>
            );
          })}
        </div>
        {/* Other filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-purple-300"
          >
            <option value="">All Types</option>
            <option value="bug">Bugs</option>
            <option value="feedback">Feedback</option>
          </select>
          <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-purple-300"
            >
              <option value="">All Roles</option>
              <option value="coach">Coaches</option>
              <option value="client">Clients</option>
            </select>
          </div>
        </div>

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <p className="text-gray-500 text-sm">Loading feedback...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && feedback.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">
            No feedback or bug reports yet.
          </p>
          <p className="text-gray-400 text-sm mt-1">
            When users submit reports, they&apos;ll appear here.
          </p>
        </div>
      )}

      {/* Feedback List */}
      {!loading && feedback.length > 0 && (
        <div className="space-y-3">
          {feedback.map((item) => (
            <button
              key={item.id}
              onClick={() => openDetail(item)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 hover:border-purple-200 hover:shadow-sm p-5 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.type === "bug" ? "bg-red-100 text-red-700" : item.type === "question" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    }`}>
                      {item.type === "bug" ? "Bug" : item.type === "question" ? "Question" : "Feedback"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.status === "new" ? "bg-blue-100 text-blue-700" :
                      item.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                      item.status === "implemented" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {item.status === "new" ? "New" :
                       item.status === "in_progress" ? "In Progress" :
                       item.status === "implemented" ? "Implemented" : "Won't Fix"}
                    </span>
                    {item.type === "bug" && (
                      <span className={`text-xs font-semibold capitalize ${
                        item.priority === "high" ? "text-red-500" :
                        item.priority === "medium" ? "text-yellow-600" : "text-blue-500"
                      }`}>
                        {item.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800 text-sm font-medium mb-1 line-clamp-2">
                    {item.description}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {item.user_name || item.user_email} &bull;{" "}
                    {item.platform === "crystal-pistol" ? "Crystal Pistol" : "First Mile"} &bull;{" "}
                    {item.user_role === "coach" ? "Coach" : "Client"} &bull;{" "}
                    {formatDate(item.created_at)}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Resolution preview */}
              {item.status === "implemented" && item.resolution_message && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-gray-500 text-xs">
                    <span className="font-semibold text-gray-600">Resolution:</span> {item.resolution_message.length > 120 ? item.resolution_message.slice(0, 120) + "..." : item.resolution_message}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
