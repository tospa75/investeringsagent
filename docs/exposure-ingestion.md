# Exposure ingestion

Task 07 ingests geography, sectors, top holdings and asset allocation from the structured data embedded in the public Kron fund page. No values are inferred when the source omits a dataset.

Run one fund with `npm run ingest:exposure -- <ISIN>` or the 18-fund Task 06 universe with `npm run ingest:exposure -- --batch`.

The `exposure_datasets` row is the immutable source-version header. Child rows reference it from `fund_geography`, `fund_sectors`, `fund_holdings` and `fund_asset_allocations`. A repeated `(fund, source, source_date, content_hash)` is ignored, while changed source content produces a new version.

Kron currently publishes a NAV market date but no explicit date for its exposure breakdown. The importer deliberately stores `source_date = null`, preserves the retrieval timestamp separately, emits a warning and assigns `MEDIUM` quality. It never presents the NAV date as the holdings date.

Region, country and sector names are mapped independently. Percentages are stored in percentage points and are never automatically rescaled. Totals above 100.5% produce warnings. Geography or sector totals below 95% are marked `PARTIAL`.
