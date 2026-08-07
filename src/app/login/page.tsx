"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrandFromHost } from "@/lib/brand";
import { startAuthentication } from "@simplewebauthn/browser";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const brand = getBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '');
  const isFirstMile = brand.slug === 'first-mile';
  const roleParam = searchParams.get('role');
  const isClientLogin = roleParam === 'client';

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
      setError("Your invite link has expired or is invalid. Please request a new one.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "link_expired") {
      setError("Your invite link has expired. Please request a new one.");
    } else if (err === "auth_code_error") {
      setError("Authentication failed. Please try again or request a new invite.");
    } else if (err) {
      setError("Authentication error. Please try again.");
    }
  }, []);

  // Check if WebAuthn/biometric login is available on this device
  useEffect(() => {
    async function checkBiometric() {
      if (typeof window === "undefined") return;
      if (!window.PublicKeyCredential) return;

      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvailable(available);

        // Check if we have a saved email that has credentials
        const savedEmail = localStorage.getItem("biometric-email");
        if (savedEmail && available) {
          setEmail(savedEmail);
          setShowBiometric(true);
        }
      } catch {
        setBiometricAvailable(false);
      }
    }
    checkBiometric();
  }, []);

  // When email changes, check if biometric is available for that email
  useEffect(() => {
    if (!biometricAvailable || !email || email.length < 5) {
      setShowBiometric(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/webauthn/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setShowBiometric(data.hasCredentials === true);
      } catch {
        setShowBiometric(false);
      }
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [email, biometricAvailable]);

  const handleBiometricLogin = async () => {
    setError("");
    setBiometricLoading(true);

    try {
      // Step 1: Get authentication options
      const optionsRes = await fetch("/api/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.error || "Failed to start biometric login");
      }

      const options = await optionsRes.json();

      // Step 2: Trigger biometric prompt (Face ID / Touch ID)
      const authResponse = await startAuthentication({ optionsJSON: options });

      // Step 3: Verify with server
      const verifyRes = await fetch("/api/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, response: authResponse }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "Biometric verification failed");
      }

      const { verified, tokenHash, email: verifiedEmail } = await verifyRes.json();

      if (!verified || !tokenHash) {
        throw new Error("Verification failed");
      }

      // Step 4: Establish Supabase session using the token
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });

      if (otpError) {
        throw new Error(otpError.message);
      }

      // Save email for next time
      localStorage.setItem("biometric-email", email);

      // Redirect based on role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/dashboard";
        }
      }
    } catch (err: any) {
      console.error("Biometric login error:", err);
      setError(err.message || "Biometric login failed. Please use your password.");
    } finally {
      setBiometricLoading(false);
    }
  };

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
      const { data: profile } = await supabase
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

  // First Mile Coach login — light theme
  if (isFirstMile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#fafbfc' }}>
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Image
              src="/firstmile/logo.png"
              alt="First Mile Coach"
              width={180}
              height={180}
              className="mx-auto mb-4 rounded-xl"
            />
            <h1 className="text-3xl font-black" style={{ color: '#2d3436' }}>
              {isClientLogin ? 'Client' : 'Coach'} <span style={{ color: '#f26522' }}>Login</span>
            </h1>
            <p className="mt-2" style={{ color: '#555b5e' }}>
              {isClientLogin ? 'Log in to view your training plan' : 'Log in to manage your clients'}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-6" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm" style={{ background: '#fce4ec', border: '1px solid #ef9a9a', color: '#c62828' }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#2d3436' }}>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-4 py-3 outline-none transition-colors"
                style={{ background: '#fafbfc', border: '2px solid rgba(0,0,0,0.08)', color: '#2d3436' }}
                onFocus={(e) => { e.target.style.borderColor = '#f26522'; e.target.style.boxShadow = '0 0 0 3px rgba(242,101,34,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#2d3436' }}>
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-4 py-3 outline-none transition-colors"
                style={{ background: '#fafbfc', border: '2px solid rgba(0,0,0,0.08)', color: '#2d3436' }}
                onFocus={(e) => { e.target.style.borderColor = '#f26522'; e.target.style.boxShadow = '0 0 0 3px rgba(242,101,34,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-center block py-3 px-8 rounded-full font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              style={{ background: '#f26522', color: '#ffffff' }}
            >
              {loading ? "Signing in..." : "Log In"}
            </button>

            {showBiometric && (
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="w-full text-center block py-3 px-8 rounded-full font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
                style={{ background: '#2d3436', color: '#ffffff', marginTop: '12px' }}
              >
                {biometricLoading ? "Verifying..." : (
                  <>&#x1F9EC; Sign in with Face ID / Touch ID</>
                )}
              </button>
            )}

            <p className="text-center text-sm" style={{ color: '#9e9e9e' }}>
              <a href="/forgot-password" className="hover:underline" style={{ color: '#f26522' }}>
                Forgot your password?
              </a>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Crystal Pistol login — dark theme (original)
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

          {showBiometric && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="w-full text-center block py-3 px-8 rounded-full font-bold transition-all duration-300 border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {biometricLoading ? "Verifying..." : (
                <>&#x1F9EC; Sign in with Face ID / Touch ID</>
              )}
            </button>
          )}

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


export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#fafbfc' }}><p style={{ color: '#555b5e' }}>Loading...</p></div>}>
      <LoginContent />
    </Suspense>
  );
}
