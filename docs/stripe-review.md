# Stripe Payments — Code Review (feature/stripe-payments)

Review date: Oct 17, 2026. Reviewed the full payment lifecycle before production.

## Overall
Solid foundation: webhook signature IS verified (raw body + `constructEventAsync`),
direct charges on the coach's connected account (no platform fee, coach = merchant of
record), a top-level idempotency guard in `fulfillPaymentRequest`, and a **partial unique
index** on `payments(payment_request_id) WHERE payment_request_id IS NOT NULL`
(`uq_payments_payment_request`) — so duplicate payment rows are physically impossible.

The gaps are at the edges: cases where **money succeeds but the account/plan outcome
isn't guaranteed.**

## Issues (ranked — fix top 3 before production)

### 1. Webhook swallows errors and returns 200  [HIGH]
File: `src/app/api/webhooks/stripe/route.ts` (outer try/catch, ~lines 192–199).
Any handler error is logged and returns HTTP 200, so Stripe never retries. If fulfillment
hits a transient DB error and the payer closes the tab (so the confirm path never runs),
money is taken with NO account created.
Fix: return 5xx on transient failures so Stripe retries (it backs off over ~3 days, not a
storm). Return 200 only on true success or genuine "already done".

### 2. No unique constraint on plans.stripe_subscription_id + confirm-vs-webhook race  [HIGH]
Files: `src/lib/fulfill-payment.ts` (guard ~lines 37–43; renewal ~96–118),
`src/app/api/pay/[token]/confirm/route.ts`.
Confirmed: `idx_plans_stripe_subscription_id` is NOT unique. The guard is a read-then-write
with no lock; the confirm route and webhook can both pass it concurrently. The renewal path
always completes the active plan and creates a NEW one → a race can create TWO plans from one
payment. (Payment de-dupe still protects the money side.)
Fix (both):
  - Add partial unique index:
    `CREATE UNIQUE INDEX uq_plans_stripe_subscription ON plans(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;`
  - Atomic claim before fulfilling:
    `UPDATE payment_requests SET status='fulfilling' WHERE id=? AND status='pending'` and only
    proceed if a row was affected (loser no-ops).

### 3. Provisioning failure is marked paid but surfaced only as an ignored warning  [HIGH]
File: `src/lib/fulfill-payment.ts` (~lines 75–88 and outer catch ~246–262).
On provisioning/plan failure the request is force-marked `paid` and returns `{ ok:false, warning }`,
but `CheckoutClient.tsx` optimistically shows "paid" and ignores the warning. A failed account
creation looks successful to everyone.
Fix: add a `needs_attention` flag on the request + an admin "paid but provisioning failed" list
so a human can recover it.

### 4. Double payment on one request isn't prevented  [MED]
File: `src/app/api/pay/[token]/route.ts` (POST ~98–230).
Each POST creates a fresh Checkout Session and overwrites `stripe_checkout_session_id`; status is
checked only at session-create time. Two tabs → two successful PaymentIntents. The 2nd
`checkout.session.completed` hits the "already paid" guard, so the coach's Stripe is charged twice
with no app record and no refund.
Fix: reuse an existing open session instead of creating a new one; detect/flag a 2nd successful
PaymentIntent for refund.

### 5. Subscription de-dupe uses fragile string matching  [MED]
File: `src/lib/subscriptions.ts`.
`recordRecurringInvoice` de-dupes recurring invoices via `ilike(notes,'%<invoiceId>%')` (no de-dupe
if invoiceId is null); `enforceRecurMonths` counts rows via `notes ilike '%subscription payment%'`.
Fix: store `stripe_invoice_id` in a real column with a unique index; count/dedupe on that.

### 6. OAuth state has no TTL; callback trusts the state holder  [LOW]
Files: `src/app/api/stripe-connect/route.ts`, `.../callback/route.ts`.
`stripe_oauth_state` persists until consumed; callback matches on the state value without
cross-checking the `coachId` embedded in it. Low risk (random nonce) but worth a short TTL +
verifying the embedded coachId matches the row.

## Suggested next steps (tomorrow)
- Sanity-check staging for already-stuck requests:
  `SELECT id, status, provisioned_user_id, plan_id, paid_at FROM payment_requests WHERE status='paid' AND provisioned_user_id IS NULL AND plan_id IS NULL;`
- Then implement #1, #2, #3 on a new branch and open a PR.
