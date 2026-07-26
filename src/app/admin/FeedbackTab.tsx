"use client";

import { useState, useEffect } from "react";

type FeedbackItem = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  platform: "crystal-pistol" | "first-mile";
  user_role: "coach" | "client";
  type: "bug" | "feedback";
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

type FilterState = {
  status: string;
  type: string;
  platform: string;
  userRole: string;
};

export default function FeedbackTab() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [view, setView] = useState<"inbox" | "implemented">("inbox");

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    status: "",
    type: "",
    platform: "",
    userRole: "",
  });

  // Edit state for detail view
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editResolution, setEditResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch feedback
  const fetchFeedback = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (view === "implemented") {
        params.set("status", "implemented");
      } else {
        if (filters.status) params.set("status", filters.status);
      }
      if (filters.type) params.set("type", filters.type);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.userRole) params.set("user_role", filters.userRole);
      params.set("limit", "100");

      const res = await fetch(`/api/feedback/admin?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load feedback");
      const data = await res.json();
      setFeedback(data.feedback || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [filters, view]);

  // Open detail view
  const openDetail = (item: FeedbackItem) => {
    setSelectedItem(item);
    setEditStatus(item.status);
    setEditNotes(item.admin_notes || "");
    setEditResolution(item.resolution_message || "");
    setSaveSuccess(false);
  };

  // Save updates
  const handleSave = async (sendEmail: boolean) => {
    if (!selectedItem) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const body: any = {
        feedbackId: selectedItem.id,
        status: editStatus,
        adminNotes: editNotes,
      };

      // Only include resolutionMessage if sendEmail is true (triggers email to user)
      if (sendEmail && editResolution.trim()) {
        body.resolutionMessage = editResolution.trim();
      } else if (!sendEmail) {
        // Save resolution text without triggering email (only if unchanged)
        if (editResolution !== (selectedItem.resolution_message || "")) {
          body.resolutionMessage = editResolution.trim() || null;
        }
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
      // Update local state
      setFeedback((prev) =>
        prev.map((f) => (f.id === selectedItem.id ? data.feedback : f))
      );
      setSelectedItem(data.feedback);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      new: "bg-blue-500/20 text-blue-400 border-blue-500/40",
      in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
      implemented: "bg-green-500/20 text-green-400 border-green-500/40",
      wont_fix: "bg-gray-500/20 text-gray-400 border-gray-500/40",
    };
    const labels: Record<string, string> = {
      new: "New",
      in_progress: "In Progress",
      implemented: "Implemented",
      wont_fix: "Won't Fix",
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.new}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Priority badge
  const PriorityBadge = ({ priority }: { priority: string }) => {
    const styles: Record<string, string> = {
      high: "text-red-400",
      medium: "text-yellow-400",
      low: "text-blue-400",
    };
    return (
      <span className={`text-xs font-semibold capitalize ${styles[priority] || "text-gray-400"}`}>
        {priority}
      </span>
    );
  };

  // Type badge
  const TypeBadge = ({ type }: { type: string }) => {
    if (type === "bug") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Bug
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Feedback
      </span>
    );
  };

  // Detail View
  if (selectedItem) {
    return (
      <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
        {/* Back button */}
        <button
          onClick={() => setSelectedItem(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <TypeBadge type={selectedItem.type} />
              <StatusBadge status={selectedItem.status} />
              {selectedItem.type === "bug" && <PriorityBadge priority={selectedItem.priority} />}
            </div>
            <h3 className="text-white text-lg font-bold">
              {selectedItem.type === "bug" ? "Bug Report" : "Feature Feedback"} from {selectedItem.user_name || "Unknown"}
            </h3>
            <p className="text-gray-400 text-sm">
              {selectedItem.user_email} &bull; {selectedItem.user_role === "coach" ? "Coach" : "Client"} &bull;{" "}
              {selectedItem.platform === "crystal-pistol" ? "Crystal Pistol" : "First Mile"} &bull;{" "}
              {formatDateTime(selectedItem.created_at)}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Description</p>
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
        </div>

        {/* Context: Page URL */}
        {selectedItem.page_url && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Page URL</p>
            <p className="text-blue-400 text-sm break-all">{selectedItem.page_url}</p>
          </div>
        )}

        {/* Screenshot */}
        {selectedItem.screenshot_url && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Screenshot</p>
            <a href={selectedItem.screenshot_url} target="_blank" rel="noopener noreferrer">
              <img
                src={selectedItem.screenshot_url}
                alt="Bug screenshot"
                className="max-w-full max-h-64 rounded-lg border border-white/10 hover:border-accent/50 transition-colors cursor-pointer"
              />
            </a>
          </div>
        )}

        {/* Admin Controls */}
        <div className="space-y-4 border-t border-white/10 pt-6">
          <h4 className="text-white text-sm font-bold uppercase tracking-wider">Admin Controls</h4>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Status</label>
            <div className="flex gap-2 flex-wrap">
              {(["new", "in_progress", "implemented", "wont_fix"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setEditStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    editStatus === s
                      ? s === "new"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                        : s === "in_progress"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                        : s === "implemented"
                        ? "bg-green-500/20 text-green-400 border border-green-500/40"
                        : "bg-gray-500/20 text-gray-400 border border-gray-500/40"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
                  }`}
                >
                  {s === "new" ? "New" : s === "in_progress" ? "In Progress" : s === "implemented" ? "Implemented" : "Won't Fix"}
                </button>
              ))}
            </div>
          </div>

          {/* Admin Notes (internal) */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">
              Internal Notes <span className="text-gray-600 normal-case">(only you see these)</span>
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Internal notes about this item..."
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>

          {/* Resolution Message (sent to user) */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">
              Message to User <span className="text-gray-600 normal-case">(sent via email when you click &ldquo;Save &amp; Notify&rdquo;)</span>
            </label>
            <textarea
              value={editResolution}
              onChange={(e) => setEditResolution(e.target.value)}
              placeholder="Write a message to the user about the status of their report..."
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save (No Email)"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || !editResolution.trim()}
              className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save & Notify User"}
            </button>
          </div>

          {/* Success message */}
          {saveSuccess && (
            <p className="text-green-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved successfully!
            </p>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-200px)]">
      {/* View Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView("inbox")}
          className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
            view === "inbox" ? "text-white border-accent" : "text-gray-400 border-transparent hover:text-gray-300"
          }`}
        >
          Inbox
        </button>
        <button
          onClick={() => setView("implemented")}
          className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
            view === "implemented" ? "text-white border-accent" : "text-gray-400 border-transparent hover:text-gray-300"
          }`}
        >
          Improvements Log
        </button>
        <span className="ml-auto text-xs text-gray-500">{total} total</span>
      </div>

      {/* Filters (inbox only) */}
      {view === "inbox" && (
        <div className="flex flex-wrap gap-2">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-accent/50"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="implemented">Implemented</option>
            <option value="wont_fix">Won&apos;t Fix</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-accent/50"
          >
            <option value="">All Types</option>
            <option value="bug">Bugs</option>
            <option value="feedback">Feedback</option>
          </select>
          <select
            value={filters.platform}
            onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-accent/50"
          >
            <option value="">All Platforms</option>
            <option value="crystal-pistol">Crystal Pistol</option>
            <option value="first-mile">First Mile</option>
          </select>
          <select
            value={filters.userRole}
            onChange={(e) => setFilters({ ...filters, userRole: e.target.value })}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-accent/50"
          >
            <option value="">All Roles</option>
            <option value="coach">Coaches</option>
            <option value="client">Clients</option>
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">Loading feedback...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="py-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && feedback.length === 0 && (
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">
            {view === "implemented" ? "No improvements logged yet." : "No feedback or bug reports yet."}
          </p>
          <p className="text-gray-600 text-xs mt-1">
            {view === "inbox" ? "When users submit reports, they'll appear here." : "Items marked as implemented will show here."}
          </p>
        </div>
      )}

      {/* Feedback List */}
      {!loading && feedback.length > 0 && (
        <div className="space-y-2">
          {feedback.map((item) => (
            <button
              key={item.id}
              onClick={() => openDetail(item)}
              className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <TypeBadge type={item.type} />
                    <StatusBadge status={item.status} />
                    {item.type === "bug" && <PriorityBadge priority={item.priority} />}
                  </div>
                  <p className="text-white text-sm font-medium truncate mb-1">
                    {item.description.length > 100 ? item.description.slice(0, 100) + "..." : item.description}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {item.user_name || item.user_email} &bull;{" "}
                    {item.platform === "crystal-pistol" ? "Crystal Pistol" : "First Mile"} &bull;{" "}
                    {item.user_role === "coach" ? "Coach" : "Client"} &bull;{" "}
                    {formatDate(item.created_at)}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Show resolution summary in implemented view */}
              {view === "implemented" && item.resolution_message && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-gray-400 text-xs italic truncate">
                    Resolution: {item.resolution_message}
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
