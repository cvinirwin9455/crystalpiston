"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * PullToRefresh — wraps page content and adds a pull-down-to-refresh gesture.
 * Works in standalone PWA mode where the browser refresh isn't available.
 * 
 * Usage: <PullToRefresh><YourPageContent /></PullToRefresh>
 */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80; // pixels to pull before triggering refresh
  const MAX_PULL = 120; // max visual pull distance

  // Only activate in standalone mode (PWA) or when at top of page
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only start tracking if we're scrolled to the top
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling || refreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Apply resistance (pull feels heavier the further you go)
      const distance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(distance);

      // Prevent default scroll when pulling down
      if (distance > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
      setPulling(false);
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= THRESHOLD && !refreshing) {
      // Trigger refresh
      setRefreshing(true);
      setPullDistance(40); // Keep spinner visible

      // Reload the page
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else {
      // Cancel — snap back
      setPullDistance(0);
    }
    setPulling(false);
  }, [pullDistance, refreshing]);

  useEffect(() => {
    const container = document.body;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center pointer-events-none transition-transform duration-200"
        style={{
          transform: `translateY(${pullDistance - 40}px)`,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div className={`w-8 h-8 rounded-full bg-secondary border border-white/20 shadow-lg flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
          {refreshing ? (
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${pullDistance >= THRESHOLD ? 'text-accent rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
        </div>
      </div>

      {/* Page content */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.3}px)` : undefined,
          transition: pulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
