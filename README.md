# Household-Inventory

...

## Cloudflare deployment

The production app can run as a single Cloudflare Worker with static assets and
the existing D1-backed API routes. The `DB` binding must point at the production
D1 database in `wrangler.jsonc`.

Before the first auth-enabled deployment, export a D1 backup, apply migrations,
and backfill the pre-auth records into the initial household:

```bash
npx wrangler d1 export DB --remote --config wrangler.jsonc --output backups/d1-before-auth.sql
npm run db:migrate:cloudflare
npx wrangler d1 execute DB --remote --config wrangler.jsonc --file scripts/backfill-initial-household.sql
npm run deploy:cloudflare
```

Create a long random value and save it as the encrypted Worker secret
`BOOTSTRAP_TOKEN` (Cloudflare Dashboard → Worker → Settings → Variables and
Secrets). Then visit `/setup` exactly once to create the first owner. The setup
endpoint closes as soon as the first user exists. Do not store the secret in
source control. For local development, copy `.dev.vars.example` to `.dev.vars`.

The app is invite-only. Owners create single-use, seven-day invitation links in
Settings. The browser uses a Secure, HttpOnly session cookie; a future native
client can use `/api/auth/token` and send the returned token as
`Authorization: Bearer …`.

The ChatGPT Sites manifest remains in place so the existing deployment can stay
online while the Cloudflare deployment is verified.

The `workers.dev` production URL is enabled and preview URLs are disabled. All
application APIs require an active household membership, and every data query is
scoped to the household selected in the server-side session.
