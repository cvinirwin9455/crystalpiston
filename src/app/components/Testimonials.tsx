"use client";

import { useState } from "react";
import Image from "next/image";

const testimonials = [
  {
    id: "valerie",
    name: "Valerie C.",
    headline: "From Treadmill to 25k Trail Finisher",
    image: "/IMG_4898.jpeg",
    paragraphs: [
      "My journey with Crystal has been nothing short of astounding. We met up for a Thursday morning run back in August 2025. My running experience consisted of 23min blocks on a treadmill. I believe we did a 2 mile out & back. Talking about life and things that motivate us. We saw a deer mom & baby and took pics of the sunrise.",
      "Little did I know that run would change the trajectory of my life. Crystal invited me to a group run the next Thursday. My Thursday's became spoken for. And from then added Sunday trail run. Eventually I became a 4-5 day a week outside runner!",
      "My 5k races turned into 10k's. My goal for running a half in November became a reality in April! I signed up for the 10k trail race in Arkansas and Crystal suggested I change my distance to the 25k. I followed her advice and now my longest race to date is the 25k War Eagle Trail Race!",
      "If you're looking for guidance and community you will have that with Crystal. She is everything I didn't realize I needed.",
    ],
  },
  {
    id: "jules",
    name: "Jules M.",
    headline: "From First Group Run to 50k Finisher",
    image: "/IMG_8330.jpeg",
    paragraphs: [
      "I met Crystal in 2018, and was inspired by her peaceful spirit, quiet determination, and constant personal growth. When I wanted to start running in 2025, I knew who to call! I had been running alone for less than a month, and I was lacking community and connection in my life.",
      "Within days of reaching out to Crystal, she had a group run planned just for me. Crystal coached me throughout the run, teaching me breathing techniques and the power of mindset. I ran farther than I ever had before, and felt so empowered. I fell in love with running. I started going to group runs, and I felt I had finally found my people!",
      "I shared my dream of trail and ultra running with Crystal. So Crystal started planning group trail runs! Before I knew it, we were running a half marathon on the trail together. The next morning at breakfast, she told me about her favorite trail race: War Eagle 50k. Running this race became a dream to me; a big, scary, awesome dream.",
      "Crystal created a training plan, and we worked hard for 18 weeks. Last weekend, we finished War Eagle 50k! Moral of the story: if you share your dreams with Crystal, be prepared to work hard and watch those dreams come true. She sincerely believes that we are all capable of amazing things, and she guides the way with expert knowledge and care.",
    ],
  },
];

export default function Testimonials() {
  const [expanded, setExpanded] = useState<string | null>(null);

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

        <div className="space-y-4">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="bg-secondary/50 border border-white/10 rounded-2xl overflow-hidden hover:border-accent/30 transition-all duration-300"
            >
              {/* Collapsed Header - always visible */}
              <button
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="w-full text-left px-6 py-5 md:px-8 md:py-6 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent font-heading text-lg">{t.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg md:text-xl uppercase text-white">
                      {t.name}
                    </h3>
                    <p className="text-gray-400 text-sm">{t.headline}</p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${expanded === t.id ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Content */}
              {expanded === t.id && (
                <div className="border-t border-white/10">
                  <div className="grid md:grid-cols-5 gap-0">
                    {/* Image */}
                    <div className="md:col-span-2 relative min-h-[300px] md:min-h-[400px]">
                      <Image
                        src={t.image}
                        alt={`${t.name} - Pistol Performance Coaching Client`}
                        fill
                        className="object-cover"
                        quality={85}
                      />
                    </div>

                    {/* Testimonial Text */}
                    <div className="md:col-span-3 p-6 md:p-8 flex flex-col justify-center">
                      <svg
                        className="w-8 h-8 text-accent/30 mb-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983z" />
                      </svg>

                      {t.paragraphs.map((p, i) => (
                        <p key={i} className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
                          {p}
                        </p>
                      ))}

                      <div className="border-t border-white/10 pt-4 mt-2">
                        <p className="text-white font-heading text-lg uppercase">
                          {t.name}
                        </p>
                        <p className="text-gray-400 text-sm">{t.headline}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
