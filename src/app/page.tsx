import { getBrand } from "@/lib/brand";
import Navigation from "./components/Navigation";
import Hero from "./components/Hero";
import About from "./components/About";
import Services from "./components/Services";
import Gallery from "./components/Gallery";
import Testimonials from "./components/Testimonials";
import Distances from "./components/Distances";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import FirstMilePage from "./components/firstmile/FirstMilePage";

export default async function Home() {
  const brand = await getBrand();

  if (brand.slug === 'first-mile') {
    return <FirstMilePage />;
  }

  return (
    <main>
      <Navigation />
      <Hero />
      <About />
      <Services />
      <Gallery />
      <Testimonials />
      <Distances />
      <Contact />
      <Footer />
    </main>
  );
}
