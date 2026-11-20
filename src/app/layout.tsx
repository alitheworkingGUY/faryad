import type { Metadata, Viewport } from "next";
import { Inter, Noto_Nastaliq_Urdu } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-face",
  subsets: ["latin"],
  display: "swap",
});

const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq",
  subsets: ["arabic"],
  display: "swap",
});

// next/font pairs every face with a metric fallback built on local Arial. Arial has
// Arabic glyphs, so "Inter, Inter Fallback, Nastaliq" would draw Urdu in Arial and never
// reach Nastaliq. The stack below uses only the real faces: Latin -> Inter, Urdu -> Nastaliq.
const firstFamily = (stack: string) => stack.split(",")[0].trim();
const fontVars = {
  "--font-latin": firstFamily(inter.style.fontFamily),
  "--font-nq": firstFamily(nastaliq.style.fontFamily),
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "Faryad · Peshawar Command Center",
  description:
    "Faryad is a 24/7 AI voice helpline for Peshawar municipal services. Citizens speak their complaint in Urdu and it appears live on the city map.",
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`dark ${inter.variable} ${nastaliq.variable} h-full antialiased`}
      style={fontVars}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-ink text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
