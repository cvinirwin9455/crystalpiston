const MAX_DATABASE_DISTANCE = 9999.99
const MAX_SWIM_DISTANCE_METERS = 9_999_000
const DISTANCE_NUMBER = /^(?:\d+\.?\d*|\.\d+)$/

export type StoredWorkoutDistance = {
  miles: number | null
  distanceUnit: 'mi' | 'km'
  structure: unknown
  error?: string
}

function parseDistance(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null

  const text = String(value).trim()
  if (!text || !DISTANCE_NUMBER.test(text)) return 'invalid'

  const parsed = Number(text)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 'invalid'
}

/**
 * Normalize the overloaded workout distance field before writing it to the
 * database. Runs/walks use mi or km, swims are entered in meters, and other
 * workout types do not have a top-level distance in the current UI.
 */
export function normalizeWorkoutDistance(workout: any): StoredWorkoutDistance {
  const type = workout.type || 'rest'

  // Prevent stale template values on cycling/cross/rest/etc. from blocking the
  // whole week. Their meaningful measurements live in description/structure.
  if (type !== 'run' && type !== 'walk' && type !== 'swimming') {
    return { miles: null, distanceUnit: 'mi', structure: workout.structure || null }
  }

  const parsed = parseDistance(workout.miles)
  if (parsed === 'invalid') {
    return {
      miles: null,
      distanceUnit: workout.distanceUnit === 'km' ? 'km' : 'mi',
      structure: workout.structure || null,
      error: `has an invalid distance (${String(workout.miles)})`,
    }
  }

  if (parsed === null) {
    if (type === 'swimming') {
      return {
        miles: null,
        distanceUnit: 'km',
        structure: getWorkoutStructureForDisplay({ type, structure: workout.structure }),
      }
    }

    return {
      miles: null,
      distanceUnit: workout.distanceUnit === 'km' ? 'km' : 'mi',
      structure: workout.structure || null,
    }
  }

  if (type === 'swimming') {
    if (parsed > MAX_SWIM_DISTANCE_METERS) {
      return {
        miles: null,
        distanceUnit: 'km',
        structure: workout.structure || null,
        error: `has a swim distance that is too large (${parsed} meters)`,
      }
    }

    const baseStructure = workout.structure && typeof workout.structure === 'object' && !Array.isArray(workout.structure)
      ? workout.structure
      : {}

    // Swim inputs are meters, while the database supports mi/km. Store a safe
    // km value and retain the exact meter value in JSON for display/editing.
    return {
      miles: parsed / 1000,
      distanceUnit: 'km',
      structure: { ...baseStructure, swimDistanceMeters: parsed },
    }
  }

  if (parsed > MAX_DATABASE_DISTANCE) {
    return {
      miles: null,
      distanceUnit: workout.distanceUnit === 'km' ? 'km' : 'mi',
      structure: workout.structure || null,
      error: `has a distance that is too large (${parsed} ${workout.distanceUnit === 'km' ? 'km' : 'mi'})`,
    }
  }

  return {
    miles: parsed,
    distanceUnit: workout.distanceUnit === 'km' ? 'km' : 'mi',
    structure: workout.structure || null,
  }
}

export function isMileageWorkoutType(type: unknown): boolean {
  return type === 'run' || type === 'walk'
}

export function getWorkoutDistanceUnitForDisplay(workout: any): 'mi' | 'km' | undefined {
  return workout.type === 'swimming' ? undefined : (workout.distance_unit === 'km' ? 'km' : 'mi')
}

export function getWorkoutStructureForDisplay(workout: any): unknown {
  const structure = workout.structure
  if (workout.type !== 'swimming' || !structure || typeof structure !== 'object' || Array.isArray(structure)) {
    return structure || null
  }

  const { swimDistanceMeters: _storedSwimDistance, ...displayStructure } = structure
  return Object.keys(displayStructure).length > 0 ? displayStructure : null
}

export function getWorkoutDistanceInMiles(workout: any): number | null {
  const displayDistance = getWorkoutDistanceForDisplay(workout)
  if (displayDistance === null || displayDistance <= 0) return null
  if (workout.type === 'swimming') return displayDistance / 1609.344
  return workout.distance_unit === 'km' || workout.distanceUnit === 'km'
    ? displayDistance / 1.60934
    : displayDistance
}

/** Return the UI-facing distance. New swims retain exact entered meters in JSON. */
export function getWorkoutDistanceForDisplay(workout: any): number | null {
  if (workout.type === 'swimming') {
    const meters = Number(workout.structure?.swimDistanceMeters)
    if (Number.isFinite(meters) && meters >= 0) return meters
  }

  if (workout.miles === null || workout.miles === undefined || workout.miles === '') return null
  const parsed = Number(workout.miles)
  return Number.isFinite(parsed) ? parsed : null
}
