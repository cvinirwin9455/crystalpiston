/**
 * Helper to get the organization_id for the authenticated user.
 * Used by API routes to scope queries to the correct org.
 */

type AdminClient = {
  from: (table: string) => any
}

/**
 * Get the organization_id for a user by their user ID.
 * Returns the org ID or null if not found.
 */
export async function getOrgIdForUser(adminClient: AdminClient, userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()

  return data?.organization_id || null
}
