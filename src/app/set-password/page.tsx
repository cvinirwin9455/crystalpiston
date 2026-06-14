"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let resolved = false;
    
    const checkSession = async () => {
      // First check if there's already a session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        resolved = true;
        setChecking(false);
        return;
      }

      // Wait for auth state change (hash token being processed)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          resolved = true;
          setChecking(false);
          subscription.unsubscribe();
        }
      });

      // Timeout: if no session after 8 seconds, redirect to login
      setTimeout(() => {
        subscription.unsubscribe();
        if (!resolved) {
          router.push("/login");
        }
      }, 8000);
    };
    checkSession();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
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

    // Get user role to redirect
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

  if (checking) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/IMG_5861.PNG" alt="Pistol Performance Coaching" width={150} height={150} className="mx-auto mb-4" />
          <h1 className="font-heading text-3xl uppercase text-white">
            Welcome to <span className="text-accent">Pistol Performance!</span>
          </h1>
          <p className="text-gray-400 mt-2">Set your password to get started</p>
        </div>

        <form onSubmit={handleSetPassword} className="bg-secondary/50 border border-white/10 rounded-2xl p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Create Password</label>
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
            {loading ? "Setting password..." : "Set Password & Get Started"}
          </button>
        </form>
      </div>
    </div>
  );
}
