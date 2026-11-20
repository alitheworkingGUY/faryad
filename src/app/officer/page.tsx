import type { Metadata } from "next";
import { OfficerApp } from "@/components/officer/officer-app";

export const metadata: Metadata = { title: "Faryad · Officer" };

export default function OfficerPage() {
  return <OfficerApp />;
}
