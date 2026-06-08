import Image from "next/image";

export default function Gallery() {
  return (
    <section id="gallery" className="section-padding bg-primary">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-gold font-heading uppercase tracking-widest text-sm mb-2">
            In Action
          </p>
          <h2 className="font-heading text-4xl md:text-5xl uppercase">
            On the <span className="text-accent">Road</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            From group runs to hundred-mile finishes — this is what we do.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Wednesday Group Run */}
          <div className="group relative rounded-2xl overflow-hidden border border-white/5 hover:border-accent/30 transition-all duration-300">
            <div className="aspect-[4/3] relative">
              <Image
                src="/IMG_8245.jpg"
                alt="Crystal's Wednesday Group Run"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                quality={85}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h3 className="font-heading text-xl uppercase text-white">
                Wednesday Group Run
              </h3>
              <p className="text-gray-300 text-sm mt-1">
                Community miles with Crystal&apos;s weekly running crew
              </p>
            </div>
          </div>

          {/* 100 Mile Race */}
          <div className="group relative rounded-2xl overflow-hidden border border-white/5 hover:border-accent/30 transition-all duration-300">
            <div className="aspect-[4/3] relative">
              <Image
                src="/IMG_3416.JPG"
                alt="Crystal's 2nd Hundred Mile Race"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                quality={85}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h3 className="font-heading text-xl uppercase text-white">
                100 Mile Finisher
              </h3>
              <p className="text-gray-300 text-sm mt-1">
                Crystal&apos;s 2nd hundred-mile race — proof the coaching works
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
