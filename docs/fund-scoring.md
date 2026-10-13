# Fund scoring V1

`FUND_SCORE_MODEL_V1` scores only the latest hard-filter `PASS` results. `FAIL` and `UNKNOWN` are never normal ranking candidates.

Weights are risk 25%, geography 15%, sector 15%, cost 15%, fund-level diversification 15%, objective quality/stability 10%, and historical risk-adjusted performance 5%. All outputs are bounded to 0–100. Risk is a fit score; excess risk is penalized more strongly than equivalent under-risk.

Missing sub-inputs are excluded and the available internal weights are renormalized. A component with no usable input receives neutral 50, never automatic zero. Geography and sector also receive neutral 50 when the profile has no corresponding soft preference. Confidence is separate from score and reflects input coverage.

Cost is 70% peer-relative within category/fund type plus management style and 30% absolute. Diversification is explicitly a fund-level proxy and does not calculate portfolio overlap. Explanations are generated directly from inputs and fixed rules; no language model is used.

The quality age calculation uses the model V1 reference date 2026-10-11, making reruns reproducible. Ranking tie-breakers are total score, risk score, cost score, then ISIN.

Run all supported profiles with `npm run score:funds -- --all-profiles`, or one profile with `npm run score:funds -- --profile balanced`.
