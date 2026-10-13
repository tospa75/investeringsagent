# MVP 1 gap analysis

## Outcome

Before Task 06 the validation produced 12/20 fully automated funds. After provider hardening it produces 18/20 fully automated funds, 0 partially automated funds, and 2 failed funds. The target is met. FULLY_AUTOMATED requires verified Kron identity, an ISIN-verified KID, risk score, holding period, management fee, transaction cost, and persisted normalized data. Scenarios do not block this status.

## P0 — identity safety

- FORTE Strategisk A: the currently discovered Kraft document contains `SE0025159171`, not the requested `NO0010963432`. It remains `INVALID` and no normalized rows are created.
- No other P0 issue was observed.

## Resolved provider gaps

- Fidelity: 3/3 documents discovered from Fidelity's ISIN-derived PRIIPs endpoint and verified.
- J.P. Morgan: 2/2 documents discovered through the public Fundsquare route and verified.
- KLP: 1/1 document discovered from the public distributor page and Storebrand Fund Data endpoint and verified.

## Remaining P1 discovery gap

- Alfred Berg Likviditet R (`NO0010089485`) was merged into Swedish fund `SE0024173538` in 2025. The retired share class has no current KID link, so it remains safely failed rather than silently switching ISIN.

## P1 — parser gaps

- DNB Teknologi B: verified KID and mandatory risk/holding/cost fields succeed, but the Morningstar PDF emits scenario columns out of reading order. Scenario parsing remains `PARTIAL`.
- Storebrand Likviditet N: the KID has no safely parsed scenario rows in the current layout. Parsing remains `PARTIAL`, while mandatory fields are normalized.

## P2 — secondary field coverage

- Kron pages expose fund name and category reliably, but the current HTML does not expose the expected manager and currency labels. Coverage is 0/20 for both fields.
- `total_annual_cost` is explicit and safely parsed for only 1/20 funds. Component costs are available for all 12 normalized funds and are not summed speculatively.
- `intended_investor` is safely extracted for 1/20 funds.

## Document structures observed

- SAM PRIIP repository PDF: 18 attempted, 11 verified.
- DNB/Morningstar HTML wrapper to PDF: 1 verified; scenario columns reordered by PDF extraction.
- Kraft manager-specific PDF: 1 retrieved but rejected for ISIN mismatch.
- Seven generic SAM attempts returned HTTP 404; their document language/layout therefore remains unknown.

## Idempotency

Funds, KID snapshots, risk, costs, scenarios, and product-detail rows remained stable on repeat runs. A duplicate `FETCH_FAILED` document-attempt issue was found during the second run, fixed with a repository-level lookup, covered by regression test, and verified by a subsequent control run. Run-history tables intentionally continue to grow.

## Recommended next work

1. Improve DNB/Morningstar scenario extraction while retaining ambiguity rejection.
2. Add robust scenario parsing for English Fidelity/JPM column layouts.
3. Add manager/currency extraction from a trustworthy source.
4. Keep Alfred Berg and FORTE retired/mismatched share classes fail-closed.
