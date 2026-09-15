/**
 * Central role/capability helpers for dual-role accounts.
 *
 * A single auth identity can hold BOTH a coach hat and a client hat. Rather
 * than model `role` as an array (which the whole codebase reads as a scalar),
 * capability is derived additively:
 *
 *   - Coach capability  = role === 'admin' OR has_coach_access === true
 *   - Client capability = a row exists in `clients` for this user_id
 *   - Dual-role         = has BOTH capabilities
 *
 * `role` remains the PRIMARY role, which decides the *default* landing view.
 * All existing `.eq('role', ...)` queries keep working unchanged.
 */

/** Minimal shape of a `users` profile row needed to derive capabilities. */
export type ProfileForCapabilities = {
  role?: string | null
  has_coach_access?: boolean | null
}

/** Cookie name used to remember which view a dual-role user last chose. */
export const PREFERRED_VIEW_COOKIE = 'preferred_view'
export type PreferredView = 'coach' | 'client'

/** Does this user have coach (admin) capability? */
export function hasCoachAccess(profile: ProfileForCapabilities | null | undefined): boolean {
  if (!profile) return false
  return profile.role === 'admin' || profile.has_coach_access === true
}

/**
 * Capabilities for a user, given their profile and whether a client record
 * exists for them. `hasClientRecord` is the presence of a `clients` row.
 */
export type Capabilities = {
  coach: boolean
  client: boolean
  isDualRole: boolean
}

export function getCapabilities(
  profile: ProfileForCapabilities | null | undefined,
  hasClientRecord: boolean
): Capabilities {
  const coach = hasCoachAccess(profile)
  const client = hasClientRecord
  return { coach, client, isDualRole: coach && client }
}

/**
 * Where should this user land after auth, given their capabilities and any
 * remembered preference?
 *   - Dual-role: honor remembered preference; otherwise send to the chooser.
 *   - Coach only: /admin
 *   - Client only (or nothing else): /dashboard
 */
export function resolveLandingPath(
  caps: Capabilities,
  preferred?: PreferredView | null
): string {
  if (caps.isDualRole) {
    if (preferred === 'coach') return '/admin'
    if (preferred === 'client') return '/dashboard'
    return '/choose-view'
  }
  if (caps.coach) return '/admin'
  return '/dashboard'
}
