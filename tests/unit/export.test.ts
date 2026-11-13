import { describe, expect, it } from 'vitest'
import { formatHistoryCsv, formatWorkoutText } from '../../src/domain/export'
import { plannedRecovery } from '../../src/domain/session'
import type { WorkoutSession } from '../../src/domain/types'
import { SCHEMA_VERSION } from '../../src/domain/types'

function session(): WorkoutSession {
  const recovery = plannedRecovery('B').map((entry) =>
    entry.activity === 'HydroMassage' ? { ...entry, done: true, minutes: 10 } : entry,
  )
  return {
    id: 'session-1',
    templateId: 'tpl-back-biceps-b',
    templateVersionId: 'tpl-back-biceps-b-v3',
    templateNameSnapshot: 'Back & Biceps B',
    date: '2026-11-11',
    startedAt: '2026-11-11T18:02:00.000Z',
    finishedAt: '2026-11-11T18:54:00.000Z',
    status: 'completed',
    warmup: [],
    recovery,
    notes: 'Shoulders felt easy',
    energyLevel: 4,
    jointDiscomfort: { level: 0 },
    moodBefore: 3,
    moodAfter: 4,
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-11-11T18:02:00.000Z',
    updatedAt: '2026-11-11T18:54:00.000Z',
    deviceId: 'device',
    exercises: [
      {
        id: 'row-1',
        sessionId: 'session-1',
        order: 1,
        exerciseId: 'ex-seated-row',
        exerciseNameSnapshot: 'Seated Row',
        origin: 'template',
        perSide: false,
        formOk: true,
        target: { sets: 2, reps: 12, weightLb: 90 },
        status: 'complete',
        sets: [
          { id: 'a', sessionExerciseId: 'row-1', index: 1, weightLb: 90, reps: 12, repsLeft: null, repsRight: null, done: true, touched: true },
          { id: 'b', sessionExerciseId: 'row-1', index: 2, weightLb: 90, reps: 12, repsLeft: null, repsRight: null, done: true, touched: true },
        ],
      },
      {
        id: 'row-2',
        sessionId: 'session-1',
        order: 2,
        exerciseId: 'ex-lat-pulldown',
        exerciseNameSnapshot: 'Lat Pulldown',
        origin: 'substituted',
        substitutedForExerciseId: 'ex-seated-row',
        substitutedForName: 'Seated Row',
        perSide: false,
        formOk: true,
        target: { sets: 2, reps: 11, weightLb: 100 },
        status: 'partial',
        sets: [
          { id: 'c', sessionExerciseId: 'row-2', index: 1, weightLb: 100, reps: 11, repsLeft: null, repsRight: null, done: true, touched: true },
          { id: 'd', sessionExerciseId: 'row-2', index: 2, weightLb: 100, reps: 10, repsLeft: null, repsRight: null, done: false, touched: true },
        ],
      },
      {
        id: 'row-3',
        sessionId: 'session-1',
        order: 3,
        exerciseId: 'ex-rear-delt-fly',
        exerciseNameSnapshot: 'Rear Delt Fly',
        origin: 'added',
        perSide: false,
        formOk: true,
        target: { sets: 2, reps: 12, weightLb: 50 },
        status: 'complete',
        sets: [
          { id: 'e', sessionExerciseId: 'row-3', index: 1, weightLb: 50, reps: 12, repsLeft: null, repsRight: null, done: true, touched: true },
          { id: 'f', sessionExerciseId: 'row-3', index: 2, weightLb: 50, reps: 12, repsLeft: null, repsRight: null, done: true, touched: true },
        ],
      },
      {
        id: 'row-4',
        sessionId: 'session-1',
        order: 4,
        exerciseId: 'ex-rotary-torso',
        exerciseNameSnapshot: 'Rotary Torso',
        origin: 'added',
        perSide: true,
        formOk: true,
        target: { sets: 1, reps: 12, weightLb: 60 },
        status: 'complete',
        sets: [
          { id: 'g', sessionExerciseId: 'row-4', index: 1, weightLb: 60, reps: null, repsLeft: 12, repsRight: 11, done: true, touched: true },
        ],
      },
      {
        id: 'row-5',
        sessionId: 'session-1',
        order: 5,
        exerciseId: 'ex-biceps-curl',
        exerciseNameSnapshot: 'Biceps Curl',
        origin: 'template',
        perSide: false,
        formOk: true,
        target: { sets: 2, reps: 10, weightLb: null },
        status: 'not_started',
        sets: [
          { id: 'h', sessionExerciseId: 'row-5', index: 1, weightLb: null, reps: 10, repsLeft: null, repsRight: null, done: false, touched: false },
          { id: 'i', sessionExerciseId: 'row-5', index: 2, weightLb: null, reps: 10, repsLeft: null, repsRight: null, done: false, touched: false },
        ],
      },
    ],
  }
}

describe('export', () => {
  it('copies a completed workout as text', () => {
    expect(formatWorkoutText(session(), 'UTC')).toBe(
      [
        'AFI Fitness Tracker — Back & Biceps B — Wed Nov 11 2026, 6:02–6:54 PM',
        '1. Seated Row: 90×12 ✓, 90×12 ✓',
        '2. Lat Pulldown (sub for Seated Row): 100×11 ✓, 100×10',
        '3. Rear Delt Fly (added): 50×12 ✓, 50×12 ✓',
        '4. Rotary Torso (added): 60×L12/R11 ✓',
        '5. Biceps Curl: —×10, —×10',
        'Incomplete: Lat Pulldown, Biceps Curl',
        'Recovery: HydroMassage 10 min',
        'Energy 4/5 · Joint discomfort 0 · Mood 3→4',
        'Notes: Shoulders felt easy',
      ].join('\n'),
    )
  })

  it('writes one CSV row per set and neutralizes spreadsheet formulas', () => {
    const current = session()
    current.notes = '=cmd()'
    current.exercises[0].sets[0].notes = '+sum(1)'
    const csv = formatHistoryCsv([current, { ...current, id: 'open', status: 'in_progress' }])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe(
      'date,workout,started_at,finished_at,exercise,origin,substituted_for,set_index,weight_lb,reps,reps_left,reps_right,done,set_notes,energy,joint_discomfort,mood_before,mood_after,recovery,session_notes',
    )
    expect(lines).toHaveLength(1 + 2 + 2 + 2 + 1 + 2)
    expect(lines[1]).toContain('Seated Row')
    expect(lines[1]).toContain("'+sum(1)")
    expect(csv).toContain("'=cmd()")
    expect(csv).not.toContain('open')
    expect(lines.some((line) => line.includes('L12') || line.includes(',12,11,'))).toBe(true)
  })
})
