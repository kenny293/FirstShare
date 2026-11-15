import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TermProvider } from "@/components/Term";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "FirstShare: learn investing by playing",
  description: "An educational investing simulator for complete beginners. Fake money, real history, good habits.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <TermProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col lg:max-w-6xl">
            <main className="flex-1 px-4 pb-6 lg:px-8">{children}</main>
            <Footer />
          </div>
        </TermProvider>
      </body>
    </html>
  );
}
