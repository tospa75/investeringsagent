# InvesteringsAgent

Teknisk grunnmur for en skybasert investeringsagent. Denne første leveransen inneholder datamodell, Supabase-tilkobling, en installérbar Next.js-PWA og en enkel fondskatalog. Innhenting, scoring, porteføljeoptimalisering og AI-logikk er med vilje ikke implementert ennå.

## Stack

- Next.js App Router, React og TypeScript
- Supabase og PostgreSQL
- Zod-validering og Vitest
- PWA-manifest og Vercel-kompatibel struktur

## Lokal oppstart

Krav: Node.js 20 eller nyere, npm og et Supabase-prosjekt.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Åpne `http://localhost:3000`. Uten gyldig Supabase-konfigurasjon starter appen fortsatt og viser databasen som frakoblet.

## Miljøvariabler

| Variabel | Eksponering | Bruk |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Nettleser og server | URL til Supabase-prosjektet |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Nettleser og server | Begrenset publishable-nøkkel, beskyttet av RLS |
| `SUPABASE_SECRET_KEY` | Kun server | Administrative backend-jobber som omgår RLS |

Kopier `.env.example` til `.env.local`. Ikke commit `.env.local` eller secret-nøkkelen. `lib/supabase/admin.ts` er markert server-only, slik at nøkkelen ikke kan pakkes inn i frontend.

## Supabase og migrasjoner

1. Opprett et Supabase-prosjekt.
2. Åpne SQL Editor i Supabase.
3. Kjør migrasjonene i `database/migrations/` i stigende filnavnrekkefølge.
4. Legg prosjektets URL, publishable key og secret key i `.env.local`.

Migrasjonen oppretter tabeller, enums, constraints, indekser, tidsstempel-trigger og RLS. Katalogtabellene kan leses med anon-nøkkelen; skriveoperasjoner og interne tabeller er fortsatt backend-only.

## Development seed-data

Seed-filen inneholder bare to fiktive fond og er tydelig merket som utviklingsdata. Kjør den i Supabase SQL Editor, eller med en PostgreSQL-tilkoblingsstreng:

```bash
DATABASE_URL='postgresql://...' npm run seed
```

Alternativt: `psql "$DATABASE_URL" -f database/seed/development.sql`.

## Kommandoer

```bash
npm run dev        # lokal utvikling
npm run typecheck  # TypeScript-kontroll
npm test           # tester
npm run build      # produksjonsbygg
npm start          # kjør produksjonsbygget
npm run ingest:kron -- NO0011101545  # hent ett Kron-fond
npm run ingest:kron -- --batch       # hent de tre Task 02-testfondene
npm run ingest:kid -- NO0011101545   # finn og verifiser KID for ett fond
npm run ingest:kid -- --batch        # KID-discovery for de tre testfondene
```

## Deploy til Vercel

Importer repositoriet i Vercel, legg inn de tre miljøvariablene for riktig miljø, og deploy. Standardkommandoen `npm run build` og Next.js-output oppdages automatisk. Kjør databasemigrasjonene i Supabase før produksjonsdeploy. Secret-nøkkelen skal kun ligge i Vercels server-side environment variables.

## Struktur

- `app/` – App Router-sider, layout og PWA-manifest
- `lib/supabase/` – separate browser-, server- og admin-klienter
- `lib/validation/` – Zod-skjemaer
- `database/` – migrasjon og utviklingsseed
- `docs/` – arkitektur, datamodell og neste MVP-fase
- `tests/` – fokuserte enhetstester
