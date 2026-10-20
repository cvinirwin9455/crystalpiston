# Changelog / "What's New" — Standing Rule

Whenever changes ship to **production** (merged to `main`, which auto-deploys), the in-app
"What's New" changelog MUST be updated as part of that same work — without waiting to be asked.

## What to update
- File: `src/app/admin/Changelog.tsx`
- Add a **new dated entry at the top** of the `updates` array for the release (use the current date,
  format `"Month D, YYYY"` e.g. `"October 19, 2026"`).
- Bump `CHANGELOG_LAST_UPDATED` (top of the file) to the current date/time so the "new updates"
  badge shows for users.

## Cover BOTH audiences
Every production release entry should account for both sides of the app:
- **Coaching (Admin):** use `area: "Admin"` for coach-facing changes.
- **Client:** use `area: "Client"` for anything that affects the client dashboard/experience.
- Use `area: "Marketing"` for public pages (home, /join application links, FAQ).
- Use `area: "All"` when it applies to everyone.

If a change touches both coach and client surfaces, write a separate item for each so neither
audience misses it. If a release genuinely has no client-facing impact, that's fine — but
consciously check rather than defaulting to Admin-only.

## Tone & wording
- Plain, non-technical language — describe the benefit, not the implementation.
- Prefix items: `NEW:` for features, `Improved:` for enhancements, `Fixed:` for bug fixes.
- Only announce features that are actually **usable in production**. If something is built but
  dormant/disabled (e.g. online card payments while Stripe is off in prod), either omit it or
  label it clearly as "coming soon" — never imply a disabled feature is live.
- Keep existing entries accurate: if a release changes where a feature lives or how it works,
  fix any now-stale wording in older entries.

## After updating
- Type-check the file (`npx tsc --noEmit`) to confirm no syntax errors.
- The changelog change rides along with the production release (same branch/PR to `main`).
- Since `main` auto-deploys to production, confirm with the user before pushing when the push
  itself is the production-facing step.
