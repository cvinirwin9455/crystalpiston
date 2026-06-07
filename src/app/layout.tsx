import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: "Pistol Performance Coaching | Crystal - Running Coach",
  description:
    "From 5K to 100 miles. Whether you're getting off the couch or breaking through a plateau, Crystal helps you set goals and crush them. Southwest Missouri running coach.",
  keywords: [
    "running coach",
    "trail running",
    "ultramarathon",
    "5K training",
    "Missouri running coach",
    "performance coaching",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
