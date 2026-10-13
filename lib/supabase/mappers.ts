import type { Fund, FundRow } from "@/lib/types";

export function mapFundRow(row: FundRow): Fund {
  return {
    id: row.id, isin: row.isin, name: row.name, manager: row.manager,
    shareClass: row.share_class, currency: row.currency, fundType: row.fund_type,
    category: row.category, activePassive: row.active_passive, benchmark: row.benchmark,
    inceptionDate: row.inception_date, kronUrl: row.kron_url,
    availableOnKron: row.available_on_kron, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
