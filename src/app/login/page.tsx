"use client";

import { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prototype - just redirect to dashboard
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/IMG_5861.PNG"
            alt="Pistol Performance Coaching"
            width={120}
            height={120}
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
            />
          </div>

          <button
            type="submit"
            className="w-full btn-primary text-center block"
          >
            Log In
          </button>

          <p className="text-center text-gray-500 text-sm">
            Don&apos;t have an account?{" "}
            <a href="#" className="text-accent hover:underline">
              Contact Crystal
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
