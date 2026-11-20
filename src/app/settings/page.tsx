import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Faryad · Settings" };

export default function Page() {
  return <SettingsPage />;
}
