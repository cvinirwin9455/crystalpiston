"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CurrencyCode,
  formatCurrency,
  formatCurrencyAuto,
  getCurrencySymbol,
  normalizeCurrencyCode,
} from "@/lib/currency";

// Shared, cached lookup of the signed-in user's organization currency.
// Coaches and their clients share one organization currency, so every screen
// that shows money uses this instead of hardcoding "$".
//
// Honors super-admin "view as coach" (same sessionStorage keys as the other
// coach screens) so the viewed coach's currency is shown.

const cache = new Map<string, CurrencyCode>();
const inflight = new Map<string, Promise<CurrencyCode>>();
const listeners = new Set<() => void>();

function scopeOrg(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem("superadmin_target_org") || "";
  } catch {
    return "";
  }
}

async function fetchCurrency(org: string): Promise<CurrencyCode> {
  const existing = inflight.get(org);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(`/api/org-currency${org ? `?org=${encodeURIComponent(org)}` : ""}`);
      if (!res.ok) return "USD" as CurrencyCode;
      const data = await res.json().catch(() => ({}));
      return normalizeCurrencyCode(data?.currency);
    } catch {
      return "USD" as CurrencyCode;
    } finally {
      inflight.delete(org);
    }
  })();
  inflight.set(org, p);
  const code = await p;
  cache.set(org, code);
  return code;
}

/** Call after the currency is changed so every mounted component updates. */
export function setCachedOrgCurrency(code: string) {
  cache.set(scopeOrg(), normalizeCurrencyCode(code));
  listeners.forEach((l) => l());
}

export function useOrgCurrency() {
  const org = scopeOrg();
  const [currency, setCurrency] = useState<CurrencyCode>(cache.get(org) || "USD");
  const [loaded, setLoaded] = useState(cache.has(org));

  useEffect(() => {
    let cancelled = false;
    const key = scopeOrg();
    const sync = () => {
      const c = cache.get(key);
      if (c && !cancelled) setCurrency(c);
    };
    listeners.add(sync);
    if (cache.has(key)) {
      setCurrency(cache.get(key)!);
      setLoaded(true);
    } else {
      fetchCurrency(key).then((c) => {
        if (cancelled) return;
        setCurrency(c);
        setLoaded(true);
      });
    }
    return () => {
      cancelled = true;
      listeners.delete(sync);
    };
  }, []);

  /** "£125.50" (two decimals unless `decimals` is given). */
  const fmt = useCallback(
    (amount: number, decimals: number = 2) => formatCurrency(amount, currency, decimals),
    [currency]
  );
  /** "£125" for whole amounts, "£125.50" otherwise. */
  const fmtAuto = useCallback((amount: number) => formatCurrencyAuto(amount, currency), [currency]);

  return { currency, symbol: getCurrencySymbol(currency), loaded, fmt, fmtAuto };
}
