import Image from "next/image";

export default function About() {
  return (
    <section id="about" className="section-padding bg-secondary">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Profile Photo */}
          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-white/10">
              <Image
                src="/IMG_8982.jpeg"
                alt="Crystal - Pistol Performance Coaching"
                fill
                className="object-cover"
                quality={85}
              />
            </div>
          </div>

          {/* Right - Content */}
          <div>
            <p className="text-gold font-heading uppercase tracking-widest text-sm mb-2">
              About
            </p>
            <h2 className="font-heading text-4xl md:text-5xl uppercase mb-6">
              Meet <span className="text-accent">Crystal</span>
            </h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                Based in the Southwest Region of Missouri, Crystal is a running
                coach with a diverse athletic background spanning CrossFit (L1
                certified), Powerlifting, Title Boxing &amp; Kickboxing coaching,
                and running roads and trails.
              </p>
              <p>
                A late-in-life runner herself, Crystal understands the journey.
                Married to another runner, together they share 5 kids and 5
                grandkids &mdash; proof that it&apos;s never too late to find
                your stride.
              </p>
              <p>
                Crystal has helped people improve their lives, build confidence,
                and transform their running experiences. She helps athletes set
                goals and then works alongside them to achieve every single one.
              </p>
            </div>

            {/* Credentials */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="bg-primary/50 rounded-xl p-4 border border-white/5">
                <p className="text-accent font-heading text-lg">CrossFit L1</p>
                <p className="text-gray-400 text-sm">Certified</p>
              </div>
              <div className="bg-primary/50 rounded-xl p-4 border border-white/5">
                <p className="text-accent font-heading text-lg">Powerlifting</p>
                <p className="text-gray-400 text-sm">Coach</p>
              </div>
              <div className="bg-primary/50 rounded-xl p-4 border border-white/5">
                <p className="text-accent font-heading text-lg">Boxing</p>
                <p className="text-gray-400 text-sm">Title Boxing &amp; Kickboxing</p>
              </div>
              <div className="bg-primary/50 rounded-xl p-4 border border-white/5">
                <p className="text-accent font-heading text-lg">Roads &amp; Trails</p>
                <p className="text-gray-400 text-sm">Runner &amp; Coach</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
