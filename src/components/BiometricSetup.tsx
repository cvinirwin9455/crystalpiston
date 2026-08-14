"use client";

import { useState, useEffect } from "react";

export default function BiometricSetup() {
  const [available, setAvailable] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [credentials, setCredentials] = useState<{ id: string; deviceType: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      // Check if platform authenticator is available
      if (!window.PublicKeyCredential) {
        setLoading(false);
        return;
      }

      try {
        const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setAvailable(isAvailable);

        if (isAvailable) {
          // Check if user already has credentials
          const res = await fetch("/api/webauthn/check");
          if (res.ok) {
            const data = await res.json();
            setRegistered(data.hasCredentials);
            setCredentials(data.credentials || []);
          }
        }
      } catch {
        setAvailable(false);
      }

      setLoading(false);
    }

    init();
  }, []);

  async function handleRegister() {
    setRegistering(true);
    setError("");
    setMessage("");

    try {
      // Get registration options from server
      const optionsRes = await fetch("/api/webauthn/register");
      if (!optionsRes.ok) {
        throw new Error("Failed to get registration options");
      }
      const options = await optionsRes.json();

      // Trigger biometric prompt
      const { startRegistration } = await import("@simplewebauthn/browser");
      const regResponse = await startRegistration({ optionsJSON: options });

      // Verify with server
      const verifyRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regResponse),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "Registration failed");
      }

      const result = await verifyRes.json();
      if (result.verified) {
        setRegistered(true);
        setMessage("Biometric login enabled! You can now use Face ID or Touch ID to sign in.");
        // Save email for biometric login on the login page
        const email = document.querySelector<HTMLElement>('[data-user-email]')?.dataset?.userEmail;
        if (email) {
          localStorage.setItem("biometric-email", email);
        }
        // Refresh credentials list
        const checkRes = await fetch("/api/webauthn/check");
        if (checkRes.ok) {
          const data = await checkRes.json();
          setCredentials(data.credentials || []);
        }
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Biometric registration was cancelled.");
      } else {
        setError(err.message || "Something went wrong. Try again.");
      }
    } finally {
      setRegistering(false);
    }
  }

  if (loading) return null;
  if (!available) return null; // Don't show section if device doesn't support biometrics

  return (
    <div className="bg-secondary/50 border border-white/10 rounded-2xl p-6">
      <h2 className="font-heading text-xl uppercase text-accent mb-4">Biometric Login</h2>
      <p className="text-gray-300 text-sm mb-4">
        Use Face ID or Touch ID to sign in quickly without typing your password.
      </p>

      {registered ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400 text-sm font-medium">Biometric login is enabled</span>
          </div>

          {credentials.length > 0 && (
            <div className="space-y-2 mb-4">
              {credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between bg-primary/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {cred.deviceType === "multiDevice" ? "\uD83D\uDD11" : "\uD83D\uDCF1"}
                    </span>
                    <div>
                      <p className="text-white text-sm">
                        {cred.deviceType === "multiDevice" ? "Passkey (synced)" : "This device"}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Added {new Date(cred.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={registering}
            className="text-sm text-accent hover:underline disabled:opacity-50"
          >
            {registering ? "Registering..." : "+ Add another device"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleRegister}
          disabled={registering}
          className="w-full py-3 px-6 rounded-full font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 bg-accent text-white"
        >
          {registering ? "Setting up..." : "\uD83E\uDDEC Enable Face ID / Touch ID"}
        </button>
      )}

      {message && (
        <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <p className="text-green-400 text-sm">{message}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
