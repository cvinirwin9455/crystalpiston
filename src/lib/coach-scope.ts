import { hasCoachAccess } from './roles'

type AdminClient = {
  from: (table: string) => any
}

export type CoachScopeProfile = {
  id: string
  role: string | null
  has_coach_access: boolean | null
  is_super_admin: boolean | null
  organization_id: string | null
  access_level: string | null
  coach_level: string | null
}

export type CoachRequestScope = {
  actorProfile: CoachScopeProfile
  effectiveProfile: CoachScopeProfile
  organizationId: string | null
  coachId: string
  isImpersonating: boolean
}

type CoachScopeResult =
  | { scope: CoachRequestScope; error?: never; status?: never }
  | { scope?: never; error: string; status: number }

/**
 * Resolve the organization and coach whose data an authenticated coach request
 * should use. Organization/coach overrides are accepted only for super admins,
 * and the target coach must belong to the requested organization.
 */
export async function resolveCoachRequestScope(
  adminClient: AdminClient,
  actorUserId: string,
  organizationOverride?: string | null,
  coachOverride?: string | null
): Promise<CoachScopeResult> {
  const { data: actor, error: actorError } = await adminClient
    .from('users')
    .select('id, role, has_coach_access, is_super_admin, organization_id, access_level, coach_level')
    .eq('id', actorUserId)
    .single()

  if (actorError || !actor || (!hasCoachAccess(actor) && !actor.is_super_admin)) {
    return { error: 'Forbidden', status: 403 }
  }

  const actorProfile = actor as CoachScopeProfile
  if (!organizationOverride) {
    return {
      scope: {
        actorProfile,
        effectiveProfile: actorProfile,
        organizationId: actorProfile.organization_id,
        coachId: actorProfile.id,
        isImpersonating: false,
      },
    }
  }

  if (!actorProfile.is_super_admin) {
    return { error: 'Super admin access required for organization override', status: 403 }
  }

  let targetQuery = adminClient
    .from('users')
    .select('id, role, has_coach_access, is_super_admin, organization_id, access_level, coach_level')
    .eq('organization_id', organizationOverride)

  if (coachOverride) {
    targetQuery = targetQuery.eq('id', coachOverride)
  } else {
    targetQuery = targetQuery
      .eq('role', 'admin')
      .eq('coach_level', 'account_coach')
  }

  const { data: targetRows, error: targetError } = await targetQuery.limit(1)
  let target = targetRows?.[0] || null

  // Older organizations may not have coach_level populated. Fall back to any
  // coach-capable member, while still requiring membership in the target org.
  if (!target && !coachOverride && !targetError) {
    const { data: orgUsers } = await adminClient
      .from('users')
      .select('id, role, has_coach_access, is_super_admin, organization_id, access_level, coach_level')
      .eq('organization_id', organizationOverride)

    target = (orgUsers || []).find((profile: CoachScopeProfile) => hasCoachAccess(profile)) || null
  }

  if (targetError || !target || !hasCoachAccess(target)) {
    return { error: 'Target coach was not found in that organization', status: 404 }
  }

  const effectiveProfile = target as CoachScopeProfile
  return {
    scope: {
      actorProfile,
      effectiveProfile,
      organizationId: organizationOverride,
      coachId: effectiveProfile.id,
      isImpersonating: true,
    },
  }
}
