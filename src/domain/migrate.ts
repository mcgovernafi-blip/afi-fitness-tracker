import type {
  BackupFile,
  Exercise,
  ProgressionState,
  SessionExercise,
  SetEntry,
  TemplateVersion,
  WarmupDefaults,
  WorkoutSession,
  WorkoutTemplate,
} from './types'
import { APP_ID, SCHEMA_VERSION } from './types'

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeSet(set: SetEntry): SetEntry {
  return {
    ...set,
    weightLb: set.weightLb ?? null,
    reps: set.reps ?? null,
    repsLeft: set.repsLeft ?? null,
    repsRight: set.repsRight ?? null,
    done: Boolean(set.done),
    touched: Boolean(set.touched),
  }
}

function normalizeExercise(exercise: SessionExercise): SessionExercise {
  const sets = asArray<SetEntry>(exercise.sets).map(normalizeSet)
  return {
    ...exercise,
    formOk: exercise.formOk !== false,
    sets,
  }
}

function normalizeSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    schemaVersion: session.schemaVersion || SCHEMA_VERSION,
    notes: session.notes ?? '',
    warmup: session.warmup ?? [],
    recovery: session.recovery ?? [],
    exercises: asArray<SessionExercise>(session.exercises).map(normalizeExercise),
  }
}

export function migrateBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') throw new Error('Backup file is not valid')
  const data = raw as Record<string, unknown>
  if (data.app != null && data.app !== APP_ID) {
    throw new Error('This file is not an AFI Fitness Tracker backup')
  }
  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0
  if (version > SCHEMA_VERSION) {
    throw new Error(`This backup is from a newer version (v${version})`)
  }
  const settings = data.settings
  if (!settings || typeof settings !== 'object') throw new Error('Backup is missing settings')
  const warmup = data.warmupDefaults
  if (!warmup || typeof warmup !== 'object') throw new Error('Backup is missing warm-up defaults')
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date(0).toISOString(),
    exercises: asArray<Exercise>(data.exercises),
    templates: asArray<WorkoutTemplate>(data.templates),
    templateVersions: asArray<TemplateVersion>(data.templateVersions),
    sessions: asArray<WorkoutSession>(data.sessions).map(normalizeSession),
    progression: asArray<ProgressionState>(data.progression).map((state) => ({
      ...state,
      stage: state.stage ?? 10,
      overrides: state.overrides ?? [],
      workingWeightLb: state.workingWeightLb ?? null,
    })),
    settings: {
      ...(settings as BackupFile['settings']),
      id: 'settings',
      units: 'lb',
      schemaVersion: SCHEMA_VERSION,
    },
    warmupDefaults: warmup as WarmupDefaults,
  }
}
