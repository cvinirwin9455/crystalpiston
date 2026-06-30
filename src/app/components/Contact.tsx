"use client";

import { useState } from "react";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Couldn't send your message. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="section-padding bg-primary">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-gold font-heading uppercase tracking-widest text-sm mb-2">
            Say Hello
          </p>
          <h2 className="font-heading text-4xl md:text-5xl uppercase mb-4">
            Let&apos;s <span className="text-accent">Chat</span>
          </h2>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Not sure if coaching is right for you? That&apos;s totally okay.
            No commitment, no pressure &mdash; just a friendly conversation about
            where you are and where you want to be.
          </p>
        </div>

        {sent ? (
          /* Success State */
          <div className="bg-secondary/50 border border-green-500/20 rounded-2xl p-10 md:p-14 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-heading text-2xl md:text-3xl uppercase mb-3 text-white">
              You&apos;re all set!
            </h3>
            <p className="text-gray-300 text-lg mb-2">
              Your message is on its way to Crystal.
            </p>
            <p className="text-gray-400">
              Check your inbox &mdash; you&apos;ll have a confirmation email, and Crystal will
              follow up with you personally. Looking forward to connecting!
            </p>
          </div>
        ) : (
          /* Form */
          <div className="bg-secondary/50 border border-white/5 rounded-2xl p-8 md:p-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="inquiry-name" className="block text-sm font-medium text-gray-300 mb-2">
                  What&apos;s your name?
                </label>
                <input
                  id="inquiry-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name is fine!"
                  required
                  className="w-full bg-primary/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="inquiry-email" className="block text-sm font-medium text-gray-300 mb-2">
                  Best email to reach you?
                </label>
                <input
                  id="inquiry-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-primary/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="inquiry-message" className="block text-sm font-medium text-gray-300 mb-2">
                  What&apos;s on your mind?
                </label>
                <p className="text-gray-500 text-xs mb-2">
                  Anything at all &mdash; your goals, where you&apos;re at, questions you have. There&apos;s no wrong answer here.
                </p>
                <textarea
                  id="inquiry-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="I've been thinking about getting into running but I'm not sure where to start..."
                  required
                  rows={4}
                  className="w-full bg-primary/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={sending || !name.trim() || !email.trim() || !message.trim()}
                className="w-full btn-primary text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send Message"
                )}
              </button>

              <p className="text-center text-gray-500 text-xs">
                Crystal reads every message personally and will reply to your email directly.
              </p>
            </form>
          </div>
        )}

        {/* Social links below form */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
          <a
            href="https://www.facebook.com/people/Pistol-Performance-Coaching/61559962313941/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-accent transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Follow on Facebook
          </a>
          <span className="text-gray-600 hidden sm:inline">|</span>
          <a
            href="mailto:crystal@pistolpc.com"
            className="flex items-center gap-2 text-gray-400 hover:text-accent transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            crystal@pistolpc.com
          </a>
        </div>
      </div>
    </section>
  );
}
