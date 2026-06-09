import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import AuthRedirect from "./components/AuthRedirect";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Catch Supabase auth hash fragments BEFORE React hydrates
              (function() {
                var hash = window.location.hash;
                if (hash && hash.indexOf('access_token') !== -1) {
                  // Store the hash and redirect to set-password
                  // The hash will be picked up by Supabase client on that page
                  sessionStorage.setItem('supabase_auth_hash', hash);
                  window.location.replace('/set-password' + hash);
                } else if (hash && hash.indexOf('error') !== -1 && hash.indexOf('expired') !== -1) {
                  window.location.replace('/login?error=link_expired');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-body">
        <AuthRedirect />
        {children}
      </body>
    </html>
  );
}
