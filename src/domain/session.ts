import type {
  Exercise,
  ExerciseStatus,
  P22Suggestion,
  ProgressionState,
  RecoveryActivity,
  SessionExercise,
  SetEntry,
  SetPatch,
  TemplateItem,
  Variant,
  WorkoutSession,
} from './types'
import { RECOVERY_ACTIVITIES } from './types'
import { repValue } from './project22'

export interface Prefill {
  sets: number
  reps: number
  weightLb: number | null
  suggestion?: P22Suggestion
}

export function prefillFor(
  progression: ProgressionState | undefined,
  templateItem?: TemplateItem,
): Prefill {
  return {
    sets: templateItem?.targetSets && templateItem.targetSets > 0 ? templateItem.targetSets : 2,
    reps: progression?.stage ?? templateItem?.targetReps ?? 10,
    weightLb: progression?.workingWeightLb ?? templateItem?.targetWeightLb ?? null,
    suggestion: progression?.pendingSuggestion,
  }
}

export function statusOf(sets: SetEntry[]): ExerciseStatus {
  if (sets.length === 0 || sets.every((set) => !set.done)) return 'not_started'
  if (sets.every((set) => set.done)) return 'complete'
  return 'partial'
}

export function setHasRecordedData(set: SetEntry): boolean {
  return set.touched || set.done || Boolean(set.notes && set.notes.trim())
}

export function sessionHasRecordedData(session: WorkoutSession): boolean {
  if (session.notes.trim()) return true
  if (session.energyLevel || session.jointDiscomfort || session.moodBefore || session.moodAfter) return true
  if (session.warmup.some((item) => item.done)) return true
  if (session.recovery.some((entry) => entry.done)) return true
  return session.exercises.some((exercise) => exercise.sets.some(setHasRecordedData))
}

export function plannedRecovery(variant: Variant | undefined): WorkoutSession['recovery'] {
  return RECOVERY_ACTIVITIES.map((activity) => ({
    activity,
    planned: activity === 'HydroMassage' || (activity === 'Massage Chair' && variant === 'B'),
    done: false,
  }))
}

export function assertEditable(session: WorkoutSession): void {
  if (session.status !== 'in_progress') {
    throw new Error('Finished sessions are immutable')
  }
}

function refresh(session: WorkoutSession, nowIso: string, exercises = session.exercises): WorkoutSession {
  return {
    ...session,
    updatedAt: nowIso,
    exercises: exercises.map((exercise) => ({ ...exercise, status: statusOf(exercise.sets) })),
  }
}

export function makeSets(sessionExerciseId: string, prefill: Prefill, perSide: boolean, ids: string[]): SetEntry[] {
  return ids.map((id, index) => ({
    id,
    sessionExerciseId,
    index: index + 1,
    weightLb: prefill.weightLb,
    reps: perSide ? null : prefill.reps,
    repsLeft: perSide ? prefill.reps : null,
    repsRight: perSide ? prefill.reps : null,
    done: false,
    touched: false,
  }))
}

export function makeSessionExercise(input: {
  id: string
  sessionId: string
  order: number
  exercise: Exercise
  origin: SessionExercise['origin']
  prefill: Prefill
  setIds: string[]
  substitutedForExerciseId?: string
  substitutedForName?: string
}): SessionExercise {
  return {
    id: input.id,
    sessionId: input.sessionId,
    order: input.order,
    exerciseId: input.exercise.id,
    exerciseNameSnapshot: input.exercise.name,
    origin: input.origin,
    substitutedForExerciseId: input.substitutedForExerciseId,
    substitutedForName: input.substitutedForName,
    perSide: input.exercise.perSide,
    formOk: true,
    target: {
      sets: input.prefill.sets,
      reps: input.prefill.reps,
      weightLb: input.prefill.weightLb,
    },
    progressionSuggestion: input.prefill.suggestion,
    status: 'not_started',
    sets: makeSets(input.id, input.prefill, input.exercise.perSide, input.setIds),
  }
}

export function patchSet(session: WorkoutSession, setId: string, patch: SetPatch, nowIso: string): WorkoutSession {
  assertEditable(session)
  let found = false
  const exercises = session.exercises.map((exercise) => {
    const sets = exercise.sets.map((set) => {
      if (set.id !== setId) return set
      found = true
      const next: SetEntry = {
        ...set,
        ...patch,
        touched: true,
      }
      if (patch.done === true) next.completedAt = nowIso
      if (patch.done === false) delete next.completedAt
      if (patch.notes !== undefined && patch.notes.trim() === '') delete next.notes
      return next
    })
    return { ...exercise, sets }
  })
  if (!found) throw new Error('Set not found')
  return refresh(session, nowIso, exercises)
}

export function addSet(session: WorkoutSession, rowId: string, setId: string, nowIso: string): WorkoutSession {
  assertEditable(session)
  let found = false
  const exercises = session.exercises.map((exercise) => {
    if (exercise.id !== rowId) return exercise
    found = true
    const last = exercise.sets[exercise.sets.length - 1]
    const prefill: Prefill = {
      sets: 1,
      reps: exercise.target.reps,
      weightLb: last?.weightLb ?? exercise.target.weightLb,
    }
    const [created] = makeSets(exercise.id, prefill, exercise.perSide, [setId])
    if (last && exercise.perSide) {
      created.repsLeft = last.repsLeft
      created.repsRight = last.repsRight
    } else if (last && !exercise.perSide) {
      created.reps = last.reps
    }
    created.weightLb = last?.weightLb ?? exercise.target.weightLb
    created.touched = false
    created.done = false
    return { ...exercise, sets: [...exercise.sets, { ...created, index: exercise.sets.length + 1 }] }
  })
  if (!found) throw new Error('Exercise not found')
  return refresh(session, nowIso, exercises)
}

export function removeLastSet(
  session: WorkoutSession,
  rowId: string,
  confirmed: boolean,
  nowIso: string,
): { session: WorkoutSession; needsConfirm: boolean } {
  assertEditable(session)
  const exercise = session.exercises.find((row) => row.id === rowId)
  if (!exercise || exercise.sets.length === 0) return { session, needsConfirm: false }
  const last = exercise.sets[exercise.sets.length - 1]
  if (setHasRecordedData(last) && !confirmed) return { session, needsConfirm: true }
  const exercises = session.exercises.map((row) => {
    if (row.id !== rowId) return row
    const sets = row.sets.slice(0, -1).map((set, index) => ({ ...set, index: index + 1 }))
    return { ...row, sets }
  })
  return { session: refresh(session, nowIso, exercises), needsConfirm: false }
}

export function addExerciseRow(session: WorkoutSession, row: SessionExercise, nowIso: string): WorkoutSession {
  assertEditable(session)
  const order = session.exercises.length + 1
  return refresh(session, nowIso, [...session.exercises, { ...row, order, sessionId: session.id }])
}

export function substituteExercise(
  session: WorkoutSession,
  rowId: string,
  exercise: Exercise,
  prefill: Prefill,
  nowIso: string,
): WorkoutSession {
  assertEditable(session)
  let found = false
  const exercises = session.exercises.map((row) => {
    if (row.id !== rowId) return row
    found = true
    const sets = row.sets.map((set) => {
      if (set.touched || set.done) {
        return convertSetSide(set, exercise.perSide)
      }
      const [fresh] = makeSets(row.id, prefill, exercise.perSide, [set.id])
      return { ...fresh, index: set.index }
    })
    return {
      ...row,
      exerciseId: exercise.id,
      exerciseNameSnapshot: exercise.name,
      origin: 'substituted' as const,
      substitutedForExerciseId: row.substitutedForExerciseId ?? row.exerciseId,
      substitutedForName: row.substitutedForName ?? row.exerciseNameSnapshot,
      perSide: exercise.perSide,
      target: { sets: row.target.sets, reps: prefill.reps, weightLb: prefill.weightLb },
      progressionSuggestion: prefill.suggestion,
      sets,
    }
  })
  if (!found) throw new Error('Exercise not found')
  return refresh(session, nowIso, exercises)
}

function convertSetSide(set: SetEntry, perSide: boolean): SetEntry {
  if (perSide) {
    const reps = set.reps
    return {
      ...set,
      reps: null,
      repsLeft: set.repsLeft ?? reps,
      repsRight: set.repsRight ?? reps,
    }
  }
  const reps =
    set.reps ??
    (set.repsLeft != null && set.repsRight != null
      ? Math.min(set.repsLeft, set.repsRight)
      : (set.repsLeft ?? set.repsRight))
  return { ...set, reps, repsLeft: null, repsRight: null }
}

export function withPerSide(
  session: WorkoutSession,
  rowId: string,
  perSide: boolean,
  nowIso: string,
): WorkoutSession {
  assertEditable(session)
  const exercises = session.exercises.map((row) => {
    if (row.id !== rowId || row.perSide === perSide) return row
    return {
      ...row,
      perSide,
      sets: row.sets.map((set) => convertSetSide(set, perSide)),
    }
  })
  return refresh(session, nowIso, exercises)
}

export function withFormOk(session: WorkoutSession, rowId: string, formOk: boolean, nowIso: string): WorkoutSession {
  assertEditable(session)
  const exercises = session.exercises.map((row) => (row.id === rowId ? { ...row, formOk } : row))
  return refresh(session, nowIso, exercises)
}

export function moveExercise(
  session: WorkoutSession,
  rowId: string,
  direction: -1 | 1,
  nowIso: string,
): WorkoutSession {
  assertEditable(session)
  const rows = [...session.exercises].sort((a, b) => a.order - b.order)
  const index = rows.findIndex((row) => row.id === rowId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= rows.length) return session
  const current = rows[index]
  rows[index] = rows[target]
  rows[target] = current
  const exercises = rows.map((row, order) => ({ ...row, order: order + 1 }))
  return refresh(session, nowIso, exercises)
}

export function removeExercise(
  session: WorkoutSession,
  rowId: string,
  confirmed: boolean,
  nowIso: string,
): { session: WorkoutSession; needsConfirm: boolean } {
  assertEditable(session)
  const row = session.exercises.find((exercise) => exercise.id === rowId)
  if (!row) return { session, needsConfirm: false }
  if (row.sets.some(setHasRecordedData) && !confirmed) return { session, needsConfirm: true }
  const exercises = session.exercises
    .filter((exercise) => exercise.id !== rowId)
    .sort((a, b) => a.order - b.order)
    .map((exercise, index) => ({ ...exercise, order: index + 1 }))
  return { session: refresh(session, nowIso, exercises), needsConfirm: false }
}

export function withNotes(session: WorkoutSession, notes: string, nowIso: string): WorkoutSession {
  assertEditable(session)
  return refresh({ ...session, notes }, nowIso)
}

export function withFeelings(
  session: WorkoutSession,
  patch: Pick<WorkoutSession, 'energyLevel' | 'jointDiscomfort' | 'moodBefore' | 'moodAfter'>,
  nowIso: string,
): WorkoutSession {
  assertEditable(session)
  return refresh({ ...session, ...patch }, nowIso)
}

export function toggleWarmup(session: WorkoutSession, itemId: string, nowIso: string): WorkoutSession {
  assertEditable(session)
  return refresh(
    {
      ...session,
      warmup: session.warmup.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    },
    nowIso,
  )
}

export function addWarmupItem(session: WorkoutSession, itemId: string, label: string, nowIso: string): WorkoutSession {
  assertEditable(session)
  const trimmed = label.trim()
  if (!trimmed) return session
  return refresh(
    { ...session, warmup: [...session.warmup, { id: itemId, label: trimmed, done: false }] },
    nowIso,
  )
}

export function withRecovery(
  session: WorkoutSession,
  activity: RecoveryActivity,
  patch: { done?: boolean; minutes?: number | null },
  nowIso: string,
): WorkoutSession {
  assertEditable(session)
  return refresh(
    {
      ...session,
      recovery: session.recovery.map((entry) => {
        if (entry.activity !== activity) return entry
        const next = { ...entry }
        if (patch.done !== undefined) next.done = patch.done
        if (patch.minutes === null) delete next.minutes
        else if (patch.minutes !== undefined) next.minutes = patch.minutes
        return next
      }),
    },
    nowIso,
  )
}

export function completeSession(session: WorkoutSession, nowIso: string): WorkoutSession {
  assertEditable(session)
  const finished = refresh(session, nowIso)
  return { ...finished, status: 'completed', finishedAt: nowIso }
}

export function discardSession(session: WorkoutSession, nowIso: string): WorkoutSession {
  assertEditable(session)
  const discarded = refresh(session, nowIso)
  return { ...discarded, status: 'discarded' }
}

export function templateItemsFromSession(session: WorkoutSession): TemplateItem[] {
  return [...session.exercises]
    .sort((a, b) => a.order - b.order)
    .map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      order: index + 1,
      targetSets: exercise.sets.length > 0 ? exercise.sets.length : exercise.target.sets,
      targetReps: exercise.target.reps,
      targetWeightLb: exercise.target.weightLb,
    }))
}

export function collectRepOverride(exercise: SessionExercise): { from: number; to: number | null } | null {
  const values = exercise.sets
    .filter((set) => set.done)
    .map((set) => repValue(set, exercise.perSide))
    .filter((value): value is number => value != null)
  if (values.length === 0) return null
  if (values.every((value) => value === exercise.target.reps)) return null
  return { from: exercise.target.reps, to: values[0] }
}
