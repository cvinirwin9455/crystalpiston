"use client";

import { useEffect, useState } from "react";
import { CURRENCIES, CURRENCY_CODES, CurrencyCode } from "@/lib/currency";
import { setCachedOrgCurrency, useOrgCurrency } from "@/lib/use-org-currency";

// Coach-facing card for choosing the currency used across the whole account
// (plan costs, payments, packages, and what clients see). Shown in Account
// Preferences. Only account owners can change it; other coaches see it read-only.
// Honors super-admin "view as coach" via the same sessionStorage scope keys.

function scopeBody(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const org = sessionStorage.getItem("superadmin_target_org");
  const coach = sessionStorage.getItem("superadmin_target_coach");
  const b: Record<string, string> = {};
  if (org) b.org = org;
  if (coach) b.coach = coach;
  return b;
}

export default function CurrencyCard({ canEdit }: { canEdit: boolean }) {
  const { currency, loaded } = useOrgCurrency();
  const [selected, setSelected] = useState<CurrencyCode>(currency);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    setSelected(currency);
  }, [currency]);

  const dirty = selected !== currency;

  const save = async () => {
    if (!dirty) return;
    const from = CURRENCIES[currency];
    const to = CURRENCIES[selected];
    const ok = confirm(
      `Change your account currency from ${from.label} (${from.symbol}) to ${to.label} (${to.symbol})?\n\n` +
        `Existing amounts are not converted. For example, ${from.symbol}100 becomes ${to.symbol}100. ` +
        `Your package prices switch to ${to.code} as well.`
    );
    if (!ok) {
      setSelected(currency);
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/org-currency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: selected, ...scopeBody() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCachedOrgCurrency(selected);
        setMsg({ text: `Currency updated to ${to.label} (${to.symbol}).`, type: "success" });
      } else {
        setSelected(currency);
        setMsg({ text: data.error || "Could not update currency.", type: "error" });
      }
    } catch {
      setSelected(currency);
      setMsg({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-secondary/50 border border-white/10 rounded-xl p-6">
      <h3 className="font-heading text-sm uppercase text-gray-400 mb-2">Currency</h3>
      <p className="text-gray-300 text-xs mb-4">
        The currency shown for plan costs, payments and package prices, for you and your clients.
      </p>
      {!loaded ? (
        <p className="text-gray-500 text-xs">Loading...</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as CurrencyCode)}
            disabled={!canEdit || saving}
            className="bg-primary/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent disabled:opacity-60"
            aria-label="Account currency"
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {CURRENCIES[code].flag} {CURRENCIES[code].label} ({CURRENCIES[code].symbol})
              </option>
            ))}
          </select>
          {canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="bg-accent hover:bg-orange-700 disabled:opacity-40 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      )}
      {!canEdit && loaded && (
        <p className="text-gray-500 text-[11px] mt-2">Only the account owner can change the currency.</p>
      )}
      {msg && (
        <p className={`text-xs mt-3 ${msg.type === "success" ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
      )}
    </div>
  );
}
