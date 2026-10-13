# Datamodell

`funds` er rotobjektet og identifiserer en andelsklasse med den unike kombinasjonen ISIN + `share_class`. ISIN har i tillegg egen indeks.

Underliggende tabeller:

- `fund_costs` – kostnadskomponenter og kilde
- `fund_risk` – PRIIP-risiko og historiske risikomål
- `fund_geography`, `fund_sectors`, `fund_holdings` – eksponeringer med kilde- og hentetid
- `fund_documents` – verifiserte dokumentreferanser og gyldighetsstatus
- `ingestion_runs` – resultat, datakvalitet og strukturerte advarsler/feil per kjøring
- `raw_source_snapshots` – hash og JSONB-råinnhold før normalisering

Relasjoner slettes kaskadert med fondet, bortsett fra kjøringer og rå snapshots. Disse beholder revisjonshistorikken og setter `fund_id` til null. Prosentverdier begrenses til meningsfulle intervaller. `holding_type` støtter equity, bond, fund, cash og other, slik at fond-i-fond kan representeres senere.

Datakvalitet støttes av enumene `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`; datapunktstatus støttes av `VALID`, `STALE`, `CONFLICT`, `MISSING`.
