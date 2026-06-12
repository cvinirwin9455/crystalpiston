"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      setTheme("light");
      document.documentElement.classList.add("light");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  return (
    <nav className="fixed top-0 w-full bg-primary/95 backdrop-blur-sm z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#">
          <Image
            src="/IMG_5861.PNG"
            alt="Pistol Performance Coaching"
            width={120}
            height={120}
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
          <button onClick={toggleTheme} className="text-gray-400 hover:text-white transition-colors" title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            {theme === "dark" ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>
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
          <button onClick={toggleTheme} className="block text-gray-400 hover:text-white transition-colors text-left">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <a href="#contact" className="block btn-primary text-sm text-center" onClick={() => setIsOpen(false)}>
            Let&apos;s Run
          </a>
        </div>
      )}
    </nav>
  );
}
