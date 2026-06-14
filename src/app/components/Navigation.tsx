"use client";

import { useState } from "react";
import Image from "next/image";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-primary/95 backdrop-blur-sm z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#">
          <Image
            src="/IMG_5861.PNG"
            alt="Pistol Performance Coaching"
            width={160}
            height={160}
          />
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#about" className="hover:text-accent transition-colors">
            About
          </a>
          <a href="#services" className="hover:text-accent transition-colors">
            Services
          </a>
          <a href="#distances" className="hover:text-accent transition-colors">
            Distances
          </a>
          <a href="/login" className="hover:text-accent transition-colors">
            Client Login
          </a>
          <a href="#contact" className="btn-primary text-sm">
            Let&apos;s Run
          </a>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden text-white"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-secondary border-t border-white/10 px-6 py-4 space-y-4">
          <a href="#about" className="block hover:text-accent transition-colors" onClick={() => setIsOpen(false)}>
            About
          </a>
          <a href="#services" className="block hover:text-accent transition-colors" onClick={() => setIsOpen(false)}>
            Services
          </a>
          <a href="#distances" className="block hover:text-accent transition-colors" onClick={() => setIsOpen(false)}>
            Distances
          </a>
          <a href="/login" className="block hover:text-accent transition-colors" onClick={() => setIsOpen(false)}>
            Client Login
          </a>
          <a href="#contact" className="block btn-primary text-sm text-center" onClick={() => setIsOpen(false)}>
            Let&apos;s Run
          </a>
        </div>
      )}
    </nav>
  );
}
