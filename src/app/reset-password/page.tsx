"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Wait for session to be established from hash fragment
  useEffect(() => {
    const checkSession = async () => {
      // First check if there's already a session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setChecking(false);
        return;
      }

      // Wait for auth state change (hash token being processed)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          setChecking(false);
          subscription.unsubscribe();
        }
      });

      // Timeout: if no session after 5 seconds, redirect to login
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        setChecking(false);
        setError("Your reset link has expired. Please request a new one.");
      }, 5000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    };
    checkSession();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <p className="text-gray-400">Verifying your reset link...</p>
      </div>
    );
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Redirect to appropriate dashboard
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/IMG_5861.PNG" alt="Pistol Performance Coaching" width={150} height={150} className="mx-auto mb-4" />
          <h1 className="font-heading text-3xl uppercase text-white">
            New <span className="text-accent">Password</span>
          </h1>
          <p className="text-gray-400 mt-2">Enter your new password below</p>
        </div>

        <form onSubmit={handleReset} className="bg-secondary/50 border border-white/10 rounded-2xl p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
              placeholder="Re-enter password"
            />
          </div>

          <button type="submit" disabled={loading} className="w-full btn-primary text-center block disabled:opacity-50">
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
