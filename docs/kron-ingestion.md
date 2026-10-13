# Kron ingestion

## Lokal kjøring

Kjør først begge databasemigrasjonene og konfigurer `.env.local` med Supabase URL og service-role-nøkkel. Enkeltfond:

```bash
npm run ingest:kron -- NO0011101545
```

Det avtalte testsettet, sekvensielt:

```bash
npm run ingest:kron -- --batch
```

Ingen argumenter er det samme som `--batch`. Scriptet returnerer exitkode 1 dersom ett eller flere fond feiler.

## Ansvarsdeling

- `fetch-kron-fund.ts` – URL, timeout, User-Agent, responsmetadata og SHA-256
- `parse-kron-fund.ts` – kun eksplisitte, synlige felt
- `kron-validator.ts` – ISIN-verifikasjon, tilgjengelighet og kvalitetsscore
- `kron-repository.ts` – Supabase-persistens og deduplisering
- `ingest-kron-fund.ts` – kontrollert orkestrering og feilhåndtering

HTML lagres som en JSON-streng i `raw_content`. Store binærfiler skal ikke lagres her.

## Kvalitetsscore V0.1

En uverifisert ISIN gir alltid 0. Ved verifisert ISIN fordeles 100 poeng slik:

| Felt | Poeng |
| --- | ---: |
| Verifisert ISIN | 40 |
| Fondnavn | 25 |
| Avklart tilgjengelighet | 15 |
| Forvalter | 7 |
| Valuta | 7 |
| Kategori | 6 |

Manglende valgfrie felt gir `PARTIAL`, med feltet i både `warnings` og `missing_fields`. Innholdshash dedupliseres på kombinasjonen kilde, URL og hash.
