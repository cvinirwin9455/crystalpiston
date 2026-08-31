import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import AuthRedirect from "./components/AuthRedirect";
import PullToRefresh from "@/components/PullToRefresh";
import FeedbackButton from "@/components/FeedbackButton";
import ThemeProvider from "@/components/ThemeProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import { Analytics } from "@vercel/analytics/react";
import { getBrand } from "@/lib/brand.server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();

  if (brand.slug === 'first-mile') {
    return {
      title: brand.title,
      description: brand.description,
      openGraph: {
        title: 'First Mile Coach — Launch your coaching business for $1/month',
        description: brand.description,
        url: brand.ogUrl,
        siteName: brand.name,
        locale: 'en_US',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'First Mile Coach — Launch your coaching business for $1/month',
        description: brand.description,
      },
      robots: { index: true, follow: true },
      alternates: { canonical: brand.ogUrl },
      icons: {
        icon: [{ url: '/firstmile/favicon.png', type: 'image/png' }],
        apple: [{ url: '/firstmile/favicon.png', type: 'image/png' }],
      },
      manifest: '/firstmile/manifest.json',
    };
  }

  // Crystal Pistol (default)
  return {
    title: brand.title,
    description: brand.description,
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
      title: brand.title,
      description: "From 5K to 100 miles. Whether you're getting off the couch or breaking through a plateau, Crystal helps you set goals and crush them.",
      url: brand.ogUrl,
      siteName: brand.name,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: brand.title,
      description: "From 5K to 100 miles. Crystal helps you set goals and crush them. Southwest Missouri running coach.",
    },
    robots: { index: true, follow: true },
    alternates: { canonical: brand.ogUrl },
    icons: {
      icon: [
        { url: "/crystal-favicon.ico", sizes: "48x48" },
        { url: "/icon.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [
        { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    manifest: "/manifest.json",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Apply theme and brand immediately to prevent flash (only on platform pages)
              (function() {
                try {
                  var path = window.location.pathname;
                  var isPlatform = path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/super-admin') || path.startsWith('/login') || path.startsWith('/set-password') || path.startsWith('/reset-password') || path.startsWith('/help');
                  var theme = localStorage.getItem('theme');
                  if (isPlatform && theme === 'light') {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  }
                  // Apply First Mile brand class for everything except Crystal Pistol
                  // (matches getBrandFromHost — covers preview/staging URLs too)
                  if (window.location.hostname.toLowerCase().indexOf('crystalpistolperformance') === -1) {
                    document.documentElement.classList.add('brand-firstmile');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
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
        <ThemeProvider>
          <AuthRedirect />
          <PullToRefresh>
            {children}
          </PullToRefresh>
          <Analytics />
          <FeedbackButton />
          <ServiceWorkerRegistration />
          <PushNotificationPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
