"use client";

import { useEffect, useRef } from "react";

// This component detects Supabase auth events (like invite link clicks)
// and redirects invited users to the set-password page
export default function AuthRedirect() {
  const handled = useRef(false);

  useEffect(() => {
    // Check for hash fragment immediately (before Supabase processes it)
    const hash = window.location.hash;
    const hasAuthHash = hash && (hash.includes("access_token") || hash.includes("error"));

    if (!hasAuthHash) return;
    if (handled.current) return;
    handled.current = true;

    // If there's an error (expired token, etc.)
    if (hash.includes("error")) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description") || "";
      if (errorDesc.includes("expired")) {
        window.location.href = "/login?error=link_expired";
      }
      return;
    }

    // If there's an access token (invite or recovery link)
    if (hash.includes("access_token")) {
      // Determine if this is a password recovery or an invite
      const isRecovery = hash.includes("type=recovery");
      const targetPage = isRecovery ? "/reset-password" : "/set-password";

      const handleAuth = async () => {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        // Listen for the session to be established
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
            subscription.unsubscribe();
            // Small delay to ensure session is fully set
            setTimeout(() => {
              window.location.href = targetPage;
            }, 200);
          }
        });

        // Also try immediately in case session is already available
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          subscription.unsubscribe();
          window.location.href = targetPage;
        }
      };

      handleAuth();
    }
  }, []);

  return null;
}
