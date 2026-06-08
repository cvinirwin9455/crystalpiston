import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <Image
        src="/IMG_5209.jpeg"
        alt="Running background"
        fill
        className="object-cover"
        priority
        quality={85}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-primary/80" />

      <div className="relative z-10 text-center px-6 pt-20 max-w-4xl mx-auto">
        <p className="text-gold font-heading uppercase tracking-[0.3em] text-sm md:text-base mb-4">
          Southwest Missouri
        </p>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-4 mt-6">
          From 5K to 100 miles. From the couch to the finish line.
        </p>
        <p className="text-base md:text-lg text-gray-400 max-w-xl mx-auto mb-10">
          Helping runners set goals, build confidence, and crush every distance.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#contact" className="btn-primary text-lg">
            Start Your Journey
          </a>
          <a href="#about" className="btn-secondary text-lg">
            Meet Crystal
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
