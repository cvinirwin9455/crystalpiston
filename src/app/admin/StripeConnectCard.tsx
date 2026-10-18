"use client";

import { useCallback, useEffect, useState } from "react";

// Coach-facing card for connecting their Stripe account (Stripe Connect Express).
// Shown in the Account Preferences view. Lets a coach start/
// finish Stripe onboarding so they can be paid directly by their clients.
// Honors super-admin "view as coach" via the same sessionStorage scope keys.

function scopeQuery(): string {
  if (typeof window === "undefined") return "";
  const org = sessionStorage.getItem("superadmin_target_org");
  const coach = sessionStorage.getItem("superadmin_target_coach");
  const p = new URLSearchParams();
  if (org) p.set("org", org);
  if (coach) p.set("coach", coach);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function scopeBody(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const org = sessionStorage.getItem("superadmin_target_org");
  const coach = sessionStorage.getItem("superadmin_target_coach");
  const b: Record<string, string> = {};
  if (org) b.org = org;
  if (coach) b.coach = coach;
  return b;
}

type Status = {
  configured: boolean;
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  warning?: string;
};

export default function StripeConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showReceiptHelp, setShowReceiptHelp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stripe-connect${scopeQuery()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // If we just came back from the Stripe connect flow, show a note and refresh.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const stripeParam = params.get("stripe");
      const stripeMsg = params.get("stripe_msg");
      if (stripeParam === "return") {
        setMsg({ text: "Welcome back! We're checking your Stripe connection. Tip: turn on email receipts below so your clients get a receipt automatically.", type: "success" });
        setShowReceiptHelp(true); // surface the receipt setup right after connecting
      } else if (stripeParam === "refresh") {
        setMsg({ text: "That connection link expired — click Connect to try again.", type: "error" });
      } else if (stripeParam === "error") {
        setMsg({ text: stripeMsg || "The Stripe connection didn't complete. Please try again.", type: "error" });
      }
    }
  }, [load]);

  async function startOnboarding() {
    setStarting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scopeBody() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setMsg({ text: data.error || "Could not start the Stripe connection.", type: "error" });
        setStarting(false);
        return;
      }
      // Redirect the coach to Stripe's OAuth connect flow.
      window.location.href = data.url;
    } catch {
      setMsg({ text: "Network error starting the Stripe connection.", type: "error" });
      setStarting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect your Stripe account from First Mile? This only removes the link here — it does NOT delete your Stripe account. You can reconnect anytime.")) return;
    setStarting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/stripe-connect${scopeQuery()}`, { method: "DELETE" });
      if (res.ok) {
        setMsg({ text: "Disconnected. You can connect again below.", type: "success" });
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg({ text: data.error || "Could not disconnect.", type: "error" });
      }
    } catch {
      setMsg({ text: "Network error.", type: "error" });
    } finally {
      setStarting(false);
    }
  }

  // --- Derived display state ---
  const ready = !!status?.chargesEnabled;
  const connectedButIncomplete = !!status?.connected && !ready;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-white font-heading uppercase tracking-wider text-sm">Get Paid — Stripe</h3>
          <p className="text-gray-400 text-xs mt-1">
            Connect your own Stripe account so clients can pay you directly for your packages. You get your own full Stripe account and dashboard — payments, payouts, refunds and receipts are all yours. First Mile takes <span className="text-gray-300 font-medium">no fee</span>.
          </p>
        </div>
        {/* Status pill */}
        {!loading && status && (
          <span
            className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${
              ready
                ? "bg-green-500/15 text-green-300 border border-green-500/20"
                : connectedButIncomplete
                ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20"
                : "bg-gray-500/15 text-gray-300 border border-gray-500/20"
            }`}
          >
            {ready ? "✓ Ready to accept payments" : connectedButIncomplete ? "Setup incomplete" : "Not connected"}
          </span>
        )}
      </div>

      {msg && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.type === "success" ? "bg-green-500/15 text-green-300 border border-green-500/20" : "bg-red-500/15 text-red-300 border border-red-500/20"}`}>
          {msg.text}
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-gray-400 text-sm">Checking your Stripe status…</p>
        ) : !status?.configured ? (
          <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-3">
            <p className="text-gray-300 text-sm">Stripe isn&apos;t set up on the server yet.</p>
            <p className="text-gray-500 text-xs mt-1">An admin needs to add the Stripe keys before coaches can connect. Check back soon.</p>
          </div>
        ) : ready ? (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-green-300 text-sm">
                You&apos;re all set — your Stripe account is connected and can accept payments.
              </p>
              <button
                onClick={disconnect}
                disabled={starting}
                className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-400/40 rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>

            {/* Turn on Stripe email receipts — recommended one-time setup. */}
            <div className="mt-4 rounded-lg bg-blue-500/5 border border-blue-500/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowReceiptHelp((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-500/5"
              >
                <span className="text-blue-200 text-sm font-medium">📧 Turn on email receipts for your clients <span className="text-blue-300/60 font-normal">(recommended)</span></span>
                <svg className={`w-3.5 h-3.5 text-blue-300 transition-transform flex-shrink-0 ${showReceiptHelp ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              {showReceiptHelp && (
                <div className="px-4 pb-4 pt-1 border-t border-blue-500/10">
                  <p className="text-gray-300 text-xs leading-relaxed mb-3">
                    Stripe can automatically email your clients a receipt for every payment — including each monthly subscription charge. It&apos;s a quick one-time setting in <span className="text-gray-200 font-medium">your own</span> Stripe dashboard. Clients get a proper receipt from you, so you don&apos;t have to send one yourself.
                  </p>
                  <div className="space-y-3 text-xs text-gray-300">
                    <div>
                      <p className="text-blue-200 font-medium mb-1">For one-time payments:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-gray-400">
                        <li>In your Stripe dashboard, go to <span className="text-gray-200">Settings → Payments → Customer emails</span>.</li>
                        <li>Turn on <span className="text-gray-200">&ldquo;Successful payments&rdquo;</span> (and &ldquo;Refunds&rdquo; if you like).</li>
                        <li>Save.</li>
                      </ol>
                    </div>
                    <div>
                      <p className="text-blue-200 font-medium mb-1">For monthly subscriptions:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-gray-400">
                        <li>Go to <span className="text-gray-200">Settings → Billing → Invoices (or &ldquo;Subscriptions and emails&rdquo;)</span>.</li>
                        <li>Turn on <span className="text-gray-200">&ldquo;Email finalized invoices and receipts to customers&rdquo;</span>.</li>
                        <li>Save.</li>
                      </ol>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <a
                      href="https://dashboard.stripe.com/settings/emails"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg"
                    >
                      Open Stripe email settings ↗
                    </a>
                    <span className="text-[11px] text-gray-500">Opens your Stripe dashboard in a new tab.</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                    Note: because you&apos;re the one being paid, these receipts come from your Stripe account and settings — not from First Mile. You only need to do this once.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : connectedButIncomplete ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-yellow-300 text-sm">
              Almost there — finish connecting your Stripe account to start accepting payments.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={disconnect}
                disabled={starting}
                className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-400/40 rounded-lg px-3 py-2 disabled:opacity-50"
              >
                Start over
              </button>
              <button
                onClick={startOnboarding}
                disabled={starting}
                className="text-xs bg-accent hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {starting ? "Opening…" : "Finish connecting"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-gray-300 text-sm">
              Connect Stripe to start charging clients. You&apos;ll sign in to your own Stripe account (or create one in a couple of minutes if you don&apos;t have one).
            </p>
            <button
              onClick={startOnboarding}
              disabled={starting}
              className="text-xs bg-accent hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {starting ? "Opening…" : "Connect Stripe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
