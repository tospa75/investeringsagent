# NAV, performance and risk metrics

The public Kron graph endpoint supplies a daily total-return series and currency. It does not supply nominal unit prices. Task 08 stores this as `TOTAL_RETURN_INDEX`, rebased to 100, so it is never misrepresented as nominal NAV. Raw points remain separate from reproducible metrics.

Period boundaries use the closest published observation within ten calendar days. Missing trading days are never interpolated. Returns longer than one year use `(final / initial)^(1 / actual_years) - 1`. The upstream graph repeats index levels on weekends; raw observations are retained, while volatility, Sharpe and Sortino exclude Saturdays and Sundays before applying sample standard deviation and `sqrt(252)`.

One-, three- and five-year metrics require a boundary observation within the tolerance. A shorter series produces `null`. Maximum drawdown tracks peak, trough and the first later recovery to the old peak. Unrecovered drawdowns have a null recovery date and duration.

Sharpe uses `RISK_FREE_RATE_ANNUAL`. Sortino uses `MINIMUM_ACCEPTABLE_RETURN_ANNUAL`, defaulting to zero, and downside deviation of daily returns below the daily equivalent threshold. Neither rate is hidden in the calculation engine.

Daily changes above +500% or below -90% are flagged as anomalies and retained unchanged. The upstream series is described as total return; no currency conversion is performed.
