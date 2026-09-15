"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBrandFromHost } from "@/lib/brand";
import { hasCoachAccess } from "@/lib/roles";

export default function ChooseViewPage() {
  const supabase = createClient();
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "coach" | "client">(null);
  const [allowed, setAllowed] = useState<{ coach: boolean; client: boolean }>({
    coach: false,
    client: false,
  });

  const brand = getBrandFromHost(
    typeof window !== "undefined" ? window.location.hostname : ""
  );
  const isFirstMile = brand.slug === "first-mile";
  const accent = isFirstMile ? "#f26522" : "#f26522";

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("users")
        .select("name, role, has_coach_access")
        .eq("id", user.id)
        .single();

      const { data: clientRow } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const caps = {
        coach: hasCoachAccess(profile),
        client: !!clientRow,
      };
      setAllowed(caps);
      setName(profile?.name?.split(" ")[0] || "");

      // If somehow they only have one capability, skip the chooser.
      if (caps.coach && !caps.client) {
        window.location.href = "/admin";
        return;
      }
      if (caps.client && !caps.coach) {
        window.location.href = "/dashboard";
        return;
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(view: "coach" | "client") {
    setBusy(view);
    try {
      await fetch("/api/preferred-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view }),
      });
    } catch {
      /* non-fatal — still navigate */
    }
    window.location.href = view === "coach" ? "/admin" : "/dashboard";
  }

  const bg = isFirstMile ? "#fafbfc" : "#0a0a0a";
  const cardBg = isFirstMile ? "#ffffff" : "rgba(255,255,255,0.04)";
  const cardBorder = isFirstMile ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const textPrimary = isFirstMile ? "#2d3436" : "#ffffff";
  const textMuted = isFirstMile ? "#555b5e" : "#9ca3af";

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: bg }}
      >
        <p style={{ color: textMuted }}>Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: bg }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-black"
            style={{ color: textPrimary }}
          >
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
          <p className="mt-2" style={{ color: textMuted }}>
            You have both a coaching account and a client account. Which would
            you like to open?
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Coaching */}
          <button
            onClick={() => choose("coach")}
            disabled={busy !== null}
            className="text-left rounded-2xl p-6 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: isFirstMile ? "0 4px 30px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <div className="text-4xl mb-3">🏋️</div>
            <h2
              className="text-xl font-bold mb-1"
              style={{ color: textPrimary }}
            >
              Coaching
            </h2>
            <p className="text-sm mb-4" style={{ color: textMuted }}>
              Manage your clients, build programs, and track sessions.
            </p>
            <span
              className="inline-block py-2 px-5 rounded-full font-bold text-sm"
              style={{ background: accent, color: "#ffffff" }}
            >
              {busy === "coach" ? "Opening…" : "Open coaching"}
            </span>
          </button>

          {/* My Training */}
          <button
            onClick={() => choose("client")}
            disabled={busy !== null}
            className="text-left rounded-2xl p-6 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: isFirstMile ? "0 4px 30px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <div className="text-4xl mb-3">🏃</div>
            <h2
              className="text-xl font-bold mb-1"
              style={{ color: textPrimary }}
            >
              My Training
            </h2>
            <p className="text-sm mb-4" style={{ color: textMuted }}>
              View your own training plan, workouts, and progress.
            </p>
            <span
              className="inline-block py-2 px-5 rounded-full font-bold text-sm"
              style={{
                background: isFirstMile ? "#2d3436" : "rgba(255,255,255,0.12)",
                color: "#ffffff",
              }}
            >
              {busy === "client" ? "Opening…" : "Open my training"}
            </span>
          </button>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: textMuted }}>
          You can switch between the two anytime from the menu.
        </p>
      </div>
    </div>
  );
}
