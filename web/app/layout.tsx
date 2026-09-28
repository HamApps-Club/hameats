import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppUpdater } from "@/components/AppUpdater";
import { PostHogProvider } from "@/components/PostHogProvider";
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
  title: "Ham Eats",
  description: "Dining hall menus and hours",
  applicationName: "Ham Eats",
  // Home-screen app on iPhone: full screen, named "Ham Eats".
  appleWebApp: { capable: true, title: "Ham Eats", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Runs before the page paints so there's no light flash: a saved choice from the toggle wins, else the system
// setting (and system changes are followed until the user picks one).
const THEME_SCRIPT = `(() => {
  const saved = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", saved() ? saved() === "dark" : mq.matches);
  apply();
  mq.addEventListener("change", () => { if (!saved()) apply(); });
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
