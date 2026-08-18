import { getBrand } from "@/lib/brand.server";
import { redirect } from "next/navigation";
import FeaturesPageClient from "../components/firstmile/FeaturesPageClient";

export default async function FeaturesPage() {
  const brand = await getBrand();

  // Only show features page for First Mile Coach
  if (brand.slug !== 'first-mile') {
    redirect('/');
  }

  return <FeaturesPageClient />;
}
