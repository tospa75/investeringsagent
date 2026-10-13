import { timingSafeEqual } from "node:crypto";

export function isAuthorizedJobRequest(request: Request) {
  const expected = process.env.JOBS_ADMIN_SECRET ?? process.env.CRON_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected), actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
