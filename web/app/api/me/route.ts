import { getMe } from "@/lib/profile";
import { deleteAccount } from "@/lib/account";
import { currentUser, dbEnabled, reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** Whether someone is signed in, their unread notifications, and the key for push notifications. */
export async function GET() {
  if (!dbEnabled()) return unavailable();
  const features = { pushKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null };
  const user = await currentUser();
  if (!user) return reply({ signedIn: false, ...features });
  try {
    return reply({ signedIn: true, ...(await getMe(user.id)), ...features });
  } catch (e) {
    console.error("me GET failed:", e);
    return unavailable();
  }
}

/** Deletes the signed-in person's account and everything kept about them (lib/account.ts). The app logs them out after. */
export async function DELETE(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  try {
    await deleteAccount(user.id);
    return reply({ ok: true });
  } catch (e) {
    console.error("me DELETE failed:", e);
    return unavailable();
  }
}
