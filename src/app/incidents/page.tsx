import type { Metadata } from "next";
import { Suspense } from "react";
import { IncidentsPage } from "@/components/incidents/incidents-page";

export const metadata: Metadata = { title: "Faryad · Incidents" };

export default function Page() {
  // The page reads ?focus= from the URL, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <IncidentsPage />
    </Suspense>
  );
}
