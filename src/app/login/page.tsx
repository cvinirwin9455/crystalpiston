"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Check for hash fragments (invite/recovery links that landed here by mistake)
  // Also check for error params
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      if (hash.includes("type=recovery")) {
        window.location.replace("/reset-password" + hash);
        return;
      } else {
        window.location.replace("/set-password" + hash);
        return;
      }
    }
    if (hash && hash.includes("error")) {
      setError("Your invite link has expired or is invalid. Contact Crystal for a new one.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "link_expired") {
      setError("Your invite link has expired. Contact Crystal for a new one.");
    } else if (err === "auth_code_error") {
      setError("Authentication failed. Please try again or contact Crystal for a new invite.");
    } else if (err) {
      setError("Authentication error. Please try again.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Get user role to redirect appropriately
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();



      if (profile?.role === "admin") {
        window.location.href = "/admin";
        return;
      } else {
        window.location.href = "/dashboard";
        return;
      }
    }

    router.refresh();
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/IMG_5861.PNG"
            alt="Pistol Performance Coaching"
            width={150}
            height={150}
            className="mx-auto mb-4"
          />
          <h1 className="font-heading text-3xl uppercase text-white">
            Client <span className="text-accent">Portal</span>
          </h1>
          <p className="text-gray-400 mt-2">
            Log in to track your training progress
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-secondary/50 border border-white/10 rounded-2xl p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary text-center block disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Log In"}
          </button>

          <p className="text-center text-gray-500 text-sm">
            <a href="/forgot-password" className="text-accent hover:underline">
              Forgot your password?
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
