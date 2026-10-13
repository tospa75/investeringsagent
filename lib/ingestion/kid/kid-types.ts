import type { DataQuality, DataValidity, DocumentType } from "@/lib/types";

export type KidDiscoveryMethod = "KRON_PAGE_LINK" | "MANAGER_PAGE" | "PUBLIC_DISTRIBUTOR";

export interface KidFundIdentity {
  id: string;
  isin: string;
  name: string;
  shareClass: string | null;
  kronUrl: string | null;
}

export interface KidCandidate {
  url: string;
  documentType: "KID" | "PRIIP_KID";
  discoveryMethod: KidDiscoveryMethod;
  providerName: string;
  authoritative: boolean;
}

export interface KidProvider {
  name: string;
  canHandle(fund: KidFundIdentity): boolean;
  discover(fund: KidFundIdentity, fetchImpl?: typeof fetch): Promise<KidCandidate | null>;
}

export interface KidFetchResult {
  sourceUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string | null;
  retrievedAt: string;
  lastModified: string | null;
  contentHash: string;
  bytes: Uint8Array;
}

export interface KidDocumentAnalysis {
  text: string;
  documentType: DocumentType;
  documentIsins: string[];
  publicationDate: string | null;
  isRegulatoryKid: boolean;
}

export interface KidVerification {
  status: DataValidity;
  isinVerified: boolean;
  fundNameVerified: boolean;
  shareClassVerified: boolean;
  confidence: DataQuality;
  notes: string[];
}

export interface KidIngestionResult {
  fund: KidFundIdentity;
  providerName: string | null;
  discoveryMethod: KidDiscoveryMethod | null;
  documentType: DocumentType | null;
  publicationDate: string | null;
  status: DataValidity;
  confidence: DataQuality;
  isinVerified: boolean;
  snapshot: "saved" | "duplicate" | "not-saved";
  errors: string[];
  notes: string[];
}
