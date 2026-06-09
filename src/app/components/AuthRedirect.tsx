"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// This component detects Supabase auth hash fragments on any page
// and redirects users to the appropriate destination
export default function AuthRedirect() {
  const supabase = createClient();

  useEffect(() => {
    const handleHash = async () => {
      const hash = window.location.hash;

      // Only act if there's an auth-related hash fragment
      if (!hash || (!hash.includes("access_token") && !hash.includes("error=access_denied"))) {
        return;
      }

      // If there's an error (expired token, etc.)
      if (hash.includes("error")) {
        const params = new URLSearchParams(hash.substring(1));
        const errorDesc = params.get("error_description") || "";
        if (errorDesc.includes("expired")) {
          window.location.href = "/login?error=link_expired";
        }
        return;
      }

      // If there's an access token, Supabase will pick it up automatically
      if (hash.includes("access_token")) {
        // Give Supabase a moment to process the token
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Redirect to set-password for invited users
          window.location.href = "/set-password";
        }
      }
    };

    handleHash();
  }, [supabase]);

  return null; // This component renders nothing
}
