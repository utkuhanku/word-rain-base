import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "@coinbase/onchainkit/styles.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Word Rain | Base",
  description: "Reflex typing game for the Base ecosystem.",
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://word-rain.base.org/splash.png",
      button: {
        title: "Play Word Rain",
        action: {
          type: "launch_frame",
          name: "Word Rain",
          url: "https://word-rain.base.org",
          splashImageUrl: "https://word-rain.base.org/splash.png",
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
        className={`${inter.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
