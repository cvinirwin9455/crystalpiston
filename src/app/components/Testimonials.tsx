import Image from "next/image";

export default function Testimonials() {
  return (
    <section id="testimonials" className="section-padding bg-primary">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-gold font-heading uppercase tracking-widest text-sm mb-2">
            Real Results
          </p>
          <h2 className="font-heading text-4xl md:text-5xl uppercase">
            Client <span className="text-accent">Stories</span>
          </h2>
        </div>

        <div className="bg-secondary/50 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid md:grid-cols-5 gap-0">
            {/* Image */}
            <div className="md:col-span-2 relative min-h-[300px] md:min-h-full">
              <Image
                src="/IMG_4898.jpeg"
                alt="Valerie C. - Pistol Performance Coaching Client"
                fill
                className="object-cover"
                quality={85}
              />
            </div>

            {/* Testimonial Content */}
            <div className="md:col-span-3 p-8 md:p-10 flex flex-col justify-center">
              <svg
                className="w-10 h-10 text-accent/30 mb-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983z" />
              </svg>

              <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
                My journey with Crystal has been nothing short of astounding. We
                met up for a Thursday morning run back in August 2025. My running
                experience consisted of 23min blocks on a treadmill. I believe we
                did a 2 mile out &amp; back. Talking about life and things that
                motivate us. We saw a deer mom &amp; baby and took pics of the
                sunrise.
              </p>

              <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
                Little did I know that run would change the trajectory of my life.
                Crystal invited me to a group run the next Thursday. My
                Thursday&apos;s became spoken for. And from then added Sunday trail
                run. Eventually I became a 4-5 day a week outside runner!
              </p>

              <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
                My 5k races turned into 10k&apos;s. My goal for running a half in
                November became a reality in April! I signed up for the 10k trail
                race in Arkansas and Crystal suggested I change my distance to the
                25k. I followed her advice and now my longest race to date is the
                25k War Eagle Trail Race!
              </p>

              <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-6">
                If you&apos;re looking for guidance and community you will have
                that with Crystal. She is everything I didn&apos;t realize I
                needed.
              </p>

              <div className="border-t border-white/10 pt-4">
                <p className="text-white font-heading text-lg uppercase">
                  Valerie C.
                </p>
                <p className="text-gray-400 text-sm">
                  From treadmill to 25k Trail Finisher
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
