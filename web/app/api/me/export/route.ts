import { exportAccount } from "@/lib/account";
import { currentUser, dbEnabled, noStore, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** Download my data: everything HamEats keeps about the signed-in person, as a JSON file. */
export async function GET() {
  if (!dbEnabled()) return unavailable();
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });
  try {
    const data = await exportAccount(user.id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        ...noStore,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="hameats-data-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    console.error("me export failed:", e);
    return unavailable();
  }
}
