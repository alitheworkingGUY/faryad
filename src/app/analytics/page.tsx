import type { Metadata } from "next";
import { AnalyticsPage } from "@/components/analytics/analytics-page";

export const metadata: Metadata = { title: "Faryad · Analytics" };

export default function Page() {
  return <AnalyticsPage />;
}
