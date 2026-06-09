"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page handles hash fragment redirects from Supabase email links
// Supabase sends tokens as hash fragments (#access_token=...) which don't reach the server
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Check if there's a hash fragment with tokens
      const hash = window.location.hash;

      if (hash && hash.includes("access_token")) {
        // Give Supabase a moment to process the token
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          router.push("/set-password");
          return;
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

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <p className="text-gray-400">Verifying your link...</p>
    </div>
  );
}
