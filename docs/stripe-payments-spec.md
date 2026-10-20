# Stripe Payments — Build Spec

Status: **in progress** · Branch: `feature/stripe-payments`

## The agreed flow
1. Client applies through the coach's public link `/join/<slug>` (no account — exists today).
2. Coach reviews + talks to the client, agrees on a package (exists today — Applications inbox).
3. Coach sends a **payment request** for the agreed package (or a custom one-off amount). *(new)*
4. Client pays on a branded **First Mile checkout page**; money goes **directly to the coach's Stripe account** (Stripe Connect, **no First Mile platform fee**). *(new)*
5. On successful payment, the client's account is **created automatically** (reusing the existing invite/account-creation code) and the set-password email is sent. *(new)*

The simple case ("buy a fixed package") is just this flow with an instant step 2.

## Decisions
- **No platform fee** — full amount passes through to the coach.
- **Lifecycle (Option A):** card fails → Stripe retries (dunning) + we email the client; account stays active during retries. Subscription cancelled or retries exhausted → set `plans.status='cancelled'` and flip `users.status='inactive'` (same as the existing "archive client" soft-delete). Re-subscribe → reactivate. No new "paused" state for now.
- **Staging:** Vercel Preview env has separate Supabase values from Production, so previews hit the staging DB. All test-mode work happens on previews. One deliberate verification before trusting account-creation tests: confirm a preview signup lands in the staging Supabase project, and test account-creation emails only to an address we control.

## Build order
- **A. Coach Packages** ✅ DONE — `coach_packages` table + CRUD API (`/api/coach-packages`) + coach UI (`PackagesManager` in Applications tab) + shown on the public `/join/<slug>` page. Migration `20261013_coach_packages.sql`. *(safe: no money, no accounts)*
- **B. Stripe Connect** — per-coach onboarding; store `stripe_account_id` on `users`; map each package to a Stripe Price on the connected account.
- **C. Payment request + checkout + webhook account creation** — generate a checkout link, branded `/checkout` page, signature-verified webhook that creates the account (reusing `coach-applications` / `clients` logic) and writes a `payments` row. *(first money/account-creating step — staging only)*
- **D. Subscription lifecycle** — handle `invoice.payment_failed` / `customer.subscription.deleted` per Option A.

## Reused existing pieces
- Account creation: `src/app/api/coach-applications/route.ts` (accept branch) and `src/app/api/clients/route.ts` POST — invite via `generateLink` + `sendClientInviteEmail`, then `users` / `clients` / `client_coaches` rows.
- Billing tables: `plans` (monthly), `session_packages`, `payments` (unified history).
- Email: Resend helpers in `src/lib/invite-emails.ts`.
- Coach/org scoping: `resolveCoachRequestScope` (`src/lib/coach-scope.ts`).
- Public funnel: `/join/[slug]/page.tsx`, `ApplicationForm.tsx`, `api/apply/[slug]`, `api/application-page`.

## New Stripe env vars (to be added in Vercel per environment)
- `STRIPE_SECRET_KEY` (test key for Preview, live for Production)
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Adam's packages (seed data for testing)
| Name | Price | Interval | Notes |
|---|---|---|---|
| Run | $125 | monthly | custom run plan, weekly adjustments, messaging |
| Run + Strength | $200 | monthly | adds strength & conditioning + mobility |
| Performance | $300 | monthly | adds recovery/injury prevention, weekly call, race strategy — cap ~5 clients |
| Strength & Conditioning | $150 | monthly | strength/movement/mobility for non-runners |
| Half Marathon Prep | $399 | one-time | 12-week build + strength/mobility |
| Marathon Prep | $499 | one-time | 15-week build + strength/mobility, fueling, taper, race-day plan |
