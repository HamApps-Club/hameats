import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { AppUpdater } from "@/components/AppUpdater";
import { PostHogProvider } from "@/components/PostHogProvider";
import { Splash, SPLASH_SCRIPT } from "@/components/Splash";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { STUCK_LOADING_SCRIPT } from "@/lib/stuckLoadingScript";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The display face for a few large words: the wordmark, the dates and hall names. Bundled (SIL Open Font
// License, assets/fonts/ZillaSlab-OFL.txt) rather than fetched, so builds and offline pages never miss it.
const zillaSlab = localFont({
  variable: "--font-zilla-slab",
  src: [
    { path: "../assets/fonts/zilla-slab-latin-600-normal.woff2", weight: "600" },
    { path: "../assets/fonts/zilla-slab-latin-700-normal.woff2", weight: "700" },
  ],
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HamEats · Hamilton College Dining Menus & Hours",
    // Other pages set just their own name, e.g. "Dining Hours · HamEats".
    template: "%s · HamEats",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["HamEats", "Ham Eats", "Hamilton College", "Hamilton College dining", "dining", "menu", "Soper Commons", "McEwen", "Howard Diner", "Little Pub", "dining hours"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  // Home-screen app on iPhone: full screen, named "HamEats".
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

// Tells Google the site's name, so results show "HamEats" instead of the domain.
const WEBSITE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: ["Ham Eats", "HamEats App"],
  url: SITE_URL,
});

// Sends browser visits on the old Vercel address to the real domain, so each visitor has one identity (analytics,
// saved layout and theme are all per-domain). Done here rather than as a server redirect so home-screen apps
// installed from the old address are left alone: sent to another domain, iOS opens them in a browser sheet
// with an address bar and Share button. Only this exact host, so preview deploys stay reachable.
const MOVED_SCRIPT = `(() => {
  if (location.hostname !== "hamilton-dining.vercel.app") return;
  if (navigator.standalone || matchMedia("(display-mode: standalone)").matches) return;
  location.replace("https://www.hameats.app" + location.pathname + location.search + location.hash);
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${zillaSlab.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOVED_SCRIPT }} />
        {/* Also adds the theme-color tags (status bar and Safari toolbar color), one for each phone setting.
            They aren't rendered by React or Next's viewport export: React would put the old colors back (or
            add a stale copy) after the script set them to the theme in use. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: WEBSITE_JSON_LD }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Splash />
        <PostHogProvider>
          {children}
          <AppUpdater />
        </PostHogProvider>
        <script dangerouslySetInnerHTML={{ __html: STUCK_LOADING_SCRIPT }} />
      </body>
    </html>
  );
}
