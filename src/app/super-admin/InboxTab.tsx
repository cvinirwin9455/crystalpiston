"use client";

import { useState, useEffect, useRef } from "react";

type Thread = {
  thread_id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
  unread_count: number;
  direction: string;
};

type Message = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  read: boolean;
  created_at: string;
};

export default function InboxTab() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThreads();
  }, [showArchived]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function fetchThreads() {
    setLoading(true);
    try {
      const res = await fetch(`/api/inbound-emails?archived=${showArchived}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
        setTotalUnread(data.totalUnread || 0);
      }
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setLoading(false);
    }
  }

  async function openThread(threadId: string) {
    setSelectedThread(threadId);
    setLoadingMessages(true);
    setReplyText("");
    try {
      const res = await fetch(`/api/inbound-emails?thread_id=${threadId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        // Update unread count locally
        setThreads((prev) =>
          prev.map((t) =>
            t.thread_id === threadId ? { ...t, unread_count: 0 } : t
          )
        );
        setTotalUnread((prev) => {
          const thread = threads.find((t) => t.thread_id === threadId);
          return Math.max(0, prev - (thread?.unread_count || 0));
        });
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedThread || messages.length === 0) return;
    setSending(true);

    const thread = threads.find((t) => t.thread_id === selectedThread);
    const toEmail = thread?.from_email || messages[0]?.from_email;
    const subject = messages[0]?.subject || "";

    try {
      const res = await fetch("/api/inbound-emails/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: selectedThread,
          to_email: toEmail,
          subject,
          message: replyText.trim(),
        }),
      });

      if (res.ok) {
        setReplyText("");
        // Refresh thread messages
        await openThread(selectedThread);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send reply");
      }
    } catch (err) {
      alert("Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  async function archiveThread(threadId: string) {
    await fetch("/api/inbound-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, action: "archive" }),
    });
    setSelectedThread(null);
    setMessages([]);
    fetchThreads();
  }

  async function unarchiveThread(threadId: string) {
    await fetch("/api/inbound-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, action: "unarchive" }),
    });
    setSelectedThread(null);
    setMessages([]);
    fetchThreads();
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) return `${Math.round(diff / (1000 * 60))}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    if (hours < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatFullDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Thread list view
  if (!selectedThread) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Inbox</h2>
            {totalUnread > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                showArchived
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {showArchived ? "Viewing Archived" : "Show Archived"}
            </button>
            <button
              onClick={fetchThreads}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Thread list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 font-medium">
              {showArchived ? "No archived emails" : "No emails yet"}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Emails sent to hello@firstmilecoach.com will appear here
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {threads.map((thread, i) => (
              <button
                key={thread.thread_id}
                onClick={() => openThread(thread.thread_id)}
                className={`w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-gray-50 transition ${
                  i > 0 ? "border-t border-gray-100" : ""
                } ${thread.unread_count > 0 ? "bg-orange-50/50" : ""}`}
              >
                {/* Unread dot */}
                <div className="pt-1.5 w-3 flex-shrink-0">
                  {thread.unread_count > 0 && (
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm truncate ${
                        thread.unread_count > 0
                          ? "font-bold text-gray-900"
                          : "font-medium text-gray-700"
                      }`}
                    >
                      {thread.from_name || thread.from_email}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatDate(thread.last_message_at)}
                    </span>
                  </div>
                  <p
                    className={`text-sm truncate mt-0.5 ${
                      thread.unread_count > 0
                        ? "font-semibold text-gray-800"
                        : "text-gray-600"
                    }`}
                  >
                    {thread.subject}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-1">
                    {thread.last_message}
                  </p>
                </div>

                {/* Message count */}
                {thread.message_count > 1 && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {thread.message_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Thread detail view
  const currentThread = threads.find((t) => t.thread_id === selectedThread);

  return (
    <div className="space-y-4">
      {/* Back button + actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setSelectedThread(null);
            setMessages([]);
          }}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 transition"
        >
          ← Back to Inbox
        </button>
        <div className="flex items-center gap-2">
          {showArchived ? (
            <button
              onClick={() => unarchiveThread(selectedThread)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600 transition"
            >
              Unarchive
            </button>
          ) : (
            <button
              onClick={() => archiveThread(selectedThread)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500 transition"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Thread header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-bold text-gray-900">
          {messages[0]?.subject || currentThread?.subject || "(No subject)"}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Conversation with{" "}
          <span className="font-medium text-gray-700">
            {currentThread?.from_name || currentThread?.from_email}
          </span>
        </p>
      </div>

      {/* Messages */}
      {loadingMessages ? (
        <div className="text-center py-8 text-gray-400">Loading messages...</div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl border p-4 ${
                msg.direction === "outbound"
                  ? "bg-purple-50 border-purple-100 ml-8"
                  : "bg-white border-gray-200 mr-8"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      msg.direction === "outbound"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {msg.direction === "outbound" ? "You" : "Them"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {msg.direction === "inbound"
                      ? msg.from_name || msg.from_email
                      : `→ ${msg.to_email}`}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatFullDate(msg.created_at)}
                </span>
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {msg.body_text || "(No content)"}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Reply box */}
      {!showArchived && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            rows={4}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">
              Sending as First Mile Coach
            </p>
            <button
              onClick={sendReply}
              disabled={!replyText.trim() || sending}
              className="px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {sending ? "Sending..." : "Send Reply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
