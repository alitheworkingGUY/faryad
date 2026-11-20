import type { Metadata } from "next";
import { TicketsPage } from "@/components/tickets/tickets-page";

export const metadata: Metadata = { title: "Faryad · Tickets" };

export default function Page() {
  return <TicketsPage />;
}
