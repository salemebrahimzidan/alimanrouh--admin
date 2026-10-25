# Deployment and integration plan

This document describes local implementation and a later, separately approved production release. No hosted SQL, commit, push, or deployment is part of this work.

This is a fresh booking start. There are no legacy booking records to migrate, preserve, or display. The bookings section in the admin app stays in place for reservations customers create later.

## Architecture

| Surface | Host | Backend |
| --- | --- | --- |
| Public website | `https://alimanrouh.com` | Separate repository. Inquiry forms now use the shared support RPCs; catalog and booking integrations remain independent. |
| Admin dashboard | `https://admin.alimanrouh.com` | This repository, deployed on Vercel. |
| Shared data | `https://ptjtiexrgwjomvaefouo.supabase.co` | One Supabase project for Auth, tables, storage, and RPCs. |

The anon key may be used by both frontends. The service-role key stays out of both. Do not delete existing Auth users, the administrator account, or database tables.

The schema migration and administrator bootstrap are already applied on the hosted project. Do not run `supabase/migrations/20261020120000_init_admin_schema.sql` again. A second run fails because the script is not idempotent. `supabase/manual/rls_review.sql` rolls back its own transaction; it is a manual review script and is not part of startup. Do not run it against hosted Supabase unless you intend to execute that reviewed session yourself.

## Existing public-site dependencies

Inspected in the public website repository. Inquiry form delivery has been moved to Supabase; leave the unrelated catalog and booking dependencies in place.

Railway base URL: `https://alimanrouh-api-production.up.railway.app` (`VITE_API_URL` overrides it).

| Caller | Railway use | Action |
| --- | --- | --- |
| `src/services/packages.ts` | `GET /packages` for the home, Umrah, Hajj, and booking pages | Keep. These pages still need the current catalog and ids. |
| `src/features/rouh-aleman/shared/utils/packages.ts` | Prefixes relative package images with the Railway host | Keep with the package catalog. |
| `src/services/bookings.ts` | `POST /bookings` from the guest form | Replace later with Supabase, not before the catalog moves. |
| `src/features/rouh-aleman/pages/contact/submit-contact-form.ts` | Support RPC for registered and guest conversations. | Keep on the unified support system. |

Do not remove the Railway client while package listing or package images still use it.

## Admin dashboard and customer support

The admin dashboard has one `الاستفسارات` section at `/inquiries`. It displays all Hajj, Umrah, contact, booking-question, and complaint threads from the shared support tables. No Hajj-specific inbox remains. Legacy Hajj detail links resolve to the imported unified conversation when possible.

Payments records manual receipts only. There is no card gateway. The payments list names the foreign keys `payments_customer_id_fkey` and `payments_booking_id_fkey` because `payments` also has the composite key `payments_booking_customer_fk`. An unhinted embed is ambiguous, and that ambiguity is not a missing database.

## Phase 2 — customer accounts on the public site

Use `@supabase/supabase-js` with `persistSession`, `autoRefreshToken`, and `detectSessionInUrl`, pointed at the same project URL and anon key.

Registration payload:

```ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName, mobile },
    emailRedirectTo: 'https://alimanrouh.com/account',
  },
})
```

Only `full_name` and `mobile` are copied into `profiles`. Any other metadata, including a role, is ignored. Confirming the email moves `account_status` from `pending_verification` to `active` unless an administrator has suspended the account. The existing `handle_new_user` trigger is what makes the person appear in the admin customer list with zero bookings.

Password reset should redirect to `https://alimanrouh.com/reset-password`. Add that origin to the Supabase redirect allow list before sending mail. The admin app uses its own origin plus `/reset-password`.

Suggested routes, adapted from this repo but keeping the public visual design:

| Route | Source to adapt |
| --- | --- |
| `/register` | `src/portal/AuthPages.tsx` |
| `/login` | `src/portal/AuthPages.tsx` |
| `/account` | `src/portal/AccountPages.tsx` |
| `/account/bookings` and `/account/bookings/:id` | `src/portal/TravelPages.tsx` |
| `/account/visas` and `/account/visas/:id` | `src/portal/TravelPages.tsx` |
| `/account/documents` | `src/portal/AccountPages.tsx` |
| `/account/profile` | `src/portal/AccountPages.tsx` |

The portal in this repo is a functional reference. It is enabled in `npm run dev` and hidden on `admin.alimanrouh.com` unless `VITE_ENABLE_CUSTOMER_PORTAL=true`. Leave that variable unset in the admin production project.

## Phase 3 — replace the guest booking flow

Do this only after Phase 2. The current public form posts an anonymous payload (`fullName`, `phone`, `email`, `adults`, `children`, `travelDate`, `packageId`, `notes`) to Railway. Supabase does not accept that shape.

Blockers before the cutover:

- The booking insert requires a signed-in customer whose `account_status` is `active`. Anonymous visitors cannot create rows.
- `package_id` must be a published `umrah_packages.id` from this Supabase project. Railway package ids are a different catalog and will be rejected.
- The public package picker therefore has to read published Supabase packages before the form stops calling `POST /bookings`.
- There is one `travelers_count`. Map it as `adults + children`. The database has no separate child column. Put a child count in `customer_note` only if the agency still wants that split visible.
- Do not import, replay, or store the old Railway booking responses. New reservations start empty.

Customer insert, after sign-in:

```ts
await supabase.from('bookings').insert({
  customer_id: user.id,
  package_id: packageId,
  travel_date: travelDate,
  travelers_count: travelers,
  customer_note: note,
  status: 'pending',
  total_amount: 0,
  package_title_snapshot: '',
})
```

`prepare_customer_booking` replaces the reference, forces `pending`, and sets `total_amount` from the published package price multiplied by the traveler count. The client preview is not authoritative.

Customers read their own `booking_rows` and `booking_status_history` for status tracking. They cannot read `internal_notes`. Administrators manage the same rows in this dashboard.

After that path works, stop calling Railway `POST /bookings`. Keep `GET /packages` and the image prefix until the home, Umrah, and Hajj pages read `umrah_packages` and `hajj_programs` from Supabase.

## Published content

Anonymous visitors can read published rows only:

- `umrah_packages` where `is_published = true`
- `hajj_programs` where `is_published = true`
- `website_content` where `is_published = true` and `kind` is `banner`, `offer`, or `announcement`

Images are storage paths in the public `public-media` bucket, not arbitrary URLs. Build the URL with `supabase.storage.from('public-media').getPublicUrl(path)`.

Show the Hajj disclaimer already used in the admin app: program information is agency content, not an official quota, approval, or license.

## Visa applications and documents

Insert into `visa_applications` with the customer's own `customer_id` and status `submitted`. The reference is assigned in the database. Status labels must stay the internal ones from `src/lib/labels.ts`.

Upload files to `customer-documents` at `{userId}/{uuid}.ext`, then insert a `customer_documents` row with that exact `storage_path`. Accepted types are PDF, JPEG, PNG, and WebP, up to 10 MB. Open files with `createSignedUrl`; do not make the bucket public.

## Unified inquiries and complaints

`support_conversations` and `support_messages` are the single source of truth for all customer questions and complaints. The admin navigation is `/inquiries` (Arabic label: `الاستفسارات`); old `/hajj/inquiries` links redirect there. Hajj/Umrah program questions, general contact, complaints, and booking-related questions all use this inbox. Creating or changing an actual booking remains a separate booking workflow.

The public website submits registered messages with `support_create_registered_conversation(p_subject, p_body, p_topic, p_context)`. Guest create/read/reply requests go to the same-origin Vercel Function at `/api/support/guest`, which dispatches only the three fixed guest RPCs. Topics are `general`, `contact`, `hajj`, `umrah`, `booking`, or `complaint`. Hajj/Umrah program context is kept as bounded text; it does not create a second inquiry table or workflow.

Guest creation returns a one-time random 256-bit `access_token`; only its SHA-256 hash is stored in Supabase. The website keeps the bearer token in session storage, never in a URL, and offers a way for the guest to copy/save it for later. Guests receive no direct table access and do not subscribe to table Realtime. The guest page polls the token-checked read RPC every eight seconds. Registered customers are limited by RLS to their own rows and use Supabase Realtime; the admin uses the inbox Realtime subscription.

The migration imports existing Hajj inquiry rows into one linked support conversation and one initial message per row. It leaves the legacy rows and their statuses untouched; a unique `linked_hajj_inquiry_id` and `ON CONFLICT DO NOTHING` prevent duplicate imports. The one-way insert trigger is retained only as a compatibility bridge for legacy inserts. There is no status synchronization in either direction after the initial import: `support_conversations.status` is authoritative. The migration aborts if an existing Hajj trigger appears to reference support conversations or synchronize status; review all listed Hajj triggers during preflight. New website forms call support RPCs and do not insert into `hajj_inquiries`.

Admin status changes use the admin-checked `support_admin_set_status` RPC, and unread/read changes use `support_mark_read`. Customers cannot directly change status, counters, or message read timestamps.

### Trusted guest rate limiting

PostgreSQL does **not** read or trust client IP headers. Guest create/read/reply RPC execution is revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role`; therefore the public browser cannot bypass the Vercel API by calling Supabase RPC directly. The public site runs on Vercel and uses Vercel's documented `@vercel/functions` `ipAddress(request)` helper, which reads `x-real-ip`; Vercel documents that `x-real-ip` is identical to `x-forwarded-for`, and identifies `x-forwarded-for` as the requester's public IP. The function additionally requires Vercel's `VERCEL=1` runtime marker and `x-vercel-id`, validates the returned address as IPv4/IPv6, and fails closed if any check is missing. The Vercel preview test must confirm that client-supplied IP headers are replaced by platform ingress metadata; do not enable guest support until it passes.

The Vercel Function calls only the fixed guest RPCs using `SUPABASE_SERVICE_ROLE_KEY`, which is a server-only Vercel environment variable and is never exposed to either browser app. Shared atomic Upstash Redis sliding-window limits are create 10, guest reads 120, and replies 60 per client IP in 10 minutes. PostgreSQL additionally rate-limits creation by normalized email/phone and replies by conversation-token hash. If Vercel IP metadata or Upstash is unavailable/misconfigured, guest create/read/reply fails closed. Registered customer inquiries and Admin functions are unaffected.

Vercel documents `x-forwarded-for` as the requester IP and says it overwrites that header when a proxy sits in front; its `ipAddress()` helper reads the equivalent `x-real-ip` header. Hostinger is the DNS provider, not an HTTP proxy, so the production hostname must resolve directly to Vercel. Do not enable a Hostinger proxy or put another proxy/CDN in front of Vercel without Enterprise Trusted Proxy support and a reviewed IP strategy. The Vercel preview ingress test must verify that client-supplied `x-real-ip` and `x-forwarded-for` values cannot set the limiter identity. Confirm these assumptions against the production project's DNS/routing configuration before enabling guest inquiries.

Required Vercel **server-side** environment variables:

- `SUPABASE_URL` — shared Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role secret; Production/Preview/Development server scope only, never `VITE_`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — credentials for one shared Upstash Redis database used by all Vercel Function instances/environments that should share limits.
- `SUPPORT_PUBLIC_ORIGIN` — exact browser origin allowed to submit guest requests. Set `https://alimanrouh.com` in Production and the exact trusted preview origin in Preview if preview guest tests are needed.

The site continues to use its existing browser-only `VITE_SUPABASE_URL` and anon key; no new public `VITE_` secrets are required. `VERCEL` and `x-vercel-id` are platform-provided request/runtime signals, not manually configured secrets. Never put the service-role key or Upstash token in the public site's `.env`, build variables exposed to the browser, logs, or source control.

`supabase/manual/support_rls_review.sql` contains a rollback-only Admin/customer/guest/unrelated-user test matrix; run it only on a disposable/local database or a reviewed test project, not as part of application startup. Never put a service-role key in either browser app.

### Local Supabase acceptance test

The repository's migration/security tests and Vercel API tests do not execute this migration against PostgreSQL or prove the deployed Vercel ingress metadata. For an end-to-end check, use Docker Desktop, the Supabase CLI, and Vercel CLI in a fresh temporary directory. Do not link this test project to the hosted project or use hosted keys or customer data.

From PowerShell at the repository root:

```powershell
$repo = (Resolve-Path .).Path
$testRoot = Join-Path $env:TEMP ("support-supabase-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory $testRoot | Out-Null
Push-Location $testRoot
supabase init
New-Item -ItemType Directory -Force .\supabase\migrations | Out-Null
Copy-Item "$repo\supabase\migrations\20261020120000_init_admin_schema.sql" .\supabase\migrations\
supabase start
supabase db reset
```

Use the local Studio at `http://127.0.0.1:54323` to create two confirmed test users with invented addresses and passwords. In its SQL Editor, mark one as the local admin and insert a synthetic legacy inquiry for the active customer:

```sql
insert into public.admin_accounts (user_id, note)
select id, 'local support validation'
from auth.users
where email = '<local-admin-email>'
on conflict (user_id) do nothing;

insert into public.hajj_inquiries (customer_id, message, internal_status)
select id, 'Synthetic local import test', 'new'
from auth.users
where email = '<local-customer-email>';
```

These are disposable fixtures, not real customer data. Apply only the support migration to this local database:

```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f "$repo\supabase\migrations\20261025143000_support_conversations.sql"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f "$repo\supabase\manual\support_rls_review.sql"
```

Get the local API URL, **anon** key, and **local-only service-role key** from `supabase status`. Keep the service-role key out of the public site and test script. Set local server environment variables for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `SUPPORT_PUBLIC_ORIGIN=http://localhost:3000`. Use a fresh, disposable Upstash Redis database for integration testing; do not reuse production Upstash credentials because the rate-limit test expects a clean window.

In a separate PowerShell, from the public website repository root, start the Vercel project locally using the Vercel CLI so requests receive Vercel development metadata:

```powershell
vercel dev
```

Keep server credentials out of client-side Vite variables. The RLS review confirms anon cannot execute guest RPCs and exercises token isolation and database contact/token limits as `service_role`. To check both apps, start the Admin Dashboard and public Vercel app against the same local Supabase project, then verify Admin/customer visibility and replies, guest access/token isolation, and the Admin inbox on mobile. Finish with `supabase stop`.

### Hosted migration gate

Do not run the initial schema migration again, and do not use `supabase db push` for this change: the hosted project already has the base schema, while this migration has not been applied or registered here. First complete the local end-to-end test, review the exact migration file, take and verify a restorable production backup, and run read-only checks in the hosted SQL Editor. This repository describes the expected base schema but cannot establish the current hosted catalog; these checks are a required deployment gate.

Run [`supabase/manual/support_preflight_readonly.sql`](../supabase/manual/support_preflight_readonly.sql) in the Supabase SQL Editor against the intended project. It contains only `SELECT` statements and reports required relations, columns, foreign keys, roles, functions, pgcrypto placement, object-name conflicts, existing Hajj inquiry triggers and RLS policies, aggregate baseline counts, status distribution, and Realtime publication configuration. It uses guarded, aggregate-only dynamic `SELECT`s for counts, so it does not print customer names, contact details, or inquiry text.

All required base relations, columns, foreign keys, roles, the `extensions` schema, `auth.uid()`, `public.is_admin()`, one expected admin account, pgcrypto availability in `extensions`, and the Realtime publication must be confirmed. Confirm the migration runner can create required objects and make the publication change. The schema-privilege preflight must show no effective `CREATE` for `PUBLIC`, `anon`, or `authenticated` on `public` or `extensions`; any such grant is a blocker. Every support relation/function/trigger/policy conflict result should be empty. Review all existing Hajj inquiry triggers and resolve any flagged potential support-status synchronization before applying the migration. Record the inquiry count and status distribution. The legacy import creates one conversation and one initial message per inquiry; only inquiries still marked `new` begin unread, while `contacted`, `in_progress`, and `closed` inquiries are imported as already read using their `updated_at` as the best available read timestamp. Confirm this is consistent with the production team's use of legacy statuses.

#### Backup and release checklist

1. Schedule a maintenance window and pause support/Hajj writes for the migration and validation window where practical.
2. In Supabase Dashboard → Database → Backups, confirm the latest backup covers the current database and that point-in-time recovery is available for the project/plan. Take an on-demand backup immediately before the change where supported. Record the backup timestamp and recovery procedure.
3. Verify recoverability by restoring a backup to an isolated temporary project; a listed backup without a tested restore is not a deployment-ready backup. Keep the restore private and delete the temporary project only after validation.
4. Save the preflight output, original inquiry row count/status distribution, and admin count in the change record. Do not export customer content into an unprotected workstation or shared folder.
5. Complete the disposable full-stack Supabase and Vercel API tests (Auth, RLS, anon RPC denial, registered-customer Realtime, guest-token isolation/polling, Upstash concurrent rate limits, imported legacy inquiry, and both dashboard/mobile flows). Recheck the exact final migration and both frontend builds. The migration adds only support rows/tables, message/read bookkeeping triggers, and the one-way legacy-inquiry insert bridge; it does not sync statuses back to Hajj rows.
6. Obtain explicit approval. In Supabase SQL Editor, select the intended production project, verify its project reference, and apply only `supabase/migrations/20261025143000_support_conversations.sql` once. Do not execute the test matrix, base schema migration, or `supabase db push` on production.
7. Confirm the SQL Editor reports commit success. Run read-only postflight checks for support row counts versus legacy inquiries, duplicate `linked_hajj_inquiry_id` values, initial messages, unread counts, RLS enabled on all four tables, effective grants, and both tables in `supabase_realtime`. Sign in to the admin dashboard and verify an existing inquiry and a synthetic approved test event before resuming writes.
8. If the migration fails before commit, confirm its transaction rolled back and inspect the error before retrying. After commit or after accepting new conversations, do not drop support tables as a rollback: that would destroy replies/guest conversations. Recover by a reviewed forward fix or the tested point-in-time recovery procedure, with explicit approval.

A manual SQL Editor run does not record the version in the Supabase CLI migration ledger; before any later CLI push, reconcile that ledger under a separately reviewed, approved release step. Once approved, apply the support migration exactly once, configure all server-only Vercel/Upstash variables, verify trusted Vercel ingress and shared rate limiting in Preview, then release the public site and Admin Dashboard as separately reviewed changes. Guest RPC access remains unavailable to browser clients even before the API is configured. None of those production actions has been performed as part of this local implementation.

The Vercel API obtains IP only through the official `@vercel/functions` helper and requires platform markers; Vercel documents that it overwrites client `X-Forwarded-For` values. Because Hostinger is DNS-only, confirm the hostname routes directly to Vercel and no HTTP proxy masks ingress identity. Verify rate limits against the shared Upstash instance in a Vercel Preview before enabling production guest flows. PostgreSQL intentionally cannot validate client IPs. Do not restore direct `anon` grants to guest RPCs or add manual fallbacks to arbitrary forwarding headers.

## Customer isolation

Do not filter security only in the UI. RLS restricts each customer to `customer_id = auth.uid()` for bookings, visas, documents, payments, profile, and support conversations/messages. Support creation derives the customer id from the authenticated session in the RPC; callers cannot submit a different customer id.

Suspended and unverified accounts cannot create bookings, visas, or support conversations. The relevant database function rejects inactive accounts.

## Verification after the public site is integrated

1. Register a new customer on alimanrouh.com and confirm the email.
2. Confirm the same person appears in the admin customer list with zero bookings.
3. Submit an Umrah booking and confirm the admin booking total matches the published price.
4. Confirm the new row is the only booking. Do not look for, or load, a Railway history.
5. Submit a visa request, upload a document, and open it from the admin visa screen.
6. Sign in as that customer and confirm another customer's booking id returns no row.
7. Sign in as the customer on `admin.alimanrouh.com` and confirm the admin shell is refused.
