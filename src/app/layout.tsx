import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });

export const metadata: Metadata = {
  title: "Hangman Reel Studio",
  description: "Generate cinematic 4K 30 fps Hangman reels for Reels, Shorts and TikTok.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
