// The deploy this server is running; the installed app polls it to notice new deploys.
export const dynamic = "force-static";

export function GET() {
  return Response.json({ version: process.env.BUILD_ID }, { headers: { "Cache-Control": "no-cache" } });
}
