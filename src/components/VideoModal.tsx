"use client";

import { useState, useEffect } from "react";

interface Props {
  url: string;
  exerciseName: string;
  onClose: () => void;
}

/**
 * Extracts YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
 */
function getYouTubeId(url: string): string | null {
  try {
    let cleanUrl = url.trim();
    // Add protocol if missing
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const u = new URL(cleanUrl);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtube-nocookie.com")) {
      // youtube.com/watch?v=ID
      const vParam = u.searchParams.get("v");
      if (vParam) return vParam;
      // youtube.com/embed/ID or youtube.com/shorts/ID or youtube.com/v/ID
      const pathParts = u.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 2 && ["embed", "shorts", "v"].includes(pathParts[0])) {
        return pathParts[1];
      }
    }
  } catch {}
  // Fallback: try regex for common patterns
  const regexMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return regexMatch ? regexMatch[1] : null;
}

/**
 * Extracts Vimeo video ID from various URL formats.
 * Supports: vimeo.com/ID, player.vimeo.com/video/ID
 */
function getVimeoId(url: string): string | null {
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const u = new URL(cleanUrl);
    if (u.hostname.includes("vimeo.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      // Handle player.vimeo.com/video/ID
      if (parts[0] === "video" && parts[1]) return parts[1];
      // Handle vimeo.com/ID
      if (parts[0] && /^\d+$/.test(parts[0])) return parts[0];
      // Handle vimeo.com/channels/xxx/ID or vimeo.com/groups/xxx/videos/ID
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) return lastPart;
    }
  } catch {}
  // Fallback regex
  const regexMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return regexMatch ? regexMatch[1] : null;
}

export default function VideoModal({ url, exerciseName, onClose }: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const youtubeId = getYouTubeId(url);
  const vimeoId = getVimeoId(url);

  const renderEmbed = () => {
    if (youtubeId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
          className="w-full aspect-video rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={`${exerciseName} demo video`}
        />
      );
    }

    if (vimeoId) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
          className="w-full aspect-video rounded-lg"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={`${exerciseName} demo video`}
        />
      );
    }

    // Fallback: show a link to open externally
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        <p className="text-gray-300 text-sm mb-3">This video can&apos;t be embedded directly.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gold/20 hover:bg-gold/30 text-gold font-bold py-2.5 px-5 rounded-lg text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Video in New Tab
        </a>
      </div>
    );
  };

  if (!isMounted) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-secondary border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-5 h-5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-white font-medium text-sm truncate">{exerciseName}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Content */}
        <div className="p-4">
          {renderEmbed()}
        </div>
      </div>
    </div>
  );
}
