import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Dining Hours",
  description:
    "When each dining hall is open: Soper Commons, McEwen Dining Hall, Howard Diner and the Little Pub.",
  alternates: { canonical: "/hours" },
};

export default function HoursLayout({ children }: { children: React.ReactNode }) {
  return children;
}
