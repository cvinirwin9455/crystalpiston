# 🚨 STRIPE GO-LIVE CHECKLIST — read before flipping to production

Do NOT open Stripe payments to all coaches until this whole checklist is done.
Live mode = real money. Test cards (4242) and test SSNs (000-00-0000) do NOT work
in live mode — every charge is real and lands in a real coach's bank.

---

## 0. Fix these FIRST (from docs/stripe-review.md) — before real money flows
In test mode a glitch is annoying; in live mode it means a real customer charged
with no account, or a double charge. Prioritize:
- [ ] **#1 Webhook returns 200 on errors** → make it return 5xx on transient
      failures so Stripe retries (otherwise: paid but no account if the pay page
      is closed).
- [ ] **#2 No unique index on plans.stripe_subscription_id + confirm/webhook race**
      → add the partial unique index + an atomic "claim" before fulfilling.
- [ ] **#3 Provisioning failure is silently marked paid** → surface a
      "paid but not provisioned" flag so it can't be missed.

## 1. Live environment config (Vercel → Production env)
- [ ] `STRIPE_SECRET_KEY` = **live** key (`sk_live_...`) — NOT the test key
- [ ] `STRIPE_CONNECT_CLIENT_ID` = **live** Connect client (`ca_live_...`)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = **live** (`pk_live_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` = the signing secret from the **LIVE** webhook
      (test and live webhooks are separate — see next)

## 2. Live webhook (Stripe dashboard, LIVE mode)
- [ ] Register a **live-mode** Connect webhook → `https://<prod-domain>/api/webhooks/stripe`
- [ ] Events: `checkout.session.completed`, `invoice.paid`,
      `invoice.payment_failed`, `customer.subscription.created/updated/deleted`
- [ ] Copy its signing secret into Vercel Production `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy production so the new secret is live

## 3. First real connection (you, or one trusted coach)
- [ ] A real coach connects their REAL Stripe account (real identity/SSN, real bank)
- [ ] Onboarding may go to "pending verification" for hours/days — that's normal;
      the app will show "Finish Connecting / Setup incomplete" until Stripe clears it
- [ ] Confirm the account goes **Active** and First Mile shows "Ready to accept payments"

## 4. Live end-to-end test — $1 charge + refund (REAL card you own)
- [ ] Create a tiny package ($1, or Stripe's min ~$0.50)
- [ ] Send a payment request → pay with a **REAL card you control**
- [ ] Verify: client account created + set-password email; plan + payment recorded
- [ ] Verify the $1 actually lands in the COACH's real Stripe balance (no platform fee)
- [ ] **Refund the $1** from the coach's Stripe dashboard (costs ~a few cents in fees)

## 5. Live subscription test — $1/mo + cancel
- [ ] Create a $1/month package → subscribe with your real card
- [ ] Verify subscription created + first invoice paid into the coach's account
- [ ] **Cancel it immediately** so it doesn't bill again — verify cancel actually stops it

## 6. Things that differ in live mode (don't mistake for bugs)
- Onboarding verification can take time (pending ≠ broken)
- Payouts to the coach's bank are on a schedule (first one can take days);
  money shows in Stripe balance immediately, bank later
- Everything is real — no test cards/SSNs

## 7. Rollout
- [ ] Don't flip live for everyone at once
- [ ] You test the $1 flow first → then one friendly coach (Crystal/Adam) → then open to all

---
Reminder: there's a staging-only avatars bucket gap that does NOT affect prod
(prod already has the bucket). Not a go-live blocker.
