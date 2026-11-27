import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

type Handler = (req: NextRequest) => Promise<Response>;

/**
 * Hands Auth.js the address the visitor actually used (hameats.app or www.hameats.app).
 *
 * On AWS, Next.js runs behind CloudFront and the Lambda handler, and its request.url says http://localhost:3000.
 * Auth.js builds Google's return address (redirect_uri) and its own links from request.url, so without this,
 * logging in sent people to https://localhost:3000 ("Configuration" error). CloudFront puts the real address in
 * x-forwarded-host; web/lambda/index.mjs only lets requests through that came from CloudFront (ORIGIN_VERIFY),
 * so the header can be trusted. Locally (npm run dev) there is no such header and nothing changes.
 * A fixed AUTH_URL would also work, but only for one of the two addresses: logging in from the other would lose
 * its sign-in cookies on the way back from Google.
 */
function withVisitorAddress(handler: Handler): Handler {
  return async (req) => {
    const host = req.headers.get("x-forwarded-host");
    if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return handler(req);
    const inner = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
    // Built fresh rather than by setting url.host, which would keep the internal port (:3000).
    const url = new URL(`${proto}://${host}${inner.pathname}${inner.search}`);
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    return handler(
      new NextRequest(url, { method: req.method, headers: req.headers, body: hasBody ? await req.arrayBuffer() : undefined }),
    );
  };
}

export const GET = withVisitorAddress(handlers.GET);
export const POST = withVisitorAddress(handlers.POST);
