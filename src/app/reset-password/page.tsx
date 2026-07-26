"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getBrandFromHost } from "@/lib/brand";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const brand = getBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '');
  const isFirstMile = brand.slug === 'first-mile';

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
      <div className={`min-h-screen flex items-center justify-center ${isFirstMile ? '' : 'bg-primary'}`} style={isFirstMile ? { background: '#fafbfc' } : {}}>
        <p className={isFirstMile ? 'text-gray-500' : 'text-gray-400'}>Verifying your reset link...</p>
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

  // First Mile Coach — light theme
  if (isFirstMile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#fafbfc' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Image
              src="/firstmile/logo.png"
              alt="First Mile Coach"
              width={180}
              height={180}
              className="mx-auto mb-4 rounded-xl"
            />
            <h1 className="text-3xl font-black" style={{ color: '#2d3436' }}>
              New <span style={{ color: '#f26522' }}>Password</span>
            </h1>
            <p className="mt-2" style={{ color: '#555b5e' }}>Enter your new password below</p>
          </div>

          <form onSubmit={handleReset} className="rounded-2xl p-8 space-y-6" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm" style={{ background: '#fce4ec', border: '1px solid #ef9a9a', color: '#c62828' }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#2d3436' }}>New Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-4 py-3 outline-none transition-colors"
                style={{ background: '#fafbfc', border: '2px solid rgba(0,0,0,0.08)', color: '#2d3436' }}
                onFocus={(e) => { e.target.style.borderColor = '#f26522'; e.target.style.boxShadow = '0 0 0 3px rgba(242,101,34,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2" style={{ color: '#2d3436' }}>Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg px-4 py-3 outline-none transition-colors"
                style={{ background: '#fafbfc', border: '2px solid rgba(0,0,0,0.08)', color: '#2d3436' }}
                onFocus={(e) => { e.target.style.borderColor = '#f26522'; e.target.style.boxShadow = '0 0 0 3px rgba(242,101,34,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-center block py-3 px-8 rounded-full font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              style={{ background: '#f26522', color: '#ffffff' }}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Crystal Pistol — dark theme (original)
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
