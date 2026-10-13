import { createHash } from "node:crypto";
import type { KronFetchResult } from "./kron-types";

const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT = "InvesteringsAgent/0.2 (personal fund analysis; respectful single-request ingestion)";

export class KronFetchError extends Error {
  constructor(message: string, public readonly code: "TIMEOUT" | "NETWORK") {
    super(message);
    this.name = "KronFetchError";
  }
}

export function hashRawContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function fetchKronFundPage(
  isin: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<KronFetchResult> {
  const url = `https://www.kron.no/fond/${encodeURIComponent(isin)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: controller.signal,
    });
    const content = await response.text();
    return {
      isin, url, statusCode: response.status, retrievedAt: new Date().toISOString(), content,
      contentType: response.headers.get("content-type"), contentHash: hashRawContent(content),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new KronFetchError(`Kron request timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`, "TIMEOUT");
    throw new KronFetchError(`Kron network request failed: ${error instanceof Error ? error.message : "unknown error"}`, "NETWORK");
  } finally {
    clearTimeout(timeout);
  }
}
