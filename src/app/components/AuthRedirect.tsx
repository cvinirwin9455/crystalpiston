"use client";

import { useEffect, useRef } from "react";

// This component detects Supabase auth events (like invite link clicks)
// and redirects invited users to the set-password page
export default function AuthRedirect() {
  const handled = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;
    const path = window.location.pathname;

    // Don't redirect if already on target pages
    if (path === '/set-password' || path === '/reset-password') return;

    if (!hash) return;
    if (handled.current) return;
    handled.current = true;

    // If there's an error (expired token, etc.)
    if (hash.includes("error")) {
      window.location.href = "/login?error=link_expired";
      return;
    }

    // If there's an access token (invite or recovery link)
    if (hash.includes("access_token")) {
      if (hash.includes("type=recovery")) {
        window.location.replace("/reset-password" + hash);
      } else {
        window.location.replace("/set-password" + hash);
      }
    }
  }, []);

  return null;
}
