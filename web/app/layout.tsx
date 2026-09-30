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
    default: "Ham Eats · Dining Menus & Hours",
    // Other pages set just their own name, e.g. "Dining Hours · Ham Eats".
    template: "%s · Ham Eats",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["Ham Eats", "dining", "menu", "Soper Commons", "McEwen", "Howard Diner", "Little Pub", "dining hours"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  // Home-screen app on iPhone: full screen, named "Ham Eats".
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

// Tells Google the site's name, so results show "Ham Eats" instead of the domain.
const WEBSITE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
});

export const viewport: Viewport = {
  // The app opens in light mode regardless of the system setting (see THEME_SCRIPT below).
  themeColor: "#fafafa",
};

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
