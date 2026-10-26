import { neon } from "@neondatabase/serverless";

/** Whether a database is connected (DATABASE_URL, set by Vercel's Neon integration). Without one, the app runs as before. */
export const dbEnabled = () => !!process.env.DATABASE_URL;

let client: ReturnType<typeof neon> | undefined;
const sql = () => (client ??= neon(process.env.DATABASE_URL!));

export type Row = Record<string, unknown>;
export type Statement = [text: string, params?: unknown[]];

/** One query with $1, $2... placeholders. */
export async function run(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await sql().query(text, params)) as Row[];
}

/** Several queries as one transaction; the result is each query's rows, in order. */
export async function transaction(statements: Statement[]): Promise<Row[][]> {
  const db = sql();
  return (await db.transaction(statements.map(([text, params]) => db.query(text, params ?? [])))) as Row[][];
}
