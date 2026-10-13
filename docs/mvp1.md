# MVP 1

Task 02 etablerer første del av en sporbar innhentingskjede:

```text
Kron
→ ISIN
→ KID discovery
→ verification
→ parsing
→ normalization
→ validation
→ database
```

Hvert steg skal bevare kilde, tidspunkt og verifikasjonsstatus. Rådata lagres før parsing, og hver kjøring registrerer manglende felt, advarsler, feil og samlet datakvalitet.

## Kron discovery-flyt

```text
validate ISIN → fetch Kron HTML → hash + raw snapshot → parse explicit fields
→ verify page ISIN → upsert non-null fund fields → log ingestion run
```

De tre testfondene kjøres sekvensielt med 1,5 sekunders pause. HTTP-feil, timeout, nettverksfeil, uventet innhold, parsingfeil og ISIN-mismatch gir kontrollerte `FAILED`-resultater. Én feil stopper ikke resten av batchen. Midlertidige nettverksfeil endrer ikke tilgjengelighetsstatus i `funds`.

Task 02 støtter navn, ISIN, forvalter, valuta, kategori, Kron-URL, tilgjengelighet, eksplisitt årlig pris og Morningstar-rating. Felt settes til `null` når en tydelig etikett og verdi ikke finnes. På dagens tre testider er navn, ISIN, kategori og rating tilgjengelige for alle; årlig pris mangler på FORTE Strategisk A; forvalter og valuta eksponeres ikke eksplisitt.

Kjente begrensninger:

- Parseren avhenger av synlige, etiketterte norske felt og en `h1`-tittel.
- Pris og Morningstar-rating parses, men normaliseres ikke til egne databaserader ennå.
- Ingen JavaScript-kjøring eller skjulte API-er brukes.
- KID, PRIIP, geografi, sektor, beholdninger og NAV støttes ikke i denne fasen.

Suksesskravet for den senere komplette MVP 1-leveransen er fortsatt minst 18 av 20 automatisk behandlede testfond.

## Task 03: KID discovery

KID-laget bruker provider-adaptere og prioriterer lenker fra Kron, deretter forvalter og til slutt offentlig dokumentdistributør. PDF-en hashes, teksten trekkes ut deterministisk, og dokumentets faktiske ISIN må stemme før status kan bli `VALID`. Se `docs/kid-discovery.md` for statusmodell, deduplisering og kjente provider-variasjoner. Risiko, kostnader og øvrige investeringsdata fra KID tolkes først i Task 04.
