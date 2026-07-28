"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBrandFromHost } from "@/lib/brand";

/**
 * Floating Feedback / Bug Report button that appears on all pages for authenticated users.
 * Positioned bottom-left to avoid conflict with the AI Coach button (bottom-right on admin pages).
 */
export default function FeedbackButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<"coach" | "client">("client");
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<"bug" | "feedback">("feedback");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect brand from current hostname
  const [platform, setPlatform] = useState<"crystal-pistol" | "first-mile">("crystal-pistol");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const brand = getBrandFromHost(window.location.hostname);
      setPlatform(brand.slug);
    }
  }, []);

  // Check authentication status
  useEffect(() => {
    const supabase = createClient();
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
        // Determine role: check if on admin page or if user has admin role
        const isAdminPage = window.location.pathname.startsWith("/admin");
        if (isAdminPage) {
          setUserRole("coach");
        } else {
          // Try to determine role from user metadata or page context
          setUserRole("client");
        }
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle screenshot file selection
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Screenshot must be under 5MB");
        return;
      }
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setScreenshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload screenshot to Supabase storage
  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotFile) return null;

    try {
      const supabase = createClient();
      const fileExt = screenshotFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("feedback-screenshots")
        .upload(fileName, screenshotFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error("Screenshot upload error:", error);
        // Don't block submission — just skip screenshot
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("feedback-screenshots")
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (err) {
      console.error("Screenshot upload failed:", err);
      return null;
    }
  };

  // Submit feedback
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe the issue or suggestion");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Upload screenshot if provided
      let screenshotUrl: string | null = null;
      if (screenshotFile) {
        screenshotUrl = await uploadScreenshot();
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          description: description.trim(),
          priority: type === "bug" ? priority : "medium",
          pageUrl: window.location.href,
          platform,
          userRole,
          screenshotUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
      // Reset form after showing success
      setTimeout(() => {
        setShowModal(false);
        setSubmitted(false);
        setDescription("");
        setPriority("medium");
        setType("feedback");
        setScreenshotFile(null);
        setScreenshotPreview(null);
      }, 2500);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Don't render if not authenticated
  if (!isAuthenticated) return null;

  // Don't render on the marketing/landing pages or super-admin
  if (typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "/login" || window.location.pathname.startsWith("/super-admin"))) {
    return null;
  }

  return (
    <>
      {/* Floating Button — bottom-left */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg bg-[#1a1a2e] border border-[#2a2a4e] hover:bg-[#2a2a4e] transition-all hover:scale-105 text-white text-sm font-medium always-dark"
        title="Report a bug or give feedback"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        Feedback
      </button>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !submitting && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-[#16213e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden always-dark">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">
                {submitted ? "Thank You!" : "Report a Bug or Give Feedback"}
              </h2>
              {!submitting && !submitted && (
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Success State */}
            {submitted ? (
              <div className="px-6 py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white text-lg font-semibold mb-2">Submitted successfully!</p>
                <p className="text-gray-400 text-sm">We'll review it and follow up with you via email.</p>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Type Toggle */}
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setType("bug")}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                        type === "bug"
                          ? "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Bug Report
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("feedback")}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                        type === "feedback"
                          ? "bg-green-500/20 text-green-400 border border-green-500/40"
                          : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Suggestion
                      </span>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">
                    {type === "bug" ? "What went wrong?" : "What would you like to see?"}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      type === "bug"
                        ? "Describe the bug — what happened, what you expected, and any steps to reproduce it..."
                        : "Describe your idea or suggestion for improvement..."
                    }
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 resize-none"
                  />
                </div>

                {/* Priority (for bugs only) */}
                {type === "bug" && (
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Priority</label>
                    <div className="flex gap-2">
                      {(["low", "medium", "high"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold capitalize transition-all ${
                            priority === p
                              ? p === "high"
                                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                                : p === "medium"
                                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                                : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                              : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screenshot Upload (Optional) */}
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">
                    Screenshot <span className="text-gray-500 normal-case">(optional)</span>
                  </label>
                  {screenshotPreview ? (
                    <div className="relative">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="w-full h-32 object-cover rounded-lg border border-white/10"
                      />
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 px-4 border border-dashed border-white/20 rounded-lg text-gray-400 text-sm hover:border-white/40 hover:text-gray-300 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Attach a screenshot
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="hidden"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="w-full py-3 px-4 rounded-lg bg-accent hover:bg-accent/90 text-white font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    `Submit ${type === "bug" ? "Bug Report" : "Feedback"}`
                  )}
                </button>

                {/* Context info */}
                <p className="text-center text-xs text-gray-500">
                  Your page location is included automatically to help us investigate.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
