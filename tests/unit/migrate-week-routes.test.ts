import { afterEach, describe, expect, it } from 'vitest'
import { visitsThisWeek } from '../../src/app/usecases'
import { sequenceClock } from '../../src/domain/clock'
import { backupIsStale, suggestedWorkoutName, weekBounds } from '../../src/domain/dates'
import { migrateBackup } from '../../src/domain/migrate'
import { joinBase, matchRoute, stripBase } from '../../src/domain/routes'
import { DEFAULT_WARMUP, MACHINE_NAMES, TEMPLATE_SEEDS } from '../../src/domain/seed'
import { APP_ID, SCHEMA_VERSION, type WorkoutSession } from '../../src/domain/types'
import { AfiDatabase } from '../../src/data/db'
import { DexieRepository } from '../../src/data/dexie-repository'

describe('migrations', () => {
  it('accepts a versionless backup and rejects a newer one', () => {
    const legacy = {
      settings: { id: 'settings', weeklyGoal: 3, units: 'lb', theme: 'system', storagePersisted: false, deviceId: 'd', schemaVersion: 0 },
      warmupDefaults: { id: 'warmup', items: DEFAULT_WARMUP },
      sessions: [{ id: 's', exercises: [{ id: 'e', sets: [{ id: 'set', index: 1, done: true }], formOk: undefined }] }],
    }
    const migrated = migrateBackup(legacy)
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.app).toBe(APP_ID)
    expect(migrated.sessions[0].exercises[0].formOk).toBe(true)
    expect(migrated.sessions[0].exercises[0].sets[0].touched).toBe(false)
    expect(() => migrateBackup({ ...legacy, schemaVersion: 99 })).toThrow(/newer version/)
    expect(() => migrateBackup({ app: 'other', schemaVersion: 1, settings: legacy.settings, warmupDefaults: legacy.warmupDefaults })).toThrow(/not an AFI/)
  })
})

describe('week and suggestions', () => {
  it('counts completed visits in the Monday week and ignores other weeks', () => {
    const today = new Date(2026, 10, 13)
    expect(weekBounds(today)).toEqual({ start: '2026-11-09', end: '2026-11-15' })
    const sessions = [
      { status: 'completed', date: '2026-11-09' },
      { status: 'completed', date: '2026-11-13' },
      { status: 'completed', date: '2026-11-02' },
      { status: 'in_progress', date: '2026-11-13' },
      { status: 'discarded', date: '2026-11-12' },
    ] as WorkoutSession[]
    expect(visitsThisWeek(sessions, today)).toBe(2)
    expect(visitsThisWeek(sessions, new Date(2026, 10, 20))).toBe(0)
  })

  it('suggests the labeled weekday without making it mandatory', () => {
    expect(suggestedWorkoutName(new Date(2026, 10, 9))).toBe('Back & Biceps A')
    expect(suggestedWorkoutName(new Date(2026, 10, 10))).toBe('Chest & Triceps A')
    expect(suggestedWorkoutName(new Date(2026, 10, 11))).toBe('Back & Biceps B')
    expect(suggestedWorkoutName(new Date(2026, 10, 12))).toBe('Chest & Triceps B')
    expect(suggestedWorkoutName(new Date(2026, 10, 13))).toBe('Legs & Stretching')
    expect(suggestedWorkoutName(new Date(2026, 10, 14))).toBeNull()
    expect(suggestedWorkoutName(new Date(2026, 10, 15))).toBeNull()
  })

  it('asks for a backup after seven days', () => {
    const now = new Date('2026-11-13T00:00:00.000Z')
    expect(backupIsStale(undefined, now)).toBe(true)
    expect(backupIsStale('2026-11-12T00:00:00.000Z', now)).toBe(false)
    expect(backupIsStale('2026-11-01T00:00:00.000Z', now)).toBe(true)
  })
})

describe('routes and base path', () => {
  it('strips and joins the GitHub Pages subpath', () => {
    const base = '/afi-fitness-tracker/'
    expect(stripBase('/afi-fitness-tracker/history', base)).toBe('/history')
    expect(stripBase('/afi-fitness-tracker/', base)).toBe('/')
    expect(stripBase('/history', '/')).toBe('/history')
    expect(joinBase('/history', base)).toBe('/afi-fitness-tracker/history')
    expect(joinBase('/', base)).toBe('/afi-fitness-tracker/')
    expect(matchRoute('/workout/abc/sub/row%201')).toEqual({ name: 'substitute', sessionId: 'abc', rowId: 'row 1' })
  })
})

describe('seed contract', () => {
  it('names the five workouts and the 21 machines from the request', () => {
    expect(TEMPLATE_SEEDS.map((template) => template.name)).toEqual([
      'Back & Biceps A',
      'Chest & Triceps A',
      'Back & Biceps B',
      'Chest & Triceps B',
      'Legs & Stretching',
    ])
    expect([...MACHINE_NAMES]).toHaveLength(21)
    expect(MACHINE_NAMES).toContain('Cable Pallof Press')
    expect(MACHINE_NAMES).toContain('Rotary Torso')
    expect(DEFAULT_WARMUP.map((item) => item.label)).toEqual(['Easy cardio', 'Joint mobility', 'Light warm-up set'])
  })
})

describe('seed and backup', () => {
  let repo: DexieRepository

  afterEach(async () => {
    await repo.delete()
  })

  it('seeds empty workouts, the 21 machines, and restores a backup exactly', async () => {
    repo = new DexieRepository(new AfiDatabase(`test-${crypto.randomUUID()}`))
    await repo.ready(sequenceClock('2026-11-13T18:00:00.000Z'))
    const exercises = await repo.listExercises()
    expect(exercises).toHaveLength(21)
    expect(exercises.map((exercise) => exercise.name).sort()).toEqual([...MACHINE_NAMES].sort())
    expect(exercises.find((exercise) => exercise.name === 'Rotary Torso')).toMatchObject({ perSide: true, incrementLb: 5 })
    expect(exercises.filter((exercise) => exercise.perSide).map((exercise) => exercise.name)).toEqual(['Rotary Torso'])
    expect(exercises.every((exercise) => exercise.incrementLb === 5)).toBe(true)
    const templates = await repo.listTemplates()
    expect(templates).toHaveLength(5)
    for (const template of templates) {
      const versions = await repo.listVersions(template.id)
      expect(versions).toHaveLength(1)
      expect(versions[0].items).toEqual([])
    }
    const settings = await repo.getSettings()
    expect(settings.units).toBe('lb')
    expect(settings.weeklyGoal).toBe(3)
    const backup = await repo.exportAll('2026-11-13T18:30:00.000Z')
    backup.sessions = [
      {
        id: 'kept',
        templateId: 'tpl-legs',
        templateVersionId: 'tpl-legs-v1',
        templateNameSnapshot: 'Legs & Stretching',
        date: '2026-11-13',
        startedAt: '2026-11-13T18:00:00.000Z',
        finishedAt: '2026-11-13T18:20:00.000Z',
        status: 'completed',
        warmup: [],
        recovery: [],
        notes: 'keep me',
        schemaVersion: 1,
        createdAt: '2026-11-13T18:00:00.000Z',
        updatedAt: '2026-11-13T18:20:00.000Z',
        deviceId: settings.deviceId,
        exercises: [],
      },
    ]
    await repo.importAll(backup)
    const restored = await repo.exportAll('2026-11-13T19:00:00.000Z')
    expect(restored.sessions.map((session) => session.notes)).toEqual(['keep me'])
    expect(restored.exercises).toHaveLength(21)
    expect(restored.settings.deviceId).toBe(settings.deviceId)
  })
})
