# KID discovery

Task 03 implementerer kjeden `verifisert ISIN → discovery → dokument → innholdsverifikasjon → database` uten å tolke risiko, kostnader eller investeringshorisont.

## Prioritert discovery

1. Eksplisitt KID-/PRIIP-lenke på Kron-siden.
2. Forvalterside via provider-adapter (DNB eller Kraft Finans).
3. Offentlig PRIIP-distributør (SAM Repository).

En URL godtas aldri alene. Dokumenttekst må klassifiseres som regulatorisk KID og inneholde nøyaktig forespurt ISIN. Fondsnavn og andelsklasse gir ekstra tillit, men ISIN er minimumskravet.

## Dokumentbehandling

PDF lastes kontrollert med timeout, redirect og identifiserende User-Agent. SHA-256 beregnes på originalbytes. Binærfilen holdes kun i minnet under behandling; PostgreSQL mottar ekstrahert tekst i `raw_source_snapshots`, ikke PDF eller base64. HTTP `Last-Modified` lagres ikke som regulatorisk dokumentdato.

Samme KID-hash for samme fond dedupliseres. Ny hash på samme URL blir en ny dokumentversjon.

## Status og tillit

- `VALID`: regulatorisk KID og identisk ISIN
- `INVALID`: feil dokumenttype, manglende ISIN eller ISIN-mismatch
- `UNVERIFIED`: ingen kandidat kunne finnes
- `FETCH_FAILED`: kontrollert HTTP-/nettverksfeil
- `STALE`: støttet av modellen for senere datologikk

`HIGH` krever autoritativ kilde, ISIN, fondsnavn og sikker dokumentdato. Et gyldig dokument uten alle tilleggssignaler får `MEDIUM`. Task 03-runs merkes `KID_DISCOVERY`, separat fra `KRON_DISCOVERY`.

## Kommandoer

```bash
npm run ingest:kid -- NO0011101545
npm run ingest:kid -- --batch
```

## Kjente live-avvik

- Kron Indeks Global: gyldig PRIIP KID finnes via offentlig repository.
- DNB Teknologi B: DNB/Morningstar bruker en HTML-wrapper med innebygd PDF; fetch-laget følger den eksplisitte KID-rammen én gang.
- Tidligere FORTE Strategisk A er erstattet/omdøpt hos forvalter. Dagens KRAFT Strategisk A-dokument har et annet svensk ISIN og blir derfor korrekt avvist for `NO0010963432`.
