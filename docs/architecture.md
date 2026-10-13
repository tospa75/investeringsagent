# Arkitektur

InvesteringsAgent er foreløpig en liten, enkelt deploybar webapplikasjon:

```text
PWA / Next.js
      ↓
Backend / serverfunksjoner
      ↓
Supabase / PostgreSQL
      ↓
Senere: Kron + KID + markedsdata
```

Next.js App Router leverer både PWA-grensesnittet og server-side datatilgang. Nettleseren bruker kun Supabase anon-nøkkel og begrenses av Row Level Security. Server-side bruker samme tilgang i dagens leseflyt. En separat service-role-klient finnes for fremtidige, betrodde backend-jobber og kan ikke importeres i klientkomponenter.

PostgreSQL er system of record for normaliserte fondsdata og innhentingsmetadata. Rå kildeinnhold kan lagres som JSONB, mens store PDF-filer senere skal ligge i Supabase Storage eller ekstern objektlagring.
