import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import FarcasterProvider from "@/components/FarcasterProvider";
import "@coinbase/onchainkit/styles.css";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Word Rain | Base",
  description: "Reflex typing game for the Base ecosystem.",
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://word-rain-base.vercel.app/splash.png",
      button: {
        title: "Play Word Rain",
        action: {
          type: "launch_frame",
          name: "Word Rain",
          url: "https://word-rain-base.vercel.app",
          splashImageUrl: "https://word-rain-base.vercel.app/splash.png",
          splashBackgroundColor: "#050505",
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${mono.variable} antialiased bg-[#050505] text-white`}
      >
        <Providers>
          <FarcasterProvider>
            {children}
          </FarcasterProvider>
        </Providers>
      </body>
    </html>
  );
}
