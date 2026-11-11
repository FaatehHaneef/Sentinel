import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Pixelify_Sans } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible was designed for readers with low vision.
const body = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Sentinel: The Checkout Trials",
  description:
    "Watch seven kinds of customer try to buy from your store. See where each one struggles, what it costs you, and how to fix it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${pixel.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-amber focus:px-4 focus:py-2 focus:text-indigo"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
