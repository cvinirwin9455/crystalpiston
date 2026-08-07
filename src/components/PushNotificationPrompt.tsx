"use client";

import { useState, useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Trim whitespace and remove any non-base64url characters
  const cleaned = base64String.trim().replace(/[^A-Za-z0-9\-_]/g, "");
  const padding = "=".repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    // Check current permission state
    if (Notification.permission === "granted") {
      // Permission already granted — check if we have an active subscription
      checkAndSyncSubscription();
      return;
    }
    if (Notification.permission === "denied") return;

    // Permission not yet asked — don't show if user dismissed recently (24 hours)
    const dismissed = localStorage.getItem("push-prompt-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    }

    // Show prompt after a short delay (don't interrupt initial page load)
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  async function checkAndSyncSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Already subscribed — sync to backend (in case it's not stored)
        await fetch("/api/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        localStorage.setItem("push-enabled", "1");
      } else {
        // Permission granted but NO subscription exists
        // This happens when the first subscribe attempt failed
        // Auto-retry the subscription silently
        try {
          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });

          const res = await fetch("/api/push-subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: newSubscription.toJSON() }),
          });

          if (res.ok) {
            localStorage.setItem("push-enabled", "1");
            console.log("[Push] Auto-subscribed successfully");
          }
        } catch (retryErr) {
          console.error("[Push] Auto-subscribe retry failed:", retryErr);
          // Show the prompt so user can manually retry
          setShowPrompt(true);
        }
      }
    } catch (err) {
      console.error("[Push] checkAndSyncSubscription error:", err);
    }
  }

  async function handleEnable() {
    setSubscribing(true);
    setError("");

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was denied.");
        setSubscribing(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      if (!VAPID_PUBLIC_KEY) {
        throw new Error("Push notifications are not configured yet.");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to our API
      const res = await fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!res.ok) {
        throw new Error("Failed to save subscription");
      }

      setShowPrompt(false);
      localStorage.setItem("push-enabled", "1");
    } catch (err: any) {
      console.error("[Push] Subscription error:", err);
      setError(err.message || "Something went wrong. Try again later.");
    } finally {
      setSubscribing(false);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    localStorage.setItem("push-prompt-dismissed", Date.now().toString());
  }

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "calc(100% - 32px)",
        maxWidth: "400px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#FFF3E0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "20px",
            }}
          >
            &#128276;
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: "16px",
                fontWeight: 700,
                color: "#2d3436",
              }}
            >
              Stay in the loop
            </h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "14px",
                color: "#555b5e",
                lineHeight: 1.4,
              }}
            >
              Get notified when your coach sends a message or publishes your training plan.
            </p>

            {error && (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  color: "#c62828",
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleEnable}
                disabled={subscribing}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "50px",
                  border: "none",
                  background: "#f26522",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: subscribing ? "wait" : "pointer",
                  opacity: subscribing ? 0.7 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {subscribing ? "Enabling..." : "Enable Notifications"}
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  padding: "10px 16px",
                  borderRadius: "50px",
                  border: "1px solid #e0e0e0",
                  background: "transparent",
                  color: "#555b5e",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
