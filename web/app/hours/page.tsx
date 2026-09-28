"use client";

import { useEffect, useState } from "react";
import { HoursPanel } from "@/components/HoursPanel";
import { HALLS } from "@/lib/halls";
import { campusNow } from "@/lib/hours";

export default function HoursPage() {
  const [now, setNow] = useState(() => campusNow());
  useEffect(() => {
    const id = setInterval(() => setNow(campusNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Dining hours</h1>
      {HALLS.map((hall) => (
        <div key={hall.slug} className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{hall.name}</h2>
          <HoursPanel hours={hall.hours} now={now} />
        </div>
      ))}
    </div>
  );
}
