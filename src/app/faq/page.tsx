import { getBrand } from "@/lib/brand.server";
import { redirect } from "next/navigation";
import FAQPageClient from "../components/firstmile/FAQPageClient";

export default async function FAQPage() {
  const brand = await getBrand();

  // Only show FAQ page for First Mile Coach
  if (brand.slug !== 'first-mile') {
    redirect('/');
  }

  return <FAQPageClient />;
}
