import "server-only";
import type { z } from "zod";

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const fail = (status: number, error: string) => json({ error }, status);

/** Parse and validate a JSON body. Returns the data or a 400 Response. */
export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : fail(400, "invalid_request");
}
