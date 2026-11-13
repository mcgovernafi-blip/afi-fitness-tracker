import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addExercise, finishWorkout, startOrResume, updateSet } from '../../src/app/usecases'
import { sequenceClock } from '../../src/domain/clock'
import { AfiDatabase } from '../../src/data/db'
import { DexieRepository } from '../../src/data/dexie-repository'
import { slugId } from '../../src/domain/seed'
import type { WorkoutSession } from '../../src/domain/types'

async function logPair(
  repo: DexieRepository,
  clock: ReturnType<typeof sequenceClock>,
  templateId: string,
  exerciseId: string,
  weight: number | null,
  reps: number,
  formOk = true,
  date?: string,
): Promise<WorkoutSession> {
  const session = await startOrResume(repo, templateId, clock)
  await addExercise(repo, session.id, exerciseId, false, clock)
  let current = await repo.getSession(session.id)
  if (!current) throw new Error('missing session')
  if (date) {
    current = { ...current, date }
    await repo.saveSession(current)
  }
  for (const set of current.exercises[0].sets) {
    await updateSet(
      repo,
      current.id,
      set.id,
      { weightLb: weight, reps, repsLeft: null, repsRight: null, done: true },
      clock,
    )
  }
  if (!formOk) {
    const row = (await repo.getSession(current.id))?.exercises[0]
    if (!row) throw new Error('missing row')
    const { setFormOk } = await import('../../src/app/usecases')
    await setFormOk(repo, current.id, row.id, false, clock)
  }
  return finishWorkout(repo, current.id, clock)
}

describe('progression across sessions', () => {
  let repo: DexieRepository

  beforeEach(async () => {
    repo = new DexieRepository(new AfiDatabase(`test-${crypto.randomUUID()}`))
    await repo.ready(sequenceClock('2026-01-01T15:00:00.000Z'))
  })

  afterEach(async () => {
    await repo.delete()
  })

  it('recommends 10 → 11 → 12 → +increment and leaves every finished log unchanged', async () => {
    const clock = sequenceClock('2026-02-01T15:00:00.000Z')
    const exerciseId = slugId('ex', 'Lat Pulldown')
    const dates = ['2020-01-01', '2024-06-01', '2026-11-13']
    const finished: WorkoutSession[] = []
    for (const [index, reps] of [10, 11, 12].entries()) {
      finished.push(await logPair(repo, clock, 'tpl-back-biceps-a', exerciseId, 80, reps, true, dates[index]))
    }
    expect(finished[2].exercises[0].sets.map((set) => set.weightLb)).toEqual([80, 80])
    const state = await repo.getProgression(exerciseId)
    expect(state?.stage).toBe(10)
    expect(state?.workingWeightLb).toBe(85)
    expect(state?.pendingSuggestion?.reason).toBe('2×12 done with good form → try 2×10 at 85 lb')
    const reread = await repo.getSession(finished[2].id)
    expect(reread?.exercises[0].sets.map((set) => [set.weightLb, set.reps])).toEqual([
      [80, 12],
      [80, 12],
    ])
  })

  it('does not advance the weight when form is off, and a long gap does not reset the stage', async () => {
    const clock = sequenceClock('2026-03-01T15:00:00.000Z')
    const exerciseId = slugId('ex', 'Chest Press')
    await logPair(repo, clock, 'tpl-chest-triceps-a', exerciseId, 50, 10, true, '2019-01-01')
    await logPair(repo, clock, 'tpl-chest-triceps-a', exerciseId, 50, 11, true, '2019-02-01')
    await logPair(repo, clock, 'tpl-chest-triceps-a', exerciseId, 50, 12, false, '2026-11-01')
    const held = await repo.getProgression(exerciseId)
    expect(held?.stage).toBe(12)
    expect(held?.workingWeightLb).toBe(50)
    await logPair(repo, clock, 'tpl-chest-triceps-a', exerciseId, 50, 12, true, '2026-11-13')
    const next = await repo.getProgression(exerciseId)
    expect(next?.workingWeightLb).toBe(55)
    expect(next?.stage).toBe(10)
  })

  it('logs a weight override and keeps the weight he actually lifted', async () => {
    const clock = sequenceClock('2026-04-01T15:00:00.000Z')
    const exerciseId = slugId('ex', 'Biceps Curl')
    await logPair(repo, clock, 'tpl-back-biceps-b', exerciseId, 30, 10)
    const suggested = await repo.getProgression(exerciseId)
    expect(suggested).toMatchObject({ workingWeightLb: 30, stage: 11 })
    const finished = await logPair(repo, clock, 'tpl-back-biceps-b', exerciseId, 25, 11)
    expect(finished.exercises[0].sets.every((set) => set.weightLb === 25 && set.reps === 11)).toBe(true)
    const state = await repo.getProgression(exerciseId)
    expect(state?.overrides.some((override) => override.field === 'weight' && override.from === 30 && override.to === 25)).toBe(true)
    expect(state?.workingWeightLb).toBe(25)
    expect(state?.stage).toBe(12)
  })
})
