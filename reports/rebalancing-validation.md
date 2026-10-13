# Rebalancing validation

Generated: 2026-10-11T22:10:08.762Z

Database validation: complete

| Scenario | Status | Drift | Confidence | Actions | Turnover | Events |
|---|---|---:|---|---:|---:|---:|
| balanced | IN_BALANCE | 0.00 % | HIGH | 0 | 0.00 NOK | 0 |
| overweightSaleRequired | REBALANCE_REQUIRED | 20.00 % | HIGH | 2 | 40000.00 NOK | 0 |
| newCashFirst | REBALANCE_REQUIRED | 20.00 % | HIGH | 1 | 40000.00 NOK | 0 |
| avoidRealization | REBALANCE_REQUIRED | 20.00 % | HIGH | 0 | 0.00 NOK | 0 |
| staleNav | REBALANCE_REQUIRED | 20.00 % | MEDIUM | 2 | 40000.00 NOK | 0 |
| hardConstraint | REBALANCE_REQUIRED | 20.00 % | HIGH | 0 | 0.00 NOK | 1 |
| invalidFund | REBALANCE_REQUIRED | 20.00 % | HIGH | 0 | 0.00 NOK | 1 |

## Example actions

- SELL A: 20000.00 NOK — Actual weight exceeds target/no-trade range; sale funds underweights while minimizing turnover
- BUY B: 20000.00 NOK — Fund remains underweight after new cash; funded by proposed sales

## New cash first

- BUY B: 40000.00 NOK — Target 50.00%; new cash reduces the largest underweight without a sale

## Monitoring examples

- CRITICAL REGION_MAX_BREACH: NORTH_AMERICA exposure 70.00% exceeds 50.00%
- CRITICAL FUND_REVIEW_REQUIRED: Fund A is unavailable or has invalid documentation; manual review required

## Live database validation

- Target proposal: 625355b1-b491-468e-bcf1-8d8b64909926 (PORTFOLIO_CONSTRUCTION_MODEL_V1_3)
- Target funds: 4
- First/second plan inserts: 1/0
- First/second event inserts: 1/0
- Confidence: HIGH
- Drift: 50.00 %
- Turnover: 106000.00 NOK
- Estimated cost: 106.00 NOK
- Peak rows: {"portfolio_monitoring_events":1,"rebalance_plans":1,"rebalance_plan_actions":5}
- Temporary validation rows: cleaned up
