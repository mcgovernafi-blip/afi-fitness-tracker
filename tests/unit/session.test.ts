import { describe, expect, it } from 'vitest'
import { sequenceClock } from '../../src/domain/clock'
import {
  addSet,
  completeSession,
  makeSessionExercise,
  patchSet,
  plannedRecovery,
  prefillFor,
  removeLastSet,
  setHasRecordedData,
} from '../../src/domain/session'
import type { Exercise, WorkoutSession } from '../../src/domain/types'
import { SCHEMA_VERSION } from '../../src/domain/types'

const exercise: Exercise = {
  id: 'ex-seated-row',
  name: 'Seated Row',
  equipment: 'cable',
  perSide: false,
  incrementLb: 5,
  isCustom: false,
  archived: false,
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
}

function session(): WorkoutSession {
  const clock = sequenceClock('2026-11-13T18:00:00.000Z')
  const row = makeSessionExercise({
    id: 'row-1',
    sessionId: 'session-1',
    order: 1,
    exercise,
    origin: 'template',
    prefill: prefillFor(undefined, { exerciseId: exercise.id, order: 1, targetSets: 2, targetReps: 10, targetWeightLb: 90 }),
    setIds: ['set-1', 'set-2'],
  })
  return {
    id: 'session-1',
    templateId: 'tpl',
    templateVersionId: 'ver',
    templateNameSnapshot: 'Back & Biceps A',
    date: '2026-11-13',
    startedAt: clock.now().toISOString(),
    status: 'in_progress',
    warmup: [],
    recovery: plannedRecovery('A'),
    notes: '',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-11-13T18:00:00.000Z',
    updatedAt: '2026-11-13T18:00:00.000Z',
    deviceId: 'device',
    exercises: [row],
  }
}

describe('session edits', () => {
  it('starts each exercise at two prefilled sets that are not recorded yet', () => {
    const current = session()
    expect(current.exercises[0].sets).toHaveLength(2)
    expect(current.exercises[0].sets[0]).toMatchObject({ weightLb: 90, reps: 10, done: false, touched: false })
    expect(current.exercises[0].sets.every((set) => !setHasRecordedData(set))).toBe(true)
  })

  it('removes an untouched set without confirmation and asks when the set has data', () => {
    const clock = sequenceClock('2026-11-13T18:00:00.000Z')
    const added = addSet(session(), 'row-1', 'set-3', clock.now().toISOString())
    expect(added.exercises[0].sets).toHaveLength(3)
    const removed = removeLastSet(added, 'row-1', false, clock.now().toISOString())
    expect(removed.needsConfirm).toBe(false)
    expect(removed.session.exercises[0].sets).toHaveLength(2)

    const filled = patchSet(removed.session, 'set-2', { weightLb: 85, reps: 10 }, clock.now().toISOString())
    const ask = removeLastSet(filled, 'row-1', false, clock.now().toISOString())
    expect(ask.needsConfirm).toBe(true)
    expect(ask.session.exercises[0].sets).toHaveLength(2)
    const gone = removeLastSet(filled, 'row-1', true, clock.now().toISOString())
    expect(gone.session.exercises[0].sets.map((set) => set.id)).toEqual(['set-1'])
  })

  it('keeps different actuals on each set and locks the session on finish', () => {
    const now = '2026-11-13T18:30:00.000Z'
    let current = session()
    current = patchSet(current, 'set-1', { weightLb: 90, reps: 12, done: true }, now)
    current = patchSet(current, 'set-2', { weightLb: 85, reps: 10, done: true }, now)
    expect(current.exercises[0].status).toBe('complete')
    const finished = completeSession(current, now)
    expect(finished.status).toBe('completed')
    expect(finished.finishedAt).toBe(now)
    expect(finished.exercises[0].sets.map((set) => [set.weightLb, set.reps])).toEqual([
      [90, 12],
      [85, 10],
    ])
    expect(() => patchSet(finished, 'set-1', { reps: 1 }, now)).toThrow(/immutable/)
  })

  it('plans HydroMassage after lifting and Massage Chair on B days only', () => {
    expect(plannedRecovery('A').filter((entry) => entry.planned).map((entry) => entry.activity)).toEqual(['HydroMassage'])
    expect(plannedRecovery('B').filter((entry) => entry.planned).map((entry) => entry.activity)).toEqual([
      'HydroMassage',
      'Massage Chair',
    ])
    expect(plannedRecovery(null).find((entry) => entry.activity === 'Massage Chair')?.planned).toBe(false)
    expect(plannedRecovery('A').every((entry) => entry.done === false)).toBe(true)
  })
})
