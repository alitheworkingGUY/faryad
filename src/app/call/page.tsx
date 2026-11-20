import type { Metadata } from "next";
import { CallScreen } from "@/components/call/call-screen";

export const metadata: Metadata = {
  title: "فریاد ہیلپ لائن · Faryad Helpline",
  description: "Report a municipal complaint in Peshawar by voice, in Urdu or English.",
};

export default function CallPage() {
  return <CallScreen />;
}
