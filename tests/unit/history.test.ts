import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sequenceClock } from '../../src/domain/clock'
import {
  addExercise,
  finishWorkout,
  saveSessionToTemplate,
  startOrResume,
  updateSet,
  writeNewVersion,
} from '../../src/app/usecases'
import { AfiDatabase } from '../../src/data/db'
import { DexieRepository } from '../../src/data/dexie-repository'
import { slugId } from '../../src/domain/seed'

describe('history stays put when templates change', () => {
  let repo: DexieRepository
  const clock = sequenceClock('2026-11-13T18:00:00.000Z')

  beforeEach(async () => {
    repo = new DexieRepository(new AfiDatabase(`test-${crypto.randomUUID()}`))
    await repo.ready(clock)
  })

  afterEach(async () => {
    await repo.delete()
  })

  it('keeps a finished session byte-for-byte after a template version change and a rename', async () => {
    const templates = await repo.listTemplates()
    const template = templates.find((item) => item.name === 'Back & Biceps A')
    if (!template) throw new Error('missing template')
    const seated = await repo.getExercise(slugId('ex', 'Seated Row'))
    if (!seated) throw new Error('missing seated row')
    const session = await startOrResume(repo, template.id, clock)
    await addExercise(repo, session.id, seated.id, false, clock)
    const fresh = await repo.getSession(session.id)
    if (!fresh) throw new Error('missing session')
    const setId = fresh.exercises[0].sets[0].id
    await updateSet(repo, fresh.id, setId, { weightLb: 90, reps: 12, done: true }, clock)
    await saveSessionToTemplate(repo, fresh.id, clock)
    const finished = await finishWorkout(repo, fresh.id, clock)
    const before = JSON.stringify(await repo.getSession(finished.id))

    const updatedTemplate = await repo.getTemplate(template.id)
    if (!updatedTemplate) throw new Error('missing template')
    await writeNewVersion(
      repo,
      updatedTemplate,
      [{ exerciseId: slugId('ex', 'Pec Fly'), order: 1, targetSets: 3, targetReps: 8, targetWeightLb: 40 }],
      clock,
    )
    await repo.saveExercise({ ...seated, name: 'Seated Cable Row', updatedAt: '2026-12-01T00:00:00.000Z' })

    const after = JSON.stringify(await repo.getSession(finished.id))
    expect(after).toBe(before)
    const stored = await repo.getSession(finished.id)
    expect(stored?.exercises[0].exerciseNameSnapshot).toBe('Seated Row')
    expect(stored?.exercises[0].sets[0]).toMatchObject({ weightLb: 90, reps: 12, done: true })
    expect(stored?.templateVersionId).toBe(finished.templateVersionId)
    const versions = await repo.listVersions(template.id)
    expect(versions.map((version) => version.version)).toEqual([1, 2, 3])
    expect(versions[0].items).toEqual([])
    expect(versions[2].items[0].exerciseId).toBe(slugId('ex', 'Pec Fly'))
  })

  it('refuses to overwrite a template version or a finished session', async () => {
    const versions = await repo.listVersions('tpl-legs')
    await expect(repo.saveVersion(versions[0])).rejects.toThrow(/immutable/)
    const template = (await repo.listTemplates()).find((item) => item.id === 'tpl-legs')
    if (!template) throw new Error('missing')
    const session = await startOrResume(repo, template.id, clock)
    const finished = await finishWorkout(repo, session.id, clock)
    await expect(repo.saveSession({ ...finished, notes: 'changed later' })).rejects.toThrow(/immutable/)
  })
})
