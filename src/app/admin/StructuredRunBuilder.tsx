"use client";

import { useState, useEffect } from "react";

// Types for structured workout data
export type DistanceUnit = "miles" | "km" | "meters";
export type TimeUnit = "minutes" | "hours" | "seconds";
export type MeasureType = "distance" | "time";

export type WarmUpCoolDown = {
  type: MeasureType;
  value: string;
  unit: DistanceUnit | TimeUnit;
};

export type Intensity =
  | "Easy" | "Moderate" | "Marathon Pace" | "Threshold" | "Tempo"
  | "10K Pace" | "5K Pace" | "VO2 Max" | "Sprint" | "RPE" | "Heart Rate Zone" | "Custom";

export type RecoveryType = "Walk" | "Jog" | "Standing" | "Easy Run" | "Custom";


export type Recovery = {
  type: MeasureType;
  value: string;
  unit: DistanceUnit | TimeUnit;
  recoveryType: RecoveryType;
};

export type WorkBlock = {
  blockType: "intervals" | "tempo" | "progression" | "strides" | "hillRepeats" | "fartlek";
  reps: string;
  work: { type: MeasureType; value: string; unit: DistanceUnit | TimeUnit };
  intensity: string;
  pace?: string; // Target pace for this block (e.g. "7:00/mi", "5:30-6:00/km")
  recovery?: Recovery;
  // For progression runs: multiple segments
  segments?: { value: string; unit: DistanceUnit | TimeUnit; type: MeasureType; intensity: string; pace?: string }[];
  // For fartlek: work and rest alternate
  fartlekRest?: { type: MeasureType; value: string; unit: DistanceUnit | TimeUnit };
};

export type WorkoutStructure = {
  warmUp: WarmUpCoolDown | null;
  blocks: WorkBlock[];
  coolDown: WarmUpCoolDown | null;
};


const INTENSITIES: Intensity[] = [
  "Easy", "Moderate", "Marathon Pace", "Threshold", "Tempo",
  "10K Pace", "5K Pace", "VO2 Max", "Sprint", "RPE", "Heart Rate Zone", "Custom"
];

const RECOVERY_TYPES: RecoveryType[] = ["Walk", "Jog", "Standing", "Easy Run", "Custom"];

const BLOCK_TYPES = [
  { value: "intervals", label: "Intervals / Repeats" },
  { value: "tempo", label: "Tempo / Continuous" },
  { value: "progression", label: "Progression Run" },
  { value: "strides", label: "Strides" },
  { value: "hillRepeats", label: "Hill Repeats" },
  { value: "fartlek", label: "Fartlek" },
] as const;

function emptyBlock(defaultUnit: DistanceUnit = "miles"): WorkBlock {
  return {
    blockType: "intervals",
    reps: "",
    work: { type: "distance", value: "", unit: defaultUnit },
    intensity: "",
    recovery: { type: "distance", value: "", unit: defaultUnit, recoveryType: "Jog" },
    segments: undefined,
    fartlekRest: undefined,
  };
}


function emptyProgressionSegment(defaultUnit: DistanceUnit = "miles") {
  return { value: "", unit: defaultUnit as DistanceUnit | TimeUnit, type: "distance" as MeasureType, intensity: "" };
}

// Calculate total distance in miles from the structure
export function calculateTotalDistance(structure: WorkoutStructure, targetUnit?: "mi" | "km"): number {
  if (!structure) return 0;
  let total = 0;

  const toTargetUnit = (value: number, unit: string, type: string): number => {
    if (type === "time") return 0;
    if (targetUnit === "km") {
      switch (unit) {
        case "km": return value;
        case "miles": return value * 1.60934;
        case "meters": return value / 1000;
        default: return 0;
      }
    } else {
      // Default: miles
      switch (unit) {
        case "miles": return value;
        case "km": return value * 0.621371;
        case "meters": return value * 0.000621371;
        default: return 0;
      }
    }
  };

  // Warm-up
  if (structure.warmUp && structure.warmUp.value) {
    total += toTargetUnit(parseFloat(structure.warmUp.value) || 0, structure.warmUp.unit, structure.warmUp.type);
  }

  // Blocks
  if (structure.blocks && Array.isArray(structure.blocks)) {
    for (const block of structure.blocks) {
      const reps = parseInt(block.reps) || 1;

      if (block.blockType === "progression" && block.segments) {
        for (const seg of block.segments) {
          total += toTargetUnit(parseFloat(seg.value) || 0, seg.unit, seg.type);
        }
      } else if (block.blockType === "tempo") {
        if (block.work) {
          total += toTargetUnit(parseFloat(block.work.value) || 0, block.work.unit, block.work.type);
        }
      } else {
        // Intervals, strides, hill repeats, fartlek
        const workDist = block.work ? toTargetUnit(parseFloat(block.work.value) || 0, block.work.unit, block.work.type) : 0;
        const recovDist = block.recovery ? toTargetUnit(parseFloat(block.recovery.value) || 0, block.recovery.unit, block.recovery.type) : 0;
        total += reps * (workDist + recovDist);
      }
    }
  }

  // Cool-down
  if (structure.coolDown && structure.coolDown.value) {
    total += toTargetUnit(parseFloat(structure.coolDown.value) || 0, structure.coolDown.unit, structure.coolDown.type);
  }

  return +total.toFixed(2);
}


// Extract pace range from structure blocks
// Returns a display string like "7:00/mi", "6:30-8:00/mi", or "" if no paces
export function getPaceRangeFromStructure(structure: WorkoutStructure, distanceUnit: "mi" | "km" = "mi"): string {
  if (!structure || !structure.blocks) return '';
  
  const paceUnit = `/${distanceUnit}`;
  const allPaces: number[] = []; // Store all paces as total seconds for comparison
  
  const parsePaceToSeconds = (pace: string): number[] => {
    if (!pace) return [];
    // Handle range: "7:00-7:30/mi" or "7:00-7:30" or "7-8"
    const rangeMatch = pace.match(/^(\d+):(\d+)\s*[-–]\s*(\d+):(\d+)/);
    if (rangeMatch) {
      const sec1 = parseInt(rangeMatch[1]) * 60 + parseInt(rangeMatch[2]);
      const sec2 = parseInt(rangeMatch[3]) * 60 + parseInt(rangeMatch[4]);
      return [sec1, sec2];
    }
    // Range with bare numbers: "7-8" or "12-15"
    const bareRangeMatch = pace.match(/^(\d+)\s*[-–]\s*(\d+)/);
    if (bareRangeMatch) {
      return [parseInt(bareRangeMatch[1]) * 60, parseInt(bareRangeMatch[2]) * 60];
    }
    // Handle single: "7:00/mi" or "7:00" 
    const singleMatch = pace.match(/^(\d+):(\d+)/);
    if (singleMatch) {
      return [parseInt(singleMatch[1]) * 60 + parseInt(singleMatch[2])];
    }
    // Handle bare number: "7" or "12"
    const bareMatch = pace.match(/^(\d+)$/);
    if (bareMatch) {
      return [parseInt(bareMatch[1]) * 60];
    }
    return [];
  };

  for (const block of structure.blocks) {
    if (block.pace) {
      allPaces.push(...parsePaceToSeconds(block.pace));
    }
    // Also check progression segments
    if (block.segments) {
      for (const seg of block.segments) {
        if ((seg as any).pace) {
          allPaces.push(...parsePaceToSeconds((seg as any).pace));
        }
      }
    }
  }

  if (allPaces.length === 0) return '';

  const minSec = Math.min(...allPaces);
  const maxSec = Math.max(...allPaces);

  const formatPace = (totalSec: number): string => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (minSec === maxSec) {
    // Single pace
    return `${formatPace(minSec)}${paceUnit}`;
  } else {
    // Range: fastest (lowest number) to slowest (highest number)
    return `${formatPace(minSec)}-${formatPace(maxSec)}${paceUnit}`;
  }
}


function toMiles(value: number, unit: DistanceUnit | TimeUnit, type: MeasureType): number {
  if (type === "time") return 0; // Can't convert time to distance without pace
  switch (unit) {
    case "miles": return value;
    case "km": return value * 0.621371;
    case "meters": return value * 0.000621371;
    default: return 0;
  }
}

// Format the structure as a display string for the client
export function formatStructureForDisplay(structure: WorkoutStructure): string {
  if (!structure) return "";
  const parts: string[] = [];

  if (structure.warmUp && structure.warmUp.value) {
    const u = structure.warmUp.unit === "minutes" ? "min" : structure.warmUp.unit === "hours" ? "hr" : structure.warmUp.unit;
    parts.push(`Warm-up: ${structure.warmUp.value} ${u} easy`);
  }

  if (structure.blocks && Array.isArray(structure.blocks)) {
    for (const block of structure.blocks) {
      try {
        parts.push(formatBlock(block));
      } catch { /* skip malformed blocks */ }
    }
  }

  if (structure.coolDown && structure.coolDown.value) {
    const u = structure.coolDown.unit === "minutes" ? "min" : structure.coolDown.unit === "hours" ? "hr" : structure.coolDown.unit;
    parts.push(`Cool-down: ${structure.coolDown.value} ${u} easy`);
  }

  return parts.join("\n");
}


function formatBlock(block: WorkBlock): string {
  const unitLabel = (u: string) => {
    switch (u) { case "meters": return "m"; case "km": return "km"; case "miles": return "mi"; case "minutes": return "min"; case "seconds": return "sec"; case "hours": return "hr"; default: return u; }
  };

  const paceStr = block.pace ? ` @ ${block.pace}` : '';

  if (block.blockType === "tempo") {
    const w = block.work ? `${block.work.value} ${unitLabel(block.work.unit)}` : "";
    return `${w}${block.intensity ? ` @ ${block.intensity}` : ''}${!block.intensity && paceStr ? paceStr : (block.pace ? ` (${block.pace})` : '')}`;
  }

  if (block.blockType === "progression" && block.segments && block.segments.length > 0) {
    return block.segments.map(s => `${s.value} ${unitLabel(s.unit)}${s.intensity ? ` ${s.intensity}` : ''}${s.pace ? ` @ ${s.pace}` : ''}`).join(" + ");
  }

  if (block.blockType === "fartlek") {
    const reps = block.reps || "?";
    const w = block.work ? `${block.work.value} ${unitLabel(block.work.unit)}${block.intensity ? ` ${block.intensity}` : ' hard'}` : "hard";
    const r = block.fartlekRest ? `${block.fartlekRest.value} ${unitLabel(block.fartlekRest.unit)} easy` : (block.recovery ? `${block.recovery.value} ${unitLabel(block.recovery.unit)} easy` : "easy");
    return `${reps} x (${w} / ${r})${paceStr}`;
  }

  // Intervals, strides, hill repeats
  const reps = block.reps || "?";
  const w = block.work ? `${block.work.value}${unitLabel(block.work.unit)}` : "";
  const intensity = block.intensity ? ` @ ${block.intensity}` : "";
  const pace = !block.intensity && paceStr ? paceStr : (block.pace && block.intensity ? ` (${block.pace})` : '');
  const recov = (block.recovery && block.recovery.value && parseFloat(block.recovery.value) > 0) ? ` w/ ${block.recovery.value}${unitLabel(block.recovery.unit)} ${(block.recovery.recoveryType || 'jog').toLowerCase()}` : "";
  return `${reps} x ${w}${intensity}${pace}${recov}`;
}


// ===== PACE AUTO-FORMAT HELPER =====
// Auto-formats pace input on blur:
// "7" → "7:00", "12" → "12:00", "7:3" → "7:30", "7:00-8" → "7:00-8:00"
// Handles ranges like "7-8" → "7:00-8:00", "12:00-15" → "12:00-15:00"
function formatPaceOnBlur(value: string): string {
  if (!value) return value;
  
  // Check if it's a range (contains - or –)
  const rangeSeparator = value.includes('–') ? '–' : '-';
  if (value.includes('-') || value.includes('–')) {
    // Might be a range but could also be part of the pace unit like "/mi"
    // Only treat as range if there's no "/" before the dash
    const parts = value.split(/\/(?:mi|km)$/);
    const paceOnly = parts[0];
    const unitSuffix = value.includes('/') ? value.slice(paceOnly.length) : '';
    
    if (paceOnly.includes('-') || paceOnly.includes('–')) {
      const sep = paceOnly.includes('–') ? '–' : '-';
      const [p1, p2] = paceOnly.split(sep).map(p => p.trim());
      const formatted1 = formatSinglePace(p1);
      const formatted2 = formatSinglePace(p2);
      if (formatted1 && formatted2) {
        return `${formatted1}-${formatted2}${unitSuffix}`;
      }
    }
  }
  
  // Single pace with potential unit suffix
  const unitMatch = value.match(/(\/(?:mi|km))$/);
  const unitSuffix = unitMatch ? unitMatch[1] : '';
  const paceOnly = unitSuffix ? value.slice(0, -unitSuffix.length) : value;
  const formatted = formatSinglePace(paceOnly);
  return formatted ? `${formatted}${unitSuffix}` : value;
}

function formatSinglePace(value: string): string {
  if (!value) return '';
  // Already properly formatted: "7:00", "12:30"
  if (/^\d+:\d{2}$/.test(value)) return value;
  // Has colon but single digit seconds: "7:3" → "7:30"
  const colonMatch = value.match(/^(\d+):(\d)$/);
  if (colonMatch) return `${colonMatch[1]}:${colonMatch[2]}0`;
  // Just a number: "7" → "7:00", "12" → "12:00"
  if (/^\d+$/.test(value)) return `${value}:00`;
  return value;
}


// ===== COMPONENT =====
interface Props {
  structure: WorkoutStructure;
  onChange: (structure: WorkoutStructure) => void;
  distanceUnit?: "mi" | "km"; // Coach's preferred distance unit
}

export default function StructuredRunBuilder({ structure, onChange, distanceUnit = "mi" }: Props) {
  const defaultDistUnit: DistanceUnit = distanceUnit === "km" ? "km" : "miles";
  const update = (changes: Partial<WorkoutStructure>) => {
    onChange({ ...structure, ...changes });
  };

  return (
    <div className="space-y-3 mt-2 border border-purple-500/20 rounded-lg p-3 bg-purple-500/5">
      <p className="text-purple-300 text-[10px] font-heading uppercase tracking-wider">Workout Structure</p>

      {/* WARM-UP */}
      <WarmUpCoolDownSection
        label="Warm-up"
        data={structure.warmUp}
        onChange={(warmUp) => update({ warmUp })}
        defaultDistUnit={defaultDistUnit}
      />

      {/* MAIN SET BLOCKS */}
      <div className="space-y-2">
        {structure.blocks.map((block, idx) => (
          <BlockEditor
            key={idx}
            block={block}
            index={idx}
            defaultDistUnit={defaultDistUnit}
            onChange={(updated) => {
              const blocks = [...structure.blocks];
              blocks[idx] = updated;
              update({ blocks });
            }}
            onRemove={() => {
              const blocks = structure.blocks.filter((_, i) => i !== idx);
              update({ blocks });
            }}
            canRemove={structure.blocks.length > 1}
          />
        ))}


        <button
          type="button"
          onClick={() => update({ blocks: [...structure.blocks, emptyBlock(defaultDistUnit)] })}
          className="text-purple-400 text-xs hover:text-purple-300 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add another block
        </button>
      </div>

      {/* COOL-DOWN */}
      <WarmUpCoolDownSection
        label="Cool-down"
        data={structure.coolDown}
        onChange={(coolDown) => update({ coolDown })}
        defaultDistUnit={defaultDistUnit}
      />

      {/* PREVIEW */}
      {(structure.warmUp?.value || structure.blocks.some(b => b.work.value) || structure.coolDown?.value) && (
        <div className="bg-primary/50 border border-white/5 rounded-lg p-2 mt-2">
          <p className="text-gray-400 text-[10px] uppercase mb-1">Preview (client sees):</p>
          <p className="text-white text-xs whitespace-pre-line leading-relaxed">{formatStructureForDisplay(structure)}</p>
          <p className="text-purple-300 text-[10px] mt-1">Auto-calculated: {calculateTotalDistance(structure, distanceUnit === 'km' ? 'km' : 'mi')} {distanceUnit === 'km' ? 'km' : 'mi'}</p>
        </div>
      )}
    </div>
  );
}


// ===== SUB-COMPONENTS =====

function WarmUpCoolDownSection({ label, data, onChange, defaultDistUnit }: { label: string; data: WarmUpCoolDown | null; onChange: (d: WarmUpCoolDown | null) => void; defaultDistUnit: DistanceUnit }) {
  const [enabled, setEnabled] = useState(!!data?.value);
  const mainUnitLabel = defaultDistUnit === "km" ? "km" : "miles";

  const toggle = () => {
    if (enabled) {
      onChange(null);
      setEnabled(false);
    } else {
      onChange({ type: "distance", value: "", unit: defaultDistUnit });
      setEnabled(true);
    }
  };

  useEffect(() => { setEnabled(!!data?.value || !!data); }, [data]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" onClick={toggle} className={`text-xs px-2 py-1 rounded border transition-colors ${enabled ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'border-white/10 text-gray-500 hover:text-white'}`}>
        {label}
      </button>
      {enabled && data && (
        <>
          <select value={data.type} onChange={(e) => onChange({ ...data, type: e.target.value as MeasureType, unit: e.target.value === "time" ? "minutes" : defaultDistUnit })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
            <option value="distance">Distance</option>
            <option value="time">Time</option>
          </select>
          <input type="text" value={data.value} onChange={(e) => onChange({ ...data, value: e.target.value })} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="0" />
          {data.type === "distance" ? (
            <button type="button" onClick={() => onChange({ ...data, unit: data.unit === "meters" ? defaultDistUnit : "meters", value: "" })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs hover:border-purple-500/50 transition-colors">
              {data.unit === "meters" ? "meters" : mainUnitLabel}
            </button>
          ) : (
            <select value={data.unit} onChange={(e) => onChange({ ...data, unit: e.target.value as TimeUnit })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
              <option value="minutes">min</option>
              <option value="hours">hr</option>
            </select>
          )}
        </>
      )}
    </div>
  );
}


function BlockEditor({ block, index, onChange, onRemove, canRemove, defaultDistUnit }: { block: WorkBlock; index: number; onChange: (b: WorkBlock) => void; onRemove: () => void; canRemove: boolean; defaultDistUnit: DistanceUnit }) {
  const updateBlock = (changes: Partial<WorkBlock>) => onChange({ ...block, ...changes });

  return (
    <div className="bg-primary/30 border border-white/5 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-[10px] font-bold">BLOCK {index + 1}</span>
        <select value={block.blockType} onChange={(e) => {
          const bt = e.target.value as WorkBlock["blockType"];
          const updated: Partial<WorkBlock> = { blockType: bt, segments: undefined, fartlekRest: undefined };
          if (bt === "progression") updated.segments = [emptyProgressionSegment(defaultDistUnit), emptyProgressionSegment(defaultDistUnit), emptyProgressionSegment(defaultDistUnit)];
          if (bt === "fartlek") updated.fartlekRest = { type: "time", value: "", unit: "minutes" };
          if (bt === "tempo") updated.reps = "1";
          onChange({ ...block, ...updated });
        }} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
          {BLOCK_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
        </select>
        {canRemove && <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-300 text-xs ml-auto">Remove</button>}
      </div>

      {block.blockType === "progression" ? (
        <ProgressionEditor block={block} onChange={onChange} defaultDistUnit={defaultDistUnit} />
      ) : block.blockType === "tempo" ? (
        <TempoEditor block={block} onChange={onChange} defaultDistUnit={defaultDistUnit} />
      ) : block.blockType === "fartlek" ? (
        <FartlekEditor block={block} onChange={onChange} defaultDistUnit={defaultDistUnit} />
      ) : (
        <IntervalsEditor block={block} onChange={onChange} defaultDistUnit={defaultDistUnit} />
      )}
    </div>
  );
}


function IntervalsEditor({ block, onChange, defaultDistUnit }: { block: WorkBlock; onChange: (b: WorkBlock) => void; defaultDistUnit: DistanceUnit }) {
  const mainUnitLabel = defaultDistUnit === "km" ? "km" : "mi";
  const paceUnitLabel = defaultDistUnit === "km" ? "/km" : "/mi";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" value={block.reps} onChange={(e) => onChange({ ...block, reps: e.target.value })} className="w-10 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="#" />
        <span className="text-gray-400 text-xs">x</span>
        {/* Work */}
        <select value={block.work.type} onChange={(e) => onChange({ ...block, work: { ...block.work, type: e.target.value as MeasureType, unit: e.target.value === "time" ? "seconds" : defaultDistUnit } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
          <option value="distance">Dist</option>
          <option value="time">Time</option>
        </select>
        <input type="text" value={block.work.value} onChange={(e) => onChange({ ...block, work: { ...block.work, value: e.target.value } })} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="0" />
        {block.work.type === "distance" ? (
          <button type="button" onClick={() => onChange({ ...block, work: { ...block.work, unit: block.work.unit === "meters" ? defaultDistUnit : "meters", value: "" } })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs hover:border-purple-500/50 transition-colors">
            {block.work.unit === "meters" ? "meters" : mainUnitLabel}
          </button>
        ) : (
          <select value={block.work.unit} onChange={(e) => onChange({ ...block, work: { ...block.work, unit: e.target.value as TimeUnit } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
            <option value="seconds">sec</option>
            <option value="minutes">min</option>
          </select>
        )}
      </div>
      {/* Intensity + Pace */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 text-xs">@</span>
        <select value={block.intensity} onChange={(e) => onChange({ ...block, intensity: e.target.value })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
          <option value="">Intensity (optional)</option>
          {INTENSITIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <input type="text" value={block.pace || ''} onChange={(e) => onChange({ ...block, pace: e.target.value })} onBlur={(e) => { const formatted = formatPaceOnBlur(e.target.value); if (formatted !== e.target.value) onChange({ ...block, pace: formatted }); }} className="w-24 bg-primary/50 border border-accent/30 rounded px-2 py-1 text-accent text-xs text-center focus:outline-none focus:ring-1 focus:ring-accent" placeholder={`Pace ${paceUnitLabel}`} />
      </div>
      {/* Recovery (optional) */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => {
          const hasRecovery = block.recovery?.value && parseFloat(block.recovery.value) > 0;
          if (hasRecovery) {
            onChange({ ...block, recovery: { ...block.recovery!, value: "" } });
          } else {
            onChange({ ...block, recovery: { type: "distance", value: "200", unit: "meters", recoveryType: "Jog" } });
          }
        }} className={`text-xs px-2 py-0.5 rounded border transition-colors ${block.recovery?.value && parseFloat(block.recovery.value) > 0 ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'border-white/10 text-gray-500 hover:text-white'}`}>
          Recovery {block.recovery?.value && parseFloat(block.recovery.value) > 0 ? '✓' : '(optional)'}
        </button>
        {block.recovery?.value && parseFloat(block.recovery.value) > 0 && (
          <>
        <select value={block.recovery.type} onChange={(e) => onChange({ ...block, recovery: { ...block.recovery!, type: e.target.value as MeasureType, unit: e.target.value === "time" ? "seconds" : "meters" } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
          <option value="distance">Dist</option>
          <option value="time">Time</option>
        </select>
        <input type="text" value={block.recovery.value} onChange={(e) => onChange({ ...block, recovery: { ...block.recovery!, value: e.target.value } })} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="0" />
        {block.recovery.type === "distance" ? (
          <button type="button" onClick={() => onChange({ ...block, recovery: { ...block.recovery!, unit: block.recovery!.unit === "meters" ? defaultDistUnit : "meters", value: "" } })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs hover:border-purple-500/50 transition-colors">
            {block.recovery.unit === "meters" ? "meters" : mainUnitLabel}
          </button>
        ) : (
          <select value={block.recovery.unit} onChange={(e) => onChange({ ...block, recovery: { ...block.recovery!, unit: e.target.value as TimeUnit } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
            <option value="seconds">sec</option>
            <option value="minutes">min</option>
          </select>
        )}
        <select value={block.recovery.recoveryType} onChange={(e) => onChange({ ...block, recovery: { ...block.recovery!, recoveryType: e.target.value as RecoveryType } })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
          {RECOVERY_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
          </>
        )}
      </div>
    </div>
  );
}


function TempoEditor({ block, onChange, defaultDistUnit }: { block: WorkBlock; onChange: (b: WorkBlock) => void; defaultDistUnit: DistanceUnit }) {
  const mainUnitLabel = defaultDistUnit === "km" ? "km" : "mi";
  const paceUnitLabel = defaultDistUnit === "km" ? "/km" : "/mi";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={block.work.type} onChange={(e) => onChange({ ...block, work: { ...block.work, type: e.target.value as MeasureType, unit: e.target.value === "time" ? "minutes" : defaultDistUnit } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
          <option value="distance">Distance</option>
          <option value="time">Time</option>
        </select>
        <input type="text" value={block.work.value} onChange={(e) => onChange({ ...block, work: { ...block.work, value: e.target.value } })} className="w-14 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="0" />
        {block.work.type === "distance" ? (
          <button type="button" onClick={() => onChange({ ...block, work: { ...block.work, unit: block.work.unit === "meters" ? defaultDistUnit : "meters", value: "" } })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs hover:border-purple-500/50 transition-colors">
            {block.work.unit === "meters" ? "meters" : mainUnitLabel}
          </button>
        ) : (
          <select value={block.work.unit} onChange={(e) => onChange({ ...block, work: { ...block.work, unit: e.target.value as TimeUnit } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
            <option value="minutes">min</option>
            <option value="hours">hr</option>
          </select>
        )}
        <span className="text-gray-500 text-xs">@</span>
        <select value={block.intensity} onChange={(e) => onChange({ ...block, intensity: e.target.value })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
          <option value="">Intensity</option>
          {INTENSITIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 text-xs">Target Pace:</span>
        <input type="text" value={block.pace || ''} onChange={(e) => onChange({ ...block, pace: e.target.value })} onBlur={(e) => { const formatted = formatPaceOnBlur(e.target.value); if (formatted !== e.target.value) onChange({ ...block, pace: formatted }); }} className="w-28 bg-primary/50 border border-accent/30 rounded px-2 py-1 text-accent text-xs text-center focus:outline-none focus:ring-1 focus:ring-accent" placeholder={`e.g. 7:30${paceUnitLabel}`} />
      </div>
    </div>
  );
}


function ProgressionEditor({ block, onChange, defaultDistUnit }: { block: WorkBlock; onChange: (b: WorkBlock) => void; defaultDistUnit: DistanceUnit }) {
  const mainUnitLabel = defaultDistUnit === "km" ? "km" : "mi";
  const paceUnitLabel = defaultDistUnit === "km" ? "/km" : "/mi";
  const segments = block.segments || [emptyProgressionSegment(defaultDistUnit)];

  const updateSegment = (idx: number, changes: any) => {
    const updated = [...segments];
    updated[idx] = { ...updated[idx], ...changes };
    onChange({ ...block, segments: updated });
  };

  return (
    <div className="space-y-2">
      <p className="text-gray-400 text-[10px]">Define each segment of the progression:</p>
      {segments.map((seg, idx) => (
        <div key={idx} className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 text-xs w-4">{idx + 1}.</span>
          <input type="text" value={seg.value} onChange={(e) => updateSegment(idx, { value: e.target.value })} className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="0" />
          {seg.type === "distance" ? (
            <button type="button" onClick={() => updateSegment(idx, { unit: seg.unit === "meters" ? defaultDistUnit : "meters", value: "" })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs hover:border-purple-500/50 transition-colors">
              {seg.unit === "meters" ? "meters" : mainUnitLabel}
            </button>
          ) : (
            <button type="button" onClick={() => updateSegment(idx, { type: "distance", unit: defaultDistUnit })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs hover:border-purple-500/50 transition-colors">
              min
            </button>
          )}
          <select value={seg.intensity} onChange={(e) => updateSegment(idx, { intensity: e.target.value })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
            <option value="">Intensity</option>
            {INTENSITIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input type="text" value={(seg as any).pace || ''} onChange={(e) => updateSegment(idx, { pace: e.target.value })} onBlur={(e) => { const formatted = formatPaceOnBlur(e.target.value); if (formatted !== e.target.value) updateSegment(idx, { pace: formatted }); }} className="w-24 bg-primary/50 border border-accent/30 rounded px-2 py-1 text-accent text-xs text-center focus:outline-none focus:ring-1 focus:ring-accent" placeholder={`Pace ${paceUnitLabel}`} />
          {segments.length > 2 && (
            <button type="button" onClick={() => { const s = segments.filter((_, i) => i !== idx); onChange({ ...block, segments: s }); }} className="text-red-400 text-xs">x</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...block, segments: [...segments, emptyProgressionSegment(defaultDistUnit)] })} className="text-purple-400 text-xs hover:text-purple-300">+ Add segment</button>
    </div>
  );
}


function FartlekEditor({ block, onChange, defaultDistUnit }: { block: WorkBlock; onChange: (b: WorkBlock) => void; defaultDistUnit: DistanceUnit }) {
  const mainUnitLabel = defaultDistUnit === "km" ? "km" : "mi";
  const paceUnitLabel = defaultDistUnit === "km" ? "/km" : "/mi";
  const rest = block.fartlekRest || { type: "time" as MeasureType, value: "", unit: "minutes" as TimeUnit };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" value={block.reps} onChange={(e) => onChange({ ...block, reps: e.target.value })} className="w-10 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="#" />
        <span className="text-gray-400 text-xs">x (</span>
        {/* Work */}
        <input type="text" value={block.work.value} onChange={(e) => onChange({ ...block, work: { ...block.work, value: e.target.value } })} className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="0" />
        <select value={block.work.unit} onChange={(e) => onChange({ ...block, work: { ...block.work, unit: e.target.value as TimeUnit } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
          <option value="seconds">sec</option>
          <option value="minutes">min</option>
        </select>
        <select value={block.intensity || ""} onChange={(e) => onChange({ ...block, intensity: e.target.value })} className="bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs">
          <option value="">hard</option>
          {INTENSITIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-400 text-xs ml-12">/</span>
        <input type="text" value={rest.value} onChange={(e) => onChange({ ...block, fartlekRest: { ...rest, value: e.target.value } })} className="w-12 bg-primary/50 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="0" />
        <select value={rest.unit} onChange={(e) => onChange({ ...block, fartlekRest: { ...rest, unit: e.target.value as TimeUnit } })} className="bg-primary/50 border border-white/10 rounded px-1.5 py-1 text-white text-xs">
          <option value="seconds">sec</option>
          <option value="minutes">min</option>
        </select>
        <span className="text-gray-400 text-xs">easy )</span>
        <input type="text" value={block.pace || ''} onChange={(e) => onChange({ ...block, pace: e.target.value })} onBlur={(e) => { const formatted = formatPaceOnBlur(e.target.value); if (formatted !== e.target.value) onChange({ ...block, pace: formatted }); }} className="w-24 bg-primary/50 border border-accent/30 rounded px-2 py-1 text-accent text-xs text-center focus:outline-none focus:ring-1 focus:ring-accent" placeholder={`Pace ${paceUnitLabel}`} />
      </div>
    </div>
  );
}
