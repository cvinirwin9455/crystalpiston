"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page handles all Supabase auth redirects:
// 1. PKCE flow: ?code=xxx (newer Supabase default with custom SMTP)
// 2. Hash fragment flow: #access_token=xxx (older/implicit flow)
// 3. Token hash flow: ?token_hash=xxx&type=xxx
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const next = params.get("next");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const hash = window.location.hash;

      // 1. PKCE flow: exchange code for session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          // Determine where to go
          if (next) {
            router.push(next);
          } else {
            // Check if user has signed in before (has set password)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

              // If user has never signed in (invited but no last_sign_in), go to set-password
              if (!user.last_sign_in_at || user.last_sign_in_at === user.created_at) {
                router.push("/set-password");
              } else if (profile?.role === "admin") {
                router.push("/admin");
              } else {
                router.push("/dashboard");
              }
            } else {
              router.push("/set-password");
            }
          }
          return;
        } else {
          console.error("Code exchange failed:", error);
        }
      }

      // 2. Hash fragment flow: #access_token=...
      if (hash && hash.includes("access_token")) {
        const isRecovery = hash.includes("type=recovery");
        const targetPage = isRecovery ? "/reset-password" : "/set-password";

        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          router.push(targetPage);
          return;
        }
      }

      // 3. Error in hash
      if (hash && hash.includes("error")) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const error = hashParams.get("error_description") || "Authentication error";
        router.push(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      // 4. Token hash flow (older email links)
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
