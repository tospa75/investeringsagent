import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { DocumentType } from "@/lib/types";
import type { KidDocumentAnalysis, KidFetchResult } from "./kid-types";

export class KidAnalysisError extends Error {
  constructor(message: string) { super(message); this.name = "KidAnalysisError"; }
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.filter((item): item is TextItem => "str" in item).map((item) => item.str).join(" "));
    }
    const text = pages.join("\n").replace(/[ \t]+/g, " ").trim();
    if (!text) throw new KidAnalysisError("PDF text extraction produced no text");
    return text;
  } catch (error) {
    if (error instanceof KidAnalysisError) throw error;
    throw new KidAnalysisError(`PDF text extraction failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function parseDate(text: string): string | null {
  const context = text.match(/(?:oppdatert|oppdatert den|dokumentdato|per dato)[^\d]{0,40}(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i)?.[1];
  if (!context) return null;
  if (/^\d{4}-/.test(context)) return context;
  const [day, month, year] = context.split(".");
  return `${year}-${month}-${day}`;
}

function classifyDocument(text: string): { type: DocumentType; regulatory: boolean } {
  const regulatory = /nøkkelinformasjon|key information document/i.test(text)
    && /formål|purpose/i.test(text);
  if (regulatory) return { type: "PRIIP_KID", regulatory: true };
  if (/faktaark|factsheet/i.test(text)) return { type: "FACTSHEET", regulatory: false };
  if (/prospekt|prospectus/i.test(text)) return { type: "PROSPECTUS", regulatory: false };
  return { type: "OTHER", regulatory: false };
}

export async function analyzeKidDocument(fetched: KidFetchResult): Promise<KidDocumentAnalysis> {
  const contentType = fetched.contentType?.toLowerCase() ?? "";
  let text: string;
  if (contentType.includes("application/pdf") || fetched.bytes[0] === 0x25 && fetched.bytes[1] === 0x50) text = await extractPdfText(fetched.bytes);
  else if (contentType.includes("text/plain") || contentType.includes("text/html")) text = new TextDecoder().decode(fetched.bytes).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  else throw new KidAnalysisError(`Unsupported document content type: ${fetched.contentType ?? "missing"}`);
  if (!text) throw new KidAnalysisError("Document text extraction produced no text");
  const classification = classifyDocument(text);
  return {
    text,
    documentType: classification.type,
    documentIsins: [...new Set([...text.toUpperCase().matchAll(/\b([A-Z]{2})\s*([A-Z0-9]{9})\s*([0-9])\b/g)].map((match) => `${match[1]}${match[2]}${match[3]}`))],
    publicationDate: parseDate(text),
    isRegulatoryKid: classification.regulatory,
  };
}
