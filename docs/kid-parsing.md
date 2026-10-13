# KID parsing

`npm run parse:kid -- <ISIN>` parses only the latest `VALID`, ISIN-verified PRIIP KID already stored by Task 03. `--batch` processes the three reference funds. Invalid or mismatched documents are logged as `SKIPPED`.

Parsing is deterministic and supports Norwegian and English labels. Percentages are stored as decimal fractions: `0,15 %` becomes `0.0015`. Values that cannot be tied safely to a field remain `null` and lower the quality score.

Normalized rows link to `fund_document_id`, source URL, document date, and retrieval time. A repeated parse of the same document is idempotent. Older document rows remain in history and only the newest version is current.
