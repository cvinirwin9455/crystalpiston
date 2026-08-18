/**
 * Seed Exercise Library — Utility
 * 
 * Inserts the curated default exercise library into a coach's organization.
 * Used when activating a new coach (beta signup) and can also be run
 * retroactively for existing coaches.
 * 
 * Exercises are inserted into the `templates` table with:
 *   type = 'day'
 *   category = '__exercise_library__'
 *   organization_id = the coach's org
 */

import { SEED_EXERCISES } from './seed-exercises'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Seeds the default exercise library for a given organization.
 * 
 * @param adminClient - Supabase service-role client
 * @param orgId - The organization UUID to seed exercises into
 * @param skipIfExists - If true, won't seed if the org already has exercise library entries (default: true)
 * @returns { success: boolean, inserted: number, skipped: boolean, error?: string }
 */
export async function seedExerciseLibrary(
  adminClient: SupabaseClient,
  orgId: string,
  skipIfExists = true
): Promise<{ success: boolean; inserted: number; skipped: boolean; error?: string }> {
  try {
    // Check if this org already has exercises (avoid duplicating on re-runs)
    if (skipIfExists) {
      const { count, error: countError } = await adminClient
        .from('templates')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'day')
        .eq('category', '__exercise_library__')
        .eq('organization_id', orgId)

      if (countError) {
        return { success: false, inserted: 0, skipped: false, error: `Count check failed: ${countError.message}` }
      }

      if (count && count > 0) {
        return { success: true, inserted: 0, skipped: true }
      }
    }

    // Build the rows to insert
    const rows = SEED_EXERCISES.map((exercise) => ({
      name: exercise.name,
      type: 'day' as const,
      category: '__exercise_library__',
      organization_id: orgId,
      data: {
        name: exercise.name,
        demoVideo: exercise.demoVideo,
        defaultMeasureType: exercise.defaultMeasureType,
        defaultMeasureValue: exercise.defaultMeasureValue,
        defaultSets: exercise.defaultSets,
        defaultRest: exercise.defaultRest,
        defaultWeight: exercise.defaultWeight,
        defaultWeightUnit: exercise.defaultWeightUnit,
        defaultNotes: exercise.defaultNotes,
        categories: exercise.categories,
        is_seed: true,
        is_seed_modified: false,
      },
    }))

    // Insert in batches of 25 to avoid potential payload limits
    const BATCH_SIZE = 25
    let totalInserted = 0

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error } = await adminClient
        .from('templates')
        .insert(batch)

      if (error) {
        return {
          success: false,
          inserted: totalInserted,
          skipped: false,
          error: `Batch insert failed at offset ${i}: ${error.message}`,
        }
      }

      totalInserted += batch.length
    }

    return { success: true, inserted: totalInserted, skipped: false }
  } catch (err: any) {
    return {
      success: false,
      inserted: 0,
      skipped: false,
      error: `Unexpected error: ${err?.message || 'unknown'}`,
    }
  }
}
