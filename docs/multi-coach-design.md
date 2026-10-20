# Multi-Coach Org — Design Note (decide before production)

Status: **OPEN QUESTION** — not decided yet. Current behavior is fine for testing
and for a single-coach-per-org reality; revisit before orgs have multiple coaches
with live payments/subscriptions.

## How it works today (feature/stripe-payments)
Scoped per **coach** (`coach_id`):
- Packages (`coach_packages`) — each coach sees/manages only their own.
- Applications (`coach_applications`) + the public `/join/<slug>` link — per coach.
- Payment requests — per coach.
- Stripe — each coach connects their OWN account; money goes directly to them,
  no platform fee. Subscriptions live on the coach's connected account.

Scoped per **organization**:
- Program templates (shared across all coaches in the org).
- Org feature toggles.

Net: within one org, each coach is effectively an independent business sharing a
platform. Coaches do NOT see each other's packages/applicants. Verified in code
(`.eq('coach_id', coachId)` on the GET routes) and in staging data.

## The real question
What IS an "organization" in the product?

### Scenario A — loose umbrella; each coach runs their own business
(What the code does now.) Own packages, own clients, own Stripe payout, own /join.
Coherent and mostly complete. Gaps:
- **Account-coach oversight:** should the account_coach see/manage sub-coaches'
  packages/applications/payments? Today they can't (except via the super-admin
  "view as" path). Most studio-owner setups want this.
- **Coach offboarding:** if a coach leaves, who inherits their clients — and what
  happens to their live Stripe subscriptions (which sit on that coach's account)?

### Scenario B — one business, multiple staff coaches
Clients pay THE BUSINESS; coaches are staff who deliver training. Would want:
- Packages + /join link at the ORG level (one offering set, one application page).
- Clients assignable to any coach.
- ONE Stripe account (the org's), not per-coach.
This fights the current per-coach-everything model and would be a scoping rework
(`coach_id` → `organization_id`) plus a different Stripe approach.

## Recommendation (when revisited)
Pick the scenario first — the Stripe-per-coach, no-platform-fee design points
toward Scenario A (independent coaches). If A, fill these gaps in order:
1. Account-coach oversight (see/manage sub-coaches within the org) in normal UI.
2. Coach offboarding / client + subscription handoff.
3. Per-org toggle: packages & /join shared across the org vs. per-coach.

## Highest-risk item (flag)
A monthly **subscription is tied to the individual coach's Stripe account**. If that
coach leaves / is removed / disconnects Stripe, the client's recurring billing is
stranded — subscriptions can't simply move between Stripe accounts. Needs an
explicit plan (reassign client + migrate-or-cancel the subscription) before any
multi-coach org has live subscriptions. Overlaps the subscription-lifecycle gaps
in docs/stripe-review.md.
