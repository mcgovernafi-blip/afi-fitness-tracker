import { describe, expect, it } from 'vitest'
import { evaluateProject22 } from '../../src/domain/project22'
import type { SetEntry, Stage } from '../../src/domain/types'

function set(partial: Partial<SetEntry> & { index: number }): SetEntry {
  return {
    id: `set-${partial.index}`,
    sessionExerciseId: 'row',
    weightLb: null,
    reps: null,
    repsLeft: null,
    repsRight: null,
    done: false,
    touched: false,
    ...partial,
  }
}

function doneSet(index: number, weight: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  return set({ index, weightLb: weight, reps, done: true, touched: true, ...extra })
}

function evaluate(overrides: Partial<Parameters<typeof evaluateProject22>[0]> = {}) {
  return evaluateProject22({
    sets: [doneSet(1, 50, 10), doneSet(2, 50, 10)],
    perSide: false,
    workingWeightLb: null,
    stage: 10,
    formOk: true,
    incrementLb: 5,
    ...overrides,
  })
}

describe('Project 22', () => {
  it('advances 10 to 11 without changing the logged weight', () => {
    const result = evaluate()
    expect(result.suggestion).toMatchObject({
      kind: 'advance_reps',
      fromWeightLb: 50,
      toWeightLb: 50,
      fromReps: 10,
      toReps: 11,
      reason: '2×10 done → try 2×11',
    })
    expect(result.nextStage).toBe(11)
    expect(result.nextWeightLb).toBe(50)
    expect(result.qualified).toBe(true)
  })

  it('advances 11 to 12', () => {
    const result = evaluate({
      stage: 11,
      workingWeightLb: 50,
      sets: [doneSet(1, 50, 11), doneSet(2, 50, 11)],
    })
    expect(result.suggestion.reason).toBe('2×11 done → try 2×12')
    expect(result.nextStage).toBe(12)
    expect(result.nextWeightLb).toBe(50)
  })

  it('suggests the smallest increment after 2×12 with form OK and does not rewrite the input sets', () => {
    const sets = [doneSet(1, 90, 12), doneSet(2, 90, 12), doneSet(3, 90, 8)]
    const before = JSON.stringify(sets)
    const result = evaluate({ sets, stage: 12, workingWeightLb: 90, incrementLb: 5 })
    expect(result.suggestion).toMatchObject({
      kind: 'increase_weight',
      toWeightLb: 95,
      toReps: 10,
      reason: '2×12 done with good form → try 2×10 at 95 lb',
    })
    expect(result.nextStage).toBe(10)
    expect(JSON.stringify(sets)).toBe(before)
  })

  it('holds at 12 when form is not OK', () => {
    const result = evaluate({
      sets: [doneSet(1, 90, 12), doneSet(2, 90, 12)],
      stage: 12,
      workingWeightLb: 90,
      formOk: false,
    })
    expect(result.suggestion.kind).toBe('hold')
    expect(result.nextStage).toBe(12)
    expect(result.nextWeightLb).toBe(90)
    expect(result.suggestion.reason).toContain('Form was not marked OK')
    expect(result.qualified).toBe(false)
  })

  it('holds when fewer than two sets are done', () => {
    const result = evaluate({ sets: [doneSet(1, 40, 10), set({ index: 2 })] })
    expect(result.suggestion.kind).toBe('hold')
    expect(result.nextStage).toBe(10)
    expect(result.nextWeightLb).toBe(40)
  })

  it('holds when any working set is short of the stage', () => {
    const result = evaluate({
      workingWeightLb: 50,
      sets: [doneSet(1, 50, 10), doneSet(2, 50, 9)],
    })
    expect(result.suggestion.kind).toBe('hold')
    expect(result.nextStage).toBe(10)
    expect(result.nextWeightLb).toBe(50)
  })

  it('uses min(left, right) for per-side reps', () => {
    const hold = evaluate({
      perSide: true,
      stage: 12,
      workingWeightLb: 60,
      sets: [
        doneSet(1, 60, 0, { reps: null, repsLeft: 12, repsRight: 11 }),
        doneSet(2, 60, 0, { reps: null, repsLeft: 12, repsRight: 12 }),
      ],
    })
    expect(hold.suggestion.kind).toBe('hold')
    expect(hold.nextWeightLb).toBe(60)

    const up = evaluate({
      perSide: true,
      stage: 12,
      workingWeightLb: 60,
      incrementLb: 5,
      sets: [
        doneSet(1, 60, 0, { reps: null, repsLeft: 12, repsRight: 12 }),
        doneSet(2, 60, 0, { reps: null, repsLeft: 13, repsRight: 12 }),
      ],
    })
    expect(up.suggestion.kind).toBe('increase_weight')
    expect(up.nextWeightLb).toBe(65)
    expect(up.nextStage).toBe(10)
  })

  it('ignores extra sets beyond the first two at the working weight', () => {
    const result = evaluate({
      stage: 10,
      workingWeightLb: 50,
      sets: [doneSet(1, 50, 10), doneSet(2, 50, 10), doneSet(3, 50, 1)],
    })
    expect(result.suggestion.kind).toBe('advance_reps')
  })

  it('counts the first two completed sets at the working weight when an earlier set is open', () => {
    const result = evaluate({
      stage: 10,
      workingWeightLb: 50,
      sets: [set({ index: 1, weightLb: 50, reps: 10 }), doneSet(2, 50, 10), doneSet(3, 50, 10)],
    })
    expect(result.suggestion.kind).toBe('advance_reps')
  })

  it('treats a completed pair at a new weight as an override and continues from those reps', () => {
    const result = evaluate({
      stage: 12,
      workingWeightLb: 90,
      sets: [doneSet(1, 100, 10), doneSet(2, 100, 10)],
    })
    expect(result.weightOverride).toEqual({ from: 90, to: 100 })
    expect(result.suggestion.kind).toBe('hold')
    expect(result.nextWeightLb).toBe(100)
    expect(result.nextStage).toBe(12)
  })

  it('uses the exercise increment, not a forced jump', () => {
    const result = evaluate({
      stage: 12,
      workingWeightLb: 40,
      incrementLb: 10,
      sets: [doneSet(1, 40, 12), doneSet(2, 40, 12)],
    })
    expect(result.nextWeightLb).toBe(50)
    expect(result.suggestion.reason).toContain('50 lb')
  })

  it('returns the same suggestion no matter how long the gap is', () => {
    const input = {
      sets: [doneSet(1, 70, 12), doneSet(2, 70, 12)],
      perSide: false,
      workingWeightLb: 70,
      stage: 12 as Stage,
      formOk: true,
      incrementLb: 5,
    }
    expect(evaluateProject22(input)).toEqual(evaluateProject22(input))
    expect(JSON.stringify(evaluateProject22(input))).toBe(JSON.stringify(evaluateProject22({ ...input })))
  })
})
