// Strava smart matching logic
// Determines the best match between a Strava activity and programmed/client workouts

export interface MatchCandidate {
  id: string;
  type: 'programmed' | 'client';
  day: string;
  workoutType: string;
  trainingType: string | null;
  miles: number | null;
  title: string | null;
  completed: boolean;
}

export interface MatchResult {
  candidateId: string | null;
  candidateType: 'programmed' | 'client' | null;
  confidence: number; // 0-100
  reasons: string[];
}

export function findBestMatch(
  stravaType: string,
  stravaMiles: number,
  stravaDuration: string | null,
  stravaDay: string,
  stravaTrainingType: string | null,
  candidates: MatchCandidate[]
): MatchResult {
  // Never auto-match activities with essentially 0 distance (likely accidental start/stop)
  if (stravaMiles < 0.1) {
    return { candidateId: null, candidateType: null, confidence: 0, reasons: ['Activity has no distance — likely accidental'] };
  }

  // Filter to same day only
  const sameDayCandidates = candidates.filter(c => c.day === stravaDay && !c.completed);

  if (sameDayCandidates.length === 0) {
    return { candidateId: null, candidateType: null, confidence: 0, reasons: ['No unmatched workouts on this day'] };
  }

  let bestMatch: MatchCandidate | null = null;
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (const candidate of sameDayCandidates) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Type match (most important) — 40 points
    if (isSameWorkoutType(stravaType, candidate.workoutType)) {
      score += 40;
      reasons.push('Same workout type');
    } else {
      // If types don't match at all, this is unlikely a match
      continue;
    }

    // 2. Distance match — up to 30 points
    if (candidate.miles && stravaMiles > 0) {
      const distanceRatio = Math.min(stravaMiles, candidate.miles) / Math.max(stravaMiles, candidate.miles);
      if (distanceRatio >= 0.8) {
        // Within 20% — strong match
        score += 30;
        reasons.push(`Distance close (${stravaMiles.toFixed(1)} vs ${candidate.miles.toFixed(1)} mi)`);
      } else if (distanceRatio >= 0.6) {
        // Within 40% — moderate match
        score += 15;
        reasons.push(`Distance somewhat close (${stravaMiles.toFixed(1)} vs ${candidate.miles.toFixed(1)} mi)`);
      } else {
        // Far off — weak signal
        score += 5;
        reasons.push(`Distance differs (${stravaMiles.toFixed(1)} vs ${candidate.miles.toFixed(1)} mi)`);
      }
    } else if (!candidate.miles && stravaMiles > 0) {
      // No programmed miles (e.g. cross training) — partial match by type alone
      score += 10;
      reasons.push('No distance programmed to compare');
    }

    // 3. Training type match — up to 20 points
    if (stravaTrainingType && candidate.trainingType) {
      if (stravaTrainingType === candidate.trainingType) {
        score += 20;
        reasons.push('Training subtype matches');
      } else if (isRelatedTrainingType(stravaTrainingType, candidate.trainingType)) {
        score += 10;
        reasons.push('Training subtype related');
      }
    } else if (!candidate.trainingType) {
      // No specific training type required — give partial credit
      score += 5;
    }

    // 4. Only unmatched workout on this day of same type — bonus 10 points
    const sameTypeSameDay = sameDayCandidates.filter(c => isSameWorkoutType(stravaType, c.workoutType));
    if (sameTypeSameDay.length === 1) {
      score += 10;
      reasons.push('Only workout of this type today');
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
      bestReasons = reasons;
    }
  }

  if (!bestMatch || bestScore < 40) {
    return { candidateId: null, candidateType: null, confidence: 0, reasons: ['No confident match found'] };
  }

  // Convert score to confidence percentage (max possible = 100)
  const confidence = Math.min(100, bestScore);

  return {
    candidateId: bestMatch.id,
    candidateType: bestMatch.type,
    confidence,
    reasons: bestReasons,
  };
}

// Check if Strava type matches our workout type
function isSameWorkoutType(stravaType: string, candidateType: string): boolean {
  // Direct match
  if (stravaType === candidateType) return true;

  // Strava "run" matches programmed "run"
  if (stravaType === 'run' && candidateType === 'run') return true;
  if (stravaType === 'walk' && candidateType === 'walk') return true;
  if (stravaType === 'cycling' && candidateType === 'cycling') return true;

  // Cross training variants
  if (stravaType === 'cross' && (candidateType === 'cross' || candidateType === 'strength')) return true;
  if (stravaType === 'strength' && (candidateType === 'cross' || candidateType === 'strength')) return true;
  if (stravaType === 'stretching' && candidateType === 'stretching') return true;

  return false;
}

// Check if training types are related (not exact match but close)
function isRelatedTrainingType(a: string, b: string): boolean {
  const easyTypes = ['Easy', 'Recovery', 'LongRun'];
  const speedTypes = ['Tempo', 'Threshold', 'RacePace', 'ClosePace', 'SpeedRoad', 'SpeedTrack', 'Fartlek', 'TimeTrial'];
  const trailTypes = ['Trail', 'Hills'];

  if (easyTypes.includes(a) && easyTypes.includes(b)) return true;
  if (speedTypes.includes(a) && speedTypes.includes(b)) return true;
  if (trailTypes.includes(a) && trailTypes.includes(b)) return true;

  return false;
}
