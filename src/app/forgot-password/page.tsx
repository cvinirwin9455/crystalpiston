"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center bg-secondary/50 border border-white/10 rounded-2xl p-8">
          <div className="text-green-400 text-5xl mb-4">✓</div>
          <h2 className="font-heading text-2xl uppercase text-white mb-2">Check your email</h2>
          <p className="text-gray-400">
            We sent a password reset link to <strong className="text-white">{email}</strong>
          </p>
          <a href="/login" className="inline-block mt-6 text-accent hover:underline text-sm">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/IMG_5861.PNG" alt="Pistol Performance Coaching" width={150} height={150} className="mx-auto mb-4" />
          <h1 className="font-heading text-3xl uppercase text-white">
            Reset <span className="text-accent">Password</span>
          </h1>
          <p className="text-gray-400 mt-2">Enter your email and we&apos;ll send you a reset link</p>
        </div>

        <form onSubmit={handleReset} className="bg-secondary/50 border border-white/10 rounded-2xl p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-primary/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <button type="submit" disabled={loading} className="w-full btn-primary text-center block disabled:opacity-50">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <p className="text-center">
            <a href="/login" className="text-accent hover:underline text-sm">Back to login</a>
          </p>
        </form>
      </div>
    </div>
  );
}
