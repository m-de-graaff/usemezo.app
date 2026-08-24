# usemezo

A Turborepo monorepo, laid out the way [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo) does it.

Next.js 16 (Turbopack), React 19.2, TypeScript 7, Tailwind 4, Drizzle, tRPC 11,
Better Auth, and Biome.

```
apps/
  nextjs/          Next.js 15 web app (App Router) — the only app so far
packages/
  api/             tRPC routers and context
  auth/            Better Auth config, client helpers, transactional email
  db/              Drizzle schema, client, and hand-written migrations
  env/             Shared, validated environment variables
  ui/              shadcn/ui components and the Tailwind entrypoint
tooling/
  typescript/      Shared tsconfig bases
```

Packages export TypeScript source rather than build output; `apps/nextjs`
compiles them through `transpilePackages`. Adding a package means adding it
there too.

## Getting started

```bash
pnpm install
cp .env.example .env      # then fill in the blanks
pnpm dev
```

The app runs on http://localhost:3050.

### Environment

There is one `.env`, at the repository root. Next only reads `.env` from its own
directory, so `apps/nextjs/next.config.js` loads the root file explicitly before
anything touches `process.env`; `packages/db/drizzle.config.ts` does the same.

Routing lives in `apps/nextjs/src/proxy.ts` — Next 16's replacement for
`middleware.ts`. It runs on the Node runtime, which `proxy` does not let you
configure.
Add new variables to the schema in `packages/env/src/index.ts` or they will not
be readable.

### Email

Development mail goes to SMTP at `SMTP_URL` — a local
[Mailpit](https://mailpit.axllent.org/), inbox at http://localhost:8025:

```bash
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
```

Setting `RESEND_API_KEY` switches delivery to Resend, which sends real mail.

### Database

`mezo-db` (Postgres 17) holds tables this repo's schema does not declare yet, so
`drizzle-kit push` and `generate` would try to drop them. Until
`packages/db/src/schema.ts` is brought in line — `drizzle-kit pull` is the way to
start — write changes as SQL in `packages/db/migrations/` and apply them:

```bash
docker exec -i mezo-db psql -U mezo -d mezo -v ON_ERROR_STOP=1 < packages/db/migrations/<file>.sql
```

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Every app in dev mode |
| `pnpm build` | Build everything |
| `pnpm typecheck` | `tsc --noEmit` per package |
| `pnpm test` | Node's test runner |
| `pnpm check` / `check:write` | Biome lint and format |
| `pnpm db:studio` | Drizzle Studio |

## Adding the Expo app

The layout already accounts for it: `packages/api`, `packages/auth`, and
`packages/db` carry no Next-specific imports, so a React Native client can share
them. Scaffold it into `apps/expo` when the web app is far enough along.
