import { castVote } from "@/lib/social";
import { idParam, reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** { target: "post" | "comment", id, value: 1 | -1 | 0 }: the arrows on a Feed post or a comment. 0 takes the vote back. */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const payload = await request.json().catch(() => null);
  const id = idParam(payload?.id);
  const target = payload?.target;
  const value = payload?.value;
  if (!id || (target !== "post" && target !== "comment") || ![1, -1, 0].includes(value)) return reply({ error: "bad request" }, 400);
  try {
    const result = await castVote(target, user.id, id, value);
    if (!result) return reply({ error: "not found" }, 404);
    return reply(result);
  } catch (e) {
    console.error("votes POST failed:", e);
    return unavailable();
  }
}
