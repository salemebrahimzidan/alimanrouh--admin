# لوحة إدارة وكالة الإيمان روح للحج والعمرة

Arabic RTL admin dashboard for [alimanrouh.com](https://alimanrouh.com). The website is maintained in a separate repository; its customer inquiry forms now use the same local support-conversation implementation.

Production admin host: `https://admin.alimanrouh.com`  
Supabase project: `https://ptjtiexrgwjomvaefouo.supabase.co`

## What is included

- Admin login for one manually created account. There is no public admin registration and no staff or role screen.
- Customer list fed by a database trigger on Supabase Auth. A customer appears after registration even when they have no booking.
- Umrah bookings, Umrah packages, Hajj programs, a real-time customer support inbox, visa applications, manual payments, and website banners/offers/announcements.
- A customer portal used for local integration testing. It is enabled in `npm run dev` and hidden in the production build unless `VITE_ENABLE_CUSTOMER_PORTAL=true`.
- SQL migrations, row level security, a reviewed profile backfill, and the admin bootstrap script. Nothing in this repository executes that SQL.

## Setup

1. Install dependencies and copy the environment file:

```bash
npm install
copy .env.example .env.local
```

2. In Supabase → Project Settings → API, copy the **anon public** key into `VITE_SUPABASE_ANON_KEY`.
   Do not put the service-role key in this project. Vite exposes every `VITE_` variable in the browser.

3. On this hosted project the schema migration and administrator bootstrap are already applied. Do not run `supabase/migrations/20261020120000_init_admin_schema.sql` again. It is not idempotent and will stop on the existing tables. It does not delete data, but a second run is not a repair.

4. `supabase/manual/backfill_profiles.sql` only inserts missing profiles. Do not run it unless an Auth user has no profile. Do not delete Auth users, the administrator row, or application tables.

5. The administrator already exists. A replacement account is created in Supabase → Authentication → Users → Add user, with auto-confirm, using an email that will never be a customer. Do not put a role in user metadata.

6. The filled administrator bootstrap script stays on the operator machine at `supabase/manual/bootstrap_admin.sql` and is listed in `.gitignore`, so the administrator email is not published. Re-run that local file only when that email must be added and no second administrator exists. Confirm exactly one row:

```sql
select a.user_id, u.email
from public.admin_accounts a
join auth.users u on u.id = a.user_id;
```

7. In Authentication → URL configuration, allow:

- Site URL for the public website: `https://alimanrouh.com`
- Redirect URLs: `https://alimanrouh.com/**`, `https://admin.alimanrouh.com/**`, and `http://localhost:5173/**` while developing

8. Start the dashboard:

```bash
npm run dev
```

Sign in at `http://localhost:5173/login`. A customer account is rejected with an authorization message. Customer registration during development is at `http://localhost:5173/portal/register`.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Publish the admin dashboard

Production publishing requires separate approval. This app does not run SQL, commit, push, or deploy by itself.

1. Keep `.env.local` untracked. `.env.example` names `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. Put the anon key in `.env.local` and in Vercel, never in Git. Do not add the service-role key.
2. Push `main` to `https://github.com/salemebrahimzidan/alimanrouh--admin.git`.
3. In Vercel, import that repository. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
4. Set these production environment variables, then redeploy so Vite can inline them:
   - `VITE_SUPABASE_URL` = `https://ptjtiexrgwjomvaefouo.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
   - Leave `VITE_ENABLE_CUSTOMER_PORTAL` unset
5. Add the domain `admin.alimanrouh.com`. At the DNS host, point `admin` at the target Vercel shows.
6. In Supabase → Authentication → URL configuration, keep the public site as the Site URL if that is already `https://alimanrouh.com`. Add these redirect URLs: `https://admin.alimanrouh.com/**`, `https://alimanrouh.com/**`, and `http://localhost:5173/**`. Password reset uses the current origin plus `/reset-password`. Supabase ignores `redirectTo` when that origin is not allowed.
7. `vercel.json` rewrites unmatched routes to `index.html`, so a refresh of `/payments` or `/reset-password` stays in the app. Vercel still serves real files such as `/assets/*` and `/favicon.svg` before that rewrite. Refresh one nested page after the first deploy.
8. Sign in, confirm the customer list, open Payments and confirm it loads with no database-setup banner, then sign out. A customer account must be refused.

The bookings screen stays. It is empty until a future customer reservation is created in this Supabase project. There are no legacy booking rows to import.

The public-site sequence is in `docs/public-website-integration.md`.

## Authorization model

- `public.admin_accounts` is an allow-list. The API roles cannot insert, update, or delete it.
- `public.is_admin()` reads that table as a security-definer function. Signup metadata is ignored.
- `handle_new_user()` creates `public.profiles` from Auth. Clients cannot insert profiles directly.
- The `customers` view excludes administrator accounts and is `security_invoker`, so row level security still applies.
- Customers can read and create only their own bookings, visa applications, support conversations, and documents.
- Package price and booking total for a customer insert are taken from the published package inside the database.
- Internal notes, audit logs, and customer documents are not public. Documents use a private storage bucket and short-lived signed URLs.
- Visa and Hajj statuses are internal agency states. They are not official government decisions.

## Manual security review

`supabase/manual/rls_review.sql` is a read-only review script wrapped in a transaction that rolls back. Run it only after the migration, in the SQL editor. It is not part of application startup.

The automated tests in this repository check TypeScript, the status contract, and that the frontend does not contain a service-role key. They do not connect to Supabase.
