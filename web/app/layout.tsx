import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppUpdater } from "@/components/AppUpdater";
import { PostHogProvider } from "@/components/PostHogProvider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { STUCK_LOADING_SCRIPT } from "@/lib/stuckLoadingScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export const viewport: Viewport = {
  // The app opens in light mode regardless of the system setting (see THEME_SCRIPT below).
  themeColor: "#fafafa",
};

// Sends browser visits on the old Vercel address to the real domain, so each visitor has one identity (analytics,
// saved layout and theme are all per-domain). Done here rather than as a server redirect so home-screen apps
// installed from the old address are left alone: sent to another domain, iOS opens them in a browser sheet
// with an address bar and Share button. Only this exact host, so preview deploys stay reachable.
const MOVED_SCRIPT = `(() => {
  if (location.hostname !== "hamilton-dining.vercel.app") return;
  if (navigator.standalone || matchMedia("(display-mode: standalone)").matches) return;
  location.replace("https://www.hameats.app" + location.pathname + location.search + location.hash);
})();`;

// Runs before the page paints so there's no flash: light by default, dark only if picked with the toggle.
const THEME_SCRIPT = `(() => {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch {}
  document.documentElement.classList.toggle("dark", saved === "dark");
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOVED_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: WEBSITE_JSON_LD }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          {children}
          <AppUpdater />
        </PostHogProvider>
        <script dangerouslySetInnerHTML={{ __html: STUCK_LOADING_SCRIPT }} />
      </body>
    </html>
  );
}
