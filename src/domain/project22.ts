import type { P22Suggestion, ProgressionState, SetEntry, Stage } from './types'

/**
 * Project 22 recommendation engine.
 *
 * The calendar is intentionally not an input. Missed days, weeks, or months
 * cannot reset or reduce progress, because this function never sees them.
 * The returned next weight and stage are a suggestion for the next session.
 * They are never written back onto the sets that were just logged.
 */
export interface Project22Input {
  sets: SetEntry[]
  perSide: boolean
  workingWeightLb: number | null
  stage: Stage
  formOk: boolean
  incrementLb: number
}

export interface Project22Result {
  suggestion: P22Suggestion
  nextWeightLb: number | null
  nextStage: Stage
  weightOverride: { from: number; to: number } | null
  qualified: boolean
}

export function freshProgression(exerciseId: string): ProgressionState {
  return {
    exerciseId,
    workingWeightLb: null,
    stage: 10,
    overrides: [],
  }
}

export function repValue(set: SetEntry, perSide: boolean): number | null {
  if (perSide) {
    if (set.repsLeft == null || set.repsRight == null) return null
    return Math.min(set.repsLeft, set.repsRight)
  }
  return set.reps
}

export function evaluateProject22(input: Project22Input): Project22Result {
  const increment = input.incrementLb > 0 ? input.incrementLb : 5
  const done = [...input.sets].filter((set) => set.done).sort((a, b) => a.index - b.index)
  const atWeight = (weight: number) => done.filter((set) => set.weightLb === weight).slice(0, 2)

  let weight = input.workingWeightLb
  let weightOverride: { from: number; to: number } | null = null

  if (weight == null) {
    if (done.length >= 2 && done[0].weightLb != null && done[0].weightLb === done[1].weightLb) {
      weight = done[0].weightLb
    }
  } else if (atWeight(weight).length < 2) {
    if (
      done.length >= 2 &&
      done[0].weightLb != null &&
      done[0].weightLb === done[1].weightLb &&
      done[0].weightLb !== weight
    ) {
      weightOverride = { from: weight, to: done[0].weightLb }
      weight = done[0].weightLb
    }
  }

  const hold = (detail: string, nextWeight: number | null = weight): Project22Result => ({
    suggestion: {
      kind: 'hold',
      fromWeightLb: input.workingWeightLb,
      toWeightLb: nextWeight,
      fromReps: input.stage,
      toReps: input.stage,
      reason: `Hold at 2×${input.stage}. ${detail}`,
    },
    nextWeightLb: nextWeight,
    nextStage: input.stage,
    weightOverride,
    qualified: false,
  })

  if (weight == null) {
    const remembered = done.find((set) => set.weightLb != null)?.weightLb ?? null
    if (done.length < 2) {
      return hold('Fewer than two completed sets at the working weight.', remembered)
    }
    return hold('The first two completed sets used different weights.')
  }

  const working = atWeight(weight)
  if (working.length < 2) {
    return hold('Fewer than two completed sets at the working weight.', weight)
  }

  const reps = working.map((set) => repValue(set, input.perSide))
  if (reps.some((value) => value == null || value < input.stage)) {
    return hold(`Completed sets were under ${input.stage} reps.`)
  }

  if (input.stage === 10 || input.stage === 11) {
    const toReps: Stage = input.stage === 10 ? 11 : 12
    const reason = input.stage === 10 ? '2×10 done → try 2×11' : '2×11 done → try 2×12'
    return {
      suggestion: {
        kind: 'advance_reps',
        fromWeightLb: weight,
        toWeightLb: weight,
        fromReps: input.stage,
        toReps,
        reason,
      },
      nextWeightLb: weight,
      nextStage: toReps,
      weightOverride,
      qualified: true,
    }
  }

  if (input.formOk) {
    const next = weight + increment
    return {
      suggestion: {
        kind: 'increase_weight',
        fromWeightLb: weight,
        toWeightLb: next,
        fromReps: 12,
        toReps: 10,
        reason: `2×12 done with good form → try 2×10 at ${next} lb`,
      },
      nextWeightLb: next,
      nextStage: 10,
      weightOverride,
      qualified: true,
    }
  }

  return {
    suggestion: {
      kind: 'hold',
      fromWeightLb: weight,
      toWeightLb: weight,
      fromReps: 12,
      toReps: 12,
      reason: 'Hold at 2×12. Form was not marked OK, so the weight stays.',
    },
    nextWeightLb: weight,
    nextStage: 12,
    weightOverride,
    qualified: false,
  }
}
