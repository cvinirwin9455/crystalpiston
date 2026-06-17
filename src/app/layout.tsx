import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import AuthRedirect from "./components/AuthRedirect";
import { Analytics } from "@vercel/analytics/react";

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
    "Southwest Missouri running",
    "half marathon training",
    "marathon coach",
    "couch to 5K",
    "trail running coach",
    "running accountability",
  ],
  openGraph: {
    title: "Pistol Performance Coaching | Crystal - Running Coach",
    description: "From 5K to 100 miles. Whether you're getting off the couch or breaking through a plateau, Crystal helps you set goals and crush them.",
    url: "https://www.crystalpistolperformance.com",
    siteName: "Pistol Performance Coaching",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pistol Performance Coaching | Crystal - Running Coach",
    description: "From 5K to 100 miles. Crystal helps you set goals and crush them. Southwest Missouri running coach.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://www.crystalpistolperformance.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "Pistol Performance Coaching",
              "description": "Running coach serving Southwest Missouri. From 5K to 100 miles — personalized training plans, group runs, and accountability coaching.",
              "url": "https://www.crystalpistolperformance.com",
              "areaServed": {
                "@type": "GeoCircle",
                "geoMidpoint": { "@type": "GeoCoordinates", "latitude": 36.7, "longitude": -93.4 },
                "geoRadius": "80000"
              },
              "address": { "@type": "PostalAddress", "addressRegion": "MO", "addressCountry": "US" },
              "priceRange": "$$",
              "serviceType": ["Running Coach", "Trail Running Coach", "Marathon Training", "Ultra Marathon Training", "5K Training"],
              "founder": { "@type": "Person", "name": "Crystal" },
              "sameAs": []
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Catch Supabase auth hash fragments BEFORE React hydrates
              (function() {
                var hash = window.location.hash;
                var path = window.location.pathname;
                
                // If we're already on set-password or reset-password, don't redirect again
                if (path === '/set-password' || path === '/reset-password') return;
                
                if (hash && hash.indexOf('access_token') !== -1) {
                  // Check if this is a password recovery or an invite
                  if (hash.indexOf('type=recovery') !== -1) {
                    window.location.replace('/reset-password' + hash);
                  } else {
                    window.location.replace('/set-password' + hash);
                  }
                } else if (hash && hash.indexOf('error') !== -1) {
                  var msg = 'link_expired';
                  if (hash.indexOf('access_denied') !== -1) msg = 'link_expired';
                  window.location.replace('/login?error=' + msg);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-body">
        <AuthRedirect />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
