import { matchesTestSecret, signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * hameats.app/t/<TEST_LOGIN_SECRET>: logs this browser in as the shared test account and goes to the home page.
 * Anything else, including every address while TEST_LOGIN_SECRET is unset, is an ordinary 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!matchesTestSecret(key)) return new Response("Not found", { status: 404 });
  return signIn("test", { key, redirectTo: "/" });
}
