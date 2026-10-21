# Deployment and integration plan

Publish `admin.alimanrouh.com` first. Do not change `alimanrouh.com` until that dashboard is live and this plan is still accurate.

This is a fresh booking start. There are no legacy booking records to migrate, preserve, or display. The bookings section in the admin app stays in place for reservations customers create later.

## Architecture

| Surface | Host | Backend |
| --- | --- | --- |
| Public website | `https://alimanrouh.com` | Separate repository. Today it still calls Railway for packages and guest bookings. |
| Admin dashboard | `https://admin.alimanrouh.com` | This repository, deployed on Vercel. |
| Shared data | `https://ptjtiexrgwjomvaefouo.supabase.co` | One Supabase project for Auth, tables, storage, and RPCs. |

The anon key may be used by both frontends. The service-role key stays out of both. Do not delete existing Auth users, the administrator account, or database tables.

The schema migration and administrator bootstrap are already applied on the hosted project. Do not run `supabase/migrations/20261020120000_init_admin_schema.sql` again. A second run fails because the script is not idempotent. `supabase/manual/rls_review.sql` rolls back its own transaction; it is a manual review script and is not part of startup. Do not run it against hosted Supabase unless you intend to execute that reviewed session yourself.

## What the public site still depends on

Inspected in the public website repository. Leave these in place until each one is replaced on purpose.

Railway base URL: `https://alimanrouh-api-production.up.railway.app` (`VITE_API_URL` overrides it).

| Caller | Railway use | Action |
| --- | --- | --- |
| `src/services/packages.ts` | `GET /packages` for the home, Umrah, Hajj, and booking pages | Keep. These pages still need the current catalog and ids. |
| `src/features/rouh-aleman/shared/utils/packages.ts` | Prefixes relative package images with the Railway host | Keep with the package catalog. |
| `src/services/bookings.ts` | `POST /bookings` from the guest form | Replace later with Supabase, not before the catalog moves. |
| `src/features/rouh-aleman/pages/contact/submit-contact-form.ts` | Not Railway. Contact uses Web3Forms. | Leave unchanged. |

Do not remove the Railway client while package listing or package images still use it.

## Phase 1 — publish the admin dashboard

Exact steps are in the README section “Publish the admin dashboard”.

After deploy, the nine sections read this Supabase project: home, customers, bookings, Umrah packages, Hajj, visas, payments, website content, and settings. Bookings, visas, Hajj inquiries, payments, and website content can be empty. That empty state is correct.

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

## Hajj inquiries

Insert into `hajj_inquiries` with `internal_status: 'new'`. `program_id` may be null for a general inquiry. This is a contact request, not a confirmed Hajj application. It does not replace the Web3Forms contact page.

## Customer isolation

Do not filter security only in the UI. The policies already restrict each customer to `customer_id = auth.uid()` for bookings, visas, inquiries, documents, payments, and their profile. The public site should still pass the signed-in user id so accidental broad queries return only that user's rows.

Suspended and unverified accounts cannot create bookings, visas, or inquiries. The trigger returns `account cannot ...`.

## Verification after the public site is integrated

1. Register a new customer on alimanrouh.com and confirm the email.
2. Confirm the same person appears in the admin customer list with zero bookings.
3. Submit an Umrah booking and confirm the admin booking total matches the published price.
4. Confirm the new row is the only booking. Do not look for, or load, a Railway history.
5. Submit a visa request, upload a document, and open it from the admin visa screen.
6. Sign in as that customer and confirm another customer's booking id returns no row.
7. Sign in as the customer on `admin.alimanrouh.com` and confirm the admin shell is refused.
