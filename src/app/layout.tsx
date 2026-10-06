import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteSidebar } from "@/components/site-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { HashScroll } from "@/components/hash-scroll";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RoyaleIQ — Clash Royale Deck Intelligence",
    template: "%s · RoyaleIQ",
  },
  description:
    "RoyaleIQ analyses your Clash Royale deck, tracks the live meta and coaches you on exactly what to change and why.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <MotionProvider>
          <TooltipProvider delayDuration={120}>
            <SiteSidebar />
            <div className="flex min-h-screen flex-col lg:pl-60">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <Toaster richColors position="bottom-right" />
            <HashScroll />
          </TooltipProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
