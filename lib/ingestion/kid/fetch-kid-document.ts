import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { KidFetchResult } from "./kid-types";

const USER_AGENT = "InvesteringsAgent/0.3 (personal KID discovery; respectful single-document access)";

export class KidFetchError extends Error {
  constructor(message: string, public readonly code: "TIMEOUT" | "NETWORK" | "HTTP_404" | "HTTP_429" | "HTTP_5XX" | "HTTP_OTHER") {
    super(message); this.name = "KidFetchError";
  }
}

export function hashDocument(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function fetchKidDocument(
  sourceUrl: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<KidFetchResult> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    let response = await fetchImpl(sourceUrl, {
      headers: { Accept: "application/pdf,text/plain,text/html;q=0.8", "User-Agent": USER_AGENT }, redirect: "follow", signal: controller.signal,
    });
    if (response.status === 406) response = await fetchImpl(sourceUrl, {
      headers: { Accept: "*/*", "User-Agent": USER_AGENT }, redirect: "follow", signal: controller.signal,
    });
    if (response.status === 404) throw new KidFetchError("KID document returned HTTP 404", "HTTP_404");
    if (response.status === 429) throw new KidFetchError("KID provider returned HTTP 429", "HTTP_429");
    if (response.status >= 500) throw new KidFetchError(`KID provider returned HTTP ${response.status}`, "HTTP_5XX");
    if (!response.ok) throw new KidFetchError(`KID provider returned HTTP ${response.status}`, "HTTP_OTHER");
    let bytes = new Uint8Array(await response.arrayBuffer());
    let contentType = response.headers.get("content-type");
    if (contentType?.toLowerCase().includes("text/html")) {
      const html = new TextDecoder().decode(bytes);
      const $ = cheerio.load(html);
      const iframe = $("iframe[src]").first().attr("src");
      if (iframe && /(?:priip\s*kid|nøkkelinformasjon)/i.test($("body").text())) {
        response = await fetchImpl(new URL(iframe, response.url || sourceUrl), {
          headers: { Accept: "application/pdf", "User-Agent": USER_AGENT }, redirect: "follow", signal: controller.signal,
        });
        if (!response.ok) throw new KidFetchError(`Embedded KID returned HTTP ${response.status}`, response.status === 404 ? "HTTP_404" : response.status === 429 ? "HTTP_429" : response.status >= 500 ? "HTTP_5XX" : "HTTP_OTHER");
        bytes = new Uint8Array(await response.arrayBuffer());
        contentType = response.headers.get("content-type");
      }
    }
    return {
      sourceUrl, finalUrl: response.url || sourceUrl, statusCode: response.status,
      contentType, retrievedAt: new Date().toISOString(),
      lastModified: response.headers.get("last-modified"), contentHash: hashDocument(bytes), bytes,
    };
  } catch (error) {
    if (error instanceof KidFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new KidFetchError(`KID request timed out after ${timeoutMs} ms`, "TIMEOUT");
    throw new KidFetchError(`KID network request failed: ${error instanceof Error ? error.message : "unknown error"}`, "NETWORK");
  } finally { clearTimeout(timeout); }
}
