import type { Metadata } from "next";
import { getWanderCatalogue } from "@/lib/wander-data";
import { nextWanderStep } from "@/lib/wander";
import { WanderExperience } from "@/components/wander/WanderExperience";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Прогулка по работам",
  description: "Одна работа ведёт к другой. Случайная прогулка по визуальному архиву.",
  // Session-specific experience; original posts and collections remain the indexed pages.
  robots: { index: false, follow: true },
  alternates: { canonical: "/wander" },
};

export default async function WanderPage() {
  const catalogue = await getWanderCatalogue();
  return <WanderExperience catalogue={catalogue} initialStep={nextWanderStep(catalogue, [])} />;
}
