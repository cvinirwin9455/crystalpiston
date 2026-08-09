"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getBrandFromHost } from "@/lib/brand";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const brand = getBrandFromHost(mounted ? window.location.hostname : 'firstmilecoach.com');
  const isFirstMile = brand.slug === 'first-mile';

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, brand: brand.slug }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      // Temporary debug - show what the API returned
      if (data.debug) {
        console.log('[forgot-password] API response:', JSON.stringify(data.debug));
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // First Mile Coach — light theme
  if (isFirstMile) {
    if (success) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#fafbfc' }}>
          <div className="w-full max-w-md text-center rounded-2xl p-8" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
            <div className="text-5xl mb-4" style={{ color: '#22c55e' }}>&#10003;</div>
            <h2 className="text-2xl font-black mb-2" style={{ color: '#2d3436' }}>Check your email</h2>
            <p style={{ color: '#555b5e' }}>
              We sent a password reset link to <strong style={{ color: '#2d3436' }}>{email}</strong>
            </p>
            <a href="/login" className="inline-block mt-6 text-sm font-medium hover:underline" style={{ color: '#f26522' }}>
              Back to login
            </a>
          </div>
        </div>
      );
    }

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
              Reset <span style={{ color: '#f26522' }}>Password</span>
            </h1>
            <p className="mt-2" style={{ color: '#555b5e' }}>Enter your email and we&apos;ll send you a reset link</p>
          </div>

          <form onSubmit={handleReset} className="rounded-2xl p-8 space-y-6" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm" style={{ background: '#fce4ec', border: '1px solid #ef9a9a', color: '#c62828' }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#2d3436' }}>Email</label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-4 py-3 outline-none transition-colors"
                style={{ background: '#fafbfc', border: '2px solid rgba(0,0,0,0.08)', color: '#2d3436' }}
                onFocus={(e) => { e.target.style.borderColor = '#f26522'; e.target.style.boxShadow = '0 0 0 3px rgba(242,101,34,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-center block py-3 px-8 rounded-full font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              style={{ background: '#f26522', color: '#ffffff' }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <p className="text-center text-sm">
              <a href="/login" className="hover:underline" style={{ color: '#f26522' }}>Back to login</a>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Crystal Pistol — dark theme (original)
  if (success) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center bg-secondary/50 border border-white/10 rounded-2xl p-8">
          <div className="text-green-400 text-5xl mb-4">&#10003;</div>
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
