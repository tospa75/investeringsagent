# MVP 1 – 20 Fund Validation

Generated: 2026-10-11T19:13:34.080Z

FULLY_AUTOMATED: 18  
PARTIALLY_AUTOMATED: 0  
FAILED: 2  
18/20 target: MET

FULLY_AUTOMATED requires verified Kron identity, an ISIN-verified KID, risk score, recommended holding period, management fee, transaction cost, and persisted normalized data. Scenarios are reported separately and do not alone block this status.

| Fund | ISIN | Kron | KID | Parse | Overall | Provider | Missing |
|---|---|---|---|---|---|---|---|
| Kron Indeks Global | NO0011101545 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Storebrand Global Indeks C | NO0012882036 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Storebrand Indeks – Alle Markeder A | NO0010611148 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| KLP AksjeNorge Indeks N | NO0012445214 | PARTIAL | VALID | PARTIAL | FULLY_AUTOMATED | KLP / Storebrand Fund Data | manager, currency, scenarios |
| Storebrand Europe Index N | NO0013711242 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Storebrand Indeks – Nye Markeder N | NO0010817919 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| DNB Teknologi B | NO0013004622 | PARTIAL | VALID | PARTIAL | FULLY_AUTOMATED | DNB / Morningstar | manager, currency, scenarios |
| Storebrand Global Multifactor N | NO0010817505 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Storebrand Verdi N | NO0010817836 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Storebrand Vekst B | NO0012884149 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Fidelity Funds – World Fund A-Euro | LU0069449576 | PARTIAL | VALID | PARTIAL | FULLY_AUTOMATED | Fidelity | manager, currency, scenarios |
| Fidelity Nordic A-Acc-SEK | LU0261949381 | PARTIAL | VALID | PARTIAL | FULLY_AUTOMATED | Fidelity | manager, currency, scenarios |
| Fidelity Europe Equity ESG A-Acc-EUR | LU0251128657 | PARTIAL | VALID | PARTIAL | FULLY_AUTOMATED | Fidelity | manager, currency, scenarios |
| JPM US Select Equity A (acc) USD | LU0070214290 | PARTIAL | VALID | PARTIAL | FULLY_AUTOMATED | JPMorgan Asset Management / Fundsquare | manager, currency, scenarios |
| JPM Emerging Markets Sustainable Equity A (acc) USD | LU2051468812 | PARTIAL | VALID | PARTIAL | FULLY_AUTOMATED | JPMorgan Asset Management / Fundsquare | manager, currency, scenarios |
| Storebrand Likviditet N | NO0010818008 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Storebrand Kreditt N | NO0010818057 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Storebrand Global Kreditt IG B | NO0010588031 | PARTIAL | VALID | SUCCESS | FULLY_AUTOMATED | SAM PRIIP Repository | manager, currency |
| Alfred Berg Likviditet R (NOK) | NO0010089485 | PARTIAL | FETCH_FAILED | SKIPPED | FAILED | SAM PRIIP Repository | manager, currency |
| FORTE Strategisk A | NO0010963432 | PARTIAL | INVALID | SKIPPED | FAILED | Kraft Finans | manager, currency |

## Field coverage

- fund_name: 20/20
- manager: 0/20
- currency: 0/20
- category: 20/20
- priip_risk_score: 18/20
- recommended_holding_period: 18/20
- management_fee: 18/20
- transaction_cost: 18/20
- total_annual_cost: 1/20
- entry_fee: 17/20
- exit_fee: 18/20
- performance_fee: 18/20
- scenarios: 11/20
- benchmark: 18/20
- intended_investor: 7/20

## Provider statistics

- SAM PRIIP Repository: 12 funds, 11 verified, 11 parser success, 0 partial, 1 failure
- KLP / Storebrand Fund Data: 1 funds, 1 verified, 0 parser success, 1 partial, 0 failure
- DNB / Morningstar: 1 funds, 1 verified, 0 parser success, 1 partial, 0 failure
- Fidelity: 3 funds, 3 verified, 0 parser success, 3 partial, 0 failure
- JPMorgan Asset Management / Fundsquare: 2 funds, 2 verified, 0 parser success, 2 partial, 0 failure
- Kraft Finans: 1 funds, 0 verified, 0 parser success, 0 partial, 1 failure

## Language statistics

- NO: 14 funds, 11 success, 2 partial, 1 failure
- EN: 5 funds, 0 success, 5 partial, 0 failure
- UNKNOWN: 1 fund, 0 success, 0 partial, 1 failure

## Quality distribution

- HIGH: 18
- MEDIUM: 0
- LOW: 0
- INVALID: 2
- Average across universe: 84.75
- Average normalized: 94.16666666666667

## Database counts

- funds: 20
- fund_documents: 27
- raw_source_snapshots: 19
- fund_risk: 18
- fund_costs: 18
- fund_priip_scenarios: 40
- fund_product_details: 18
- ingestion_runs: 223
- kid_parser_runs: 93
