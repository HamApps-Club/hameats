import { POST as report } from "@/app/api/report/route";

export const dynamic = "force-dynamic";

/** { id, reason? }: reports a review. Kept for pages opened before the Feed existed; a review's id is its post id. */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ postId: payload?.id, reason: payload?.reason }),
  });
  return report(forwarded);
}
