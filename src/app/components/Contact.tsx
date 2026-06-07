export default function Contact() {
  return (
    <section id="contact" className="section-padding bg-primary">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-gold font-heading uppercase tracking-widest text-sm mb-2">
          Ready?
        </p>
        <h2 className="font-heading text-4xl md:text-5xl uppercase mb-6">
          Let&apos;s <span className="text-accent">Run</span>
        </h2>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-10">
          Whether you&apos;re lacing up for the first time or chasing your next
          ultra, I&apos;d love to help you get there. Reach out and let&apos;s talk
          about your goals.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Facebook */}
          <a
            href="https://www.facebook.com/people/Pistol-Performance-Coaching/61559962313941/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-secondary/50 border border-white/5 rounded-2xl p-8 hover:border-accent/30 transition-all duration-300 group block"
          >
            <svg className="w-12 h-12 mx-auto mb-4 text-accent group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <h3 className="font-heading text-xl uppercase mb-2">Facebook</h3>
            <p className="text-gray-400">Follow for updates, tips &amp; community</p>
          </a>

          {/* Message/Email */}
          <a
            href="https://www.facebook.com/people/Pistol-Performance-Coaching/61559962313941/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-secondary/50 border border-white/5 rounded-2xl p-8 hover:border-accent/30 transition-all duration-300 group block"
          >
            <svg className="w-12 h-12 mx-auto mb-4 text-accent group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="font-heading text-xl uppercase mb-2">Message Me</h3>
            <p className="text-gray-400">Send a message on Facebook to get started</p>
          </a>
        </div>

        <div className="bg-secondary/30 border border-white/5 rounded-2xl p-8 md:p-12">
          <h3 className="font-heading text-2xl uppercase mb-4">
            Not sure where to start?
          </h3>
          <p className="text-gray-400 mb-6">
            That&apos;s okay! Send me a message and tell me a little about
            yourself &mdash; where you are now and where you want to be. We&apos;ll
            figure the rest out together.
          </p>
          <a
            href="https://www.facebook.com/people/Pistol-Performance-Coaching/61559962313941/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-lg"
          >
            Reach Out Today
          </a>
        </div>
      </div>
    </section>
  );
}
