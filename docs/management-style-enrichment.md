# Management-style enrichment

Management style is classified deterministically from explicit source language. Kron descriptions have priority; a verified KID is used only when Kron is ambiguous. Fund names, fees, benchmarks and categories never trigger classification by themselves.

PASSIVE requires phrases such as `indeksnært`, `passively managed`, or an explicit statement that the strategy tracks or replicates an index. ACTIVE requires phrases such as `aktivt forvaltet`, `actively managed`, discretionary fund management, or an explicit objective of long-term excess return. Otherwise the result is UNKNOWN.

Every observation records source type, URL, retrieval time, optional explicit source date, content hash, quality and the matching evidence. Repeating an unchanged source is idempotent.
