"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasCoachAccess } from "@/lib/roles";

/**
 * Renders a "switch view" menu item ONLY for dual-role users (those with both
 * coach capability and a client record). Single-role users render nothing, so
 * this is safe to drop into either the admin or the dashboard header.
 *
 * @param current  Which area this switcher is being rendered in.
 * @param variant  Styling preset — 'admin' (dark) or 'dashboard' (dark) or
 *                 'dashboard-light' (First Mile light theme). Falls back to a
 *                 neutral style.
 * @param mobile   Slightly larger tap targets for mobile menus.
 */
export default function AccountSwitcher({
  current,
  variant = "admin",
  mobile = false,
  impersonating = false,
  impersonatedCoachIsDual = false,
}: {
  current: "coach" | "client";
  variant?: "admin" | "dashboard" | "dashboard-light";
  mobile?: boolean;
  // Super-admin "view as coach" context. When impersonating, visibility of the
  // switcher must reflect the VIEWED coach (not the real logged-in user): only
  // show "Switch to My Training" if that coach also has a linked client account.
  impersonating?: boolean;
  impersonatedCoachIsDual?: boolean;
}) {
  const supabase = createClient();
  const [isDual, setIsDual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // While impersonating, the real user's own dual-role status is irrelevant —
    // the switcher must reflect the coach being viewed, handled below.
    if (impersonating) return;
    let cancelled = false;
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("users")
        .select("role, has_coach_access")
        .eq("id", user.id)
        .single();
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setIsDual(hasCoachAccess(profile) && !!clientRow);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impersonating]);

  // Visibility:
  //  - Normal use: show for dual-role users.
  //  - Impersonating: show ONLY if the VIEWED coach is dual-role. (If they have
  //    no client account — like a coach-only account — don't offer it at all.)
  if (impersonating) {
    if (!impersonatedCoachIsDual) return null;
  } else if (!isDual) {
    return null;
  }

  // Switching means: go to the OTHER view.
  const target: "coach" | "client" = current === "coach" ? "client" : "coach";
  const label =
    target === "coach" ? "Switch to Coaching" : "Switch to My Training";

  async function handleSwitch() {
    if (busy || impersonating) return;
    setBusy(true);
    try {
      await fetch("/api/preferred-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: target }),
      });
    } catch {
      /* non-fatal */
    }
    window.location.href = target === "coach" ? "/admin" : "/dashboard";
  }

  const icon = (
    <svg
      className={mobile ? "w-5 h-5" : "w-4 h-4"}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );

  const isLight = variant === "dashboard-light";
  const base = mobile
    ? "w-full flex items-center gap-3 text-sm py-3 px-4 transition-colors active:bg-black/5"
    : "w-full flex items-center gap-2.5 text-xs py-2 px-3 transition-colors";
  const colors = isLight
    ? "text-gray-700 hover:bg-black/5 hover:text-black"
    : "text-accent hover:bg-white/5 hover:text-white";

  return (
    <button
      onClick={handleSwitch}
      disabled={busy || impersonating}
      title={
        impersonating
          ? "This coach also has a client account. Switching into their training isn't available from view-as mode."
          : undefined
      }
      className={`${base} ${colors} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon}
      {busy ? "Switching…" : label}
    </button>
  );
}
