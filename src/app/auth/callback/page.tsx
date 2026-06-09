"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// This page handles hash fragment redirects from Supabase email links
// Supabase sends tokens as hash fragments (#access_token=...) which don't reach the server
export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleHashCallback = async () => {
      // Check if there's a hash fragment with tokens
      const hash = window.location.hash;
      
      if (hash && hash.includes("access_token")) {
        // Supabase client library will automatically pick up the hash tokens
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          // Check if this is a new user who needs to set password
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("users")
              .select("role")
              .eq("id", user.id)
              .single();

            // New invited users go to set-password
            // Check if user was just invited (no password set yet)
            router.push("/set-password");
            return;
          }
        }
      }

      // If there's an error in the hash
      if (hash && hash.includes("error")) {
        const params = new URLSearchParams(hash.substring(1));
        const error = params.get("error_description") || "Authentication error";
        router.push(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      // Fallback: check for query params (token_hash flow)
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash && type) {
        if (type === "invite" || type === "magiclink") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (!error) {
            router.push("/set-password");
            return;
          }
        }
        if (type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (!error) {
            router.push("/reset-password");
            return;
          }
        }
      }

      // If nothing matched, go to login
      router.push("/login");
    };

    handleHashCallback();
  }, [supabase, router]);

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <p className="text-gray-400">Verifying your link...</p>
    </div>
  );
}
