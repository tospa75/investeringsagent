# User profiles and hard filters

Task 09 converts validated profile answers into deterministic PASS, FAIL or UNKNOWN results. It does not rank funds and ignores soft constraints.

`max_acceptable_risk` is the minimum of willingness, capacity, a horizon cap and a liquidity cap. High willingness can therefore never override low capacity. Holding periods up to the user's horizon pass; an overrun of at most one year is a documented tolerance; a larger difference fails.

Missing data required by a hard cost, risk, exposure, activity, currency or quality rule is critical `UNKNOWN`. Any FAIL overrides UNKNOWN. With no FAIL, any critical UNKNOWN produces UNKNOWN; otherwise the fund passes.

Geography and sector rules use normalized exposure weights, never fund names. Cost rules use total annual cost when present, otherwise management plus transaction cost only when both are known. Activity exclusions remain UNKNOWN until documented activity data exists.

Profile updates increment `profile_version`. Filter results keep profile and data versions, so reevaluation is idempotent for the same profile/data pair while changed fund data creates a new auditable result.
