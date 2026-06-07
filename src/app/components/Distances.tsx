export default function Distances() {
  const distances = [
    { distance: "5K", miles: "3.1 mi", description: "The perfect starting point" },
    { distance: "10K", miles: "6.2 mi", description: "Double the fun" },
    { distance: "Half", miles: "13.1 mi", description: "A true milestone" },
    { distance: "Marathon", miles: "26.2 mi", description: "The classic challenge" },
    { distance: "50K", miles: "31 mi", description: "Welcome to ultras" },
    { distance: "50 Mile", miles: "50 mi", description: "Embracing the grind" },
    { distance: "100K", miles: "62 mi", description: "Mental fortitude" },
    { distance: "100 Mile", miles: "100 mi", description: "The ultimate test" },
  ];

  return (
    <section id="distances" className="section-padding bg-secondary">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-gold font-heading uppercase tracking-widest text-sm mb-2">
            Every Distance
          </p>
          <h2 className="font-heading text-4xl md:text-5xl uppercase">
            5K to <span className="text-accent">100 Miles</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Whatever distance calls to you, we&apos;ll get you there. I coach runners
            across the full spectrum.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {distances.map((item, index) => (
            <div
              key={index}
              className="bg-primary/50 border border-white/5 rounded-xl p-6 text-center hover:border-accent/30 hover:bg-primary/80 transition-all duration-300"
            >
              <p className="font-heading text-3xl md:text-4xl text-accent">
                {item.distance}
              </p>
              <p className="text-gray-400 text-sm mt-1">{item.miles}</p>
              <p className="text-gray-500 text-xs mt-2">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-300 text-lg italic">
            &ldquo;I coach people just looking to get off the couch and people
            looking to get out of their rut.&rdquo;
          </p>
          <p className="text-gold mt-2 font-heading uppercase tracking-wider text-sm">
            &mdash; Crystal
          </p>
        </div>
      </div>
    </section>
  );
}
