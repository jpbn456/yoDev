# yoDev

yoDev is a React/Vite developer directory backed by a shared TypeScript server and two isolated database targets:

| Branch | Platform | Database | Purpose |
| --- | --- | --- | --- |
| `main` | Vercel | Turso/libSQL | Production application |
| `test` | Cloudflare Worker | Isolated D1 `yodev-test` | Test environment |

The Vercel production runtime uses Turso/libSQL. The Cloudflare test runtime reuses the shared application layer through a Worker adapter backed by D1.

## Local setup

```bash
npm ci
npm --prefix frontend ci
npm --prefix cloudflare ci
npm run typecheck
npm test
npm run build
```

Create and migrate an isolated local libSQL database without production credentials:

```bash
npm run db:migrate:local
```

The migration runner tracks applied files in `_yodev_migrations`, applies each migration transactionally, and is safe to rerun. A fresh database receives schema history `0001` through `0009` and exactly the skill catalog from those migrations. Migration `0007` remains inert application history: there is no email verification flow and no email provider integration. The runner never copies users, profiles, or sessions.

## Production: `main` to Vercel

Link the repository root to Vercel and enable native Git deployment for `main`. `vercel.json` installs the root and frontend lockfiles, builds `frontend/dist`, serves same-origin `/api/*` Node Functions, renders public profile metadata, and falls back to the SPA for manual routes.

Configure these Vercel environment variables without committing their values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Yes | Production libSQL URL |
| `TURSO_AUTH_TOKEN` | Yes for remote Turso | Database credential |
| `APP_ORIGIN` | Recommended | Canonical HTTPS origin, for example the production custom domain |
| `RATE_AUTH_MAX` | No | Best-effort per-instance auth attempt limit; defaults to `10` |

Run migrations as an explicit release step **before** enabling production traffic. Do not run migrations from serverless functions:

```bash
npm run db:migrate
```

The command reads credentials only from the process environment and does not print them.

## Test: `test` to Cloudflare

The isolated D1 database `yodev-test` is configured in `cloudflare/wrangler.jsonc` under `env.test`.

Before enabling `.github/workflows/cloudflare-test.yml`:

1. Add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
2. Confirm `APP_ORIGIN` and `CORS_ORIGIN` match the actual `yodev-api-test` URL.

Only pushes to `test` trigger the workflow. Tests and typechecks must pass before D1 migration and `wrangler deploy --env test`. The base Worker and its existing production D1 binding are unchanged; never deploy the test branch without `--env test`.

## Security and routing

- API calls are same-origin on both platforms.
- HTTPS cookies are host-only, `Secure`, `HttpOnly` for sessions, and `SameSite=Lax`.
- Mutations require a matching CSRF cookie/header and reject mismatched `Origin` or `Referer` headers.
- Public profile metadata escapes database values and derives canonical URLs from `APP_ORIGIN` or the request origin.
- Security headers are applied by both runtime handlers and Vercel static routing.

## Rollback boundaries

- **Application rollback:** revert the Vercel deployment or Cloudflare Worker version. This does not revert database schema.
- **Turso schema rollback:** restore a Turso backup/point-in-time state or apply a reviewed forward migration. Never delete migration tracking rows to simulate rollback.
- **Cloudflare test rollback:** use Worker version rollback for code; restore/recreate only `yodev-test` for data. The existing base D1 database is outside the test rollback boundary.
- **Fresh production reset:** while production contains only the seeded catalog, the operator may replace the empty Turso database and rerun migrations. Once user data exists, use backup/restore instead.
