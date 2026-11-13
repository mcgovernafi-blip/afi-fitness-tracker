import type { Clock } from '../domain/clock'
import { evaluateProject22, freshProgression, repValue } from '../domain/project22'
import {
  addExerciseRow,
  addSet,
  addWarmupItem,
  completeSession,
  discardSession,
  makeSessionExercise,
  moveExercise,
  patchSet,
  plannedRecovery,
  prefillFor,
  removeExercise,
  removeLastSet,
  sessionHasRecordedData,
  substituteExercise,
  templateItemsFromSession,
  toggleWarmup,
  withFeelings,
  withFormOk,
  withNotes,
  withPerSide,
  withRecovery,
} from '../domain/session'
import { localDate, weekBounds } from '../domain/dates'
import { SCHEMA_VERSION, type Exercise, type RecoveryActivity, type SetPatch, type TemplateItem, type TemplateVersion, type WorkoutSession, type WorkoutTemplate } from '../domain/types'
import type { Repository } from '../data/repository'

async function mustSession(repo: Repository, sessionId: string): Promise<WorkoutSession> {
  const session = await repo.getSession(sessionId)
  if (!session) throw new Error('Workout not found')
  return session
}

async function mustTemplate(repo: Repository, templateId: string): Promise<WorkoutTemplate> {
  const template = await repo.getTemplate(templateId)
  if (!template) throw new Error('Workout template not found')
  return template
}

export async function currentVersion(repo: Repository, template: WorkoutTemplate): Promise<TemplateVersion> {
  const versions = await repo.listVersions(template.id)
  const version = versions.find((item) => item.version === template.currentVersion)
  if (!version) throw new Error(`Template ${template.name} is missing its current version`)
  return version
}

export async function writeNewVersion(
  repo: Repository,
  template: WorkoutTemplate,
  items: TemplateItem[],
  clock: Clock,
): Promise<TemplateVersion> {
  const nowIso = clock.now().toISOString()
  const version: TemplateVersion = {
    id: clock.id(),
    templateId: template.id,
    version: template.currentVersion + 1,
    items: items.map((item, index) => ({ ...item, order: index + 1 })),
    createdAt: nowIso,
  }
  await repo.saveVersion(version)
  await repo.saveTemplate({ ...template, currentVersion: version.version, updatedAt: nowIso })
  return version
}

export async function startOrResume(repo: Repository, templateId: string, clock: Clock): Promise<WorkoutSession> {
  const existing = (await repo.listSessions()).find(
    (session) => session.status === 'in_progress' && session.templateId === templateId,
  )
  if (existing) return existing
  const template = await mustTemplate(repo, templateId)
  const version = await currentVersion(repo, template)
  const settings = await repo.getSettings()
  const warmupDefaults = await repo.getWarmupDefaults()
  const now = clock.now()
  const nowIso = now.toISOString()
  const sessionId = clock.id()
  const exercises = []
  const items = [...version.items].sort((a, b) => a.order - b.order)
  for (const item of items) {
    const exercise = await repo.getExercise(item.exerciseId)
    if (!exercise) continue
    const progression = await repo.getProgression(exercise.id)
    const prefill = prefillFor(progression, item)
    const rowId = clock.id()
    const setIds = Array.from({ length: prefill.sets }, () => clock.id())
    exercises.push(
      makeSessionExercise({
        id: rowId,
        sessionId,
        order: exercises.length + 1,
        exercise,
        origin: 'template',
        prefill,
        setIds,
      }),
    )
  }
  const session: WorkoutSession = {
    id: sessionId,
    templateId: template.id,
    templateVersionId: version.id,
    templateNameSnapshot: template.name,
    date: localDate(now),
    startedAt: nowIso,
    status: 'in_progress',
    warmup: warmupDefaults.items.map((item) => ({ id: clock.id(), label: item.label, done: false })),
    recovery: plannedRecovery(template.variant),
    notes: '',
    schemaVersion: SCHEMA_VERSION,
    createdAt: nowIso,
    updatedAt: nowIso,
    deviceId: settings.deviceId,
    exercises,
  }
  await repo.saveSession(session)
  return session
}

async function saveChanged(repo: Repository, session: WorkoutSession): Promise<WorkoutSession> {
  await repo.saveSession(session)
  return session
}

export async function updateSet(repo: Repository, sessionId: string, setId: string, patch: SetPatch, clock: Clock) {
  const session = await mustSession(repo, sessionId)
  return saveChanged(repo, patchSet(session, setId, patch, clock.now().toISOString()))
}

export async function appendSet(repo: Repository, sessionId: string, rowId: string, clock: Clock) {
  const session = await mustSession(repo, sessionId)
  return saveChanged(repo, addSet(session, rowId, clock.id(), clock.now().toISOString()))
}

export async function dropLastSet(
  repo: Repository,
  sessionId: string,
  rowId: string,
  confirmed: boolean,
  clock: Clock,
): Promise<'removed' | 'confirm'> {
  const session = await mustSession(repo, sessionId)
  const result = removeLastSet(session, rowId, confirmed, clock.now().toISOString())
  if (result.needsConfirm) return 'confirm'
  await repo.saveSession(result.session)
  return 'removed'
}

export async function addExercise(
  repo: Repository,
  sessionId: string,
  exerciseId: string,
  saveToTemplate: boolean,
  clock: Clock,
): Promise<void> {
  const session = await mustSession(repo, sessionId)
  const exercise = await repo.getExercise(exerciseId)
  if (!exercise) throw new Error('Exercise not found')
  const progression = await repo.getProgression(exercise.id)
  const prefill = prefillFor(progression)
  const rowId = clock.id()
  const setIds = Array.from({ length: prefill.sets }, () => clock.id())
  const row = makeSessionExercise({
    id: rowId,
    sessionId: session.id,
    order: session.exercises.length + 1,
    exercise,
    origin: 'added',
    prefill,
    setIds,
  })
  await repo.saveSession(addExerciseRow(session, row, clock.now().toISOString()))
  if (saveToTemplate) {
    const template = await mustTemplate(repo, session.templateId)
    const version = await currentVersion(repo, template)
    await writeNewVersion(
      repo,
      template,
      [
        ...version.items,
        {
          exerciseId: exercise.id,
          order: version.items.length + 1,
          targetSets: prefill.sets,
          targetReps: prefill.reps,
          targetWeightLb: prefill.weightLb,
        },
      ],
      clock,
    )
  }
}

export async function substitute(
  repo: Repository,
  sessionId: string,
  rowId: string,
  exerciseId: string,
  saveToTemplate: boolean,
  clock: Clock,
): Promise<void> {
  const session = await mustSession(repo, sessionId)
  const exercise = await repo.getExercise(exerciseId)
  if (!exercise) throw new Error('Exercise not found')
  const row = session.exercises.find((item) => item.id === rowId)
  if (!row) throw new Error('Exercise not found')
  const progression = await repo.getProgression(exercise.id)
  const prefill = prefillFor(progression)
  const nowIso = clock.now().toISOString()
  await repo.saveSession(substituteExercise(session, rowId, exercise, prefill, nowIso))
  if (!saveToTemplate) return
  const template = await mustTemplate(repo, session.templateId)
  const version = await currentVersion(repo, template)
  const key = row.substitutedForExerciseId ?? row.exerciseId
  const items = version.items.map((item) => ({ ...item }))
  const index = items.findIndex((item) => item.exerciseId === key || item.exerciseId === row.exerciseId)
  if (index >= 0) items[index] = { ...items[index], exerciseId: exercise.id }
  else {
    items.push({
      exerciseId: exercise.id,
      order: items.length + 1,
      targetSets: 2,
      targetReps: prefill.reps,
      targetWeightLb: prefill.weightLb,
    })
  }
  await writeNewVersion(repo, template, items, clock)
}

export async function dropExercise(
  repo: Repository,
  sessionId: string,
  rowId: string,
  confirmed: boolean,
  clock: Clock,
): Promise<'removed' | 'confirm'> {
  const session = await mustSession(repo, sessionId)
  const result = removeExercise(session, rowId, confirmed, clock.now().toISOString())
  if (result.needsConfirm) return 'confirm'
  await repo.saveSession(result.session)
  return 'removed'
}

export async function reorderExercise(
  repo: Repository,
  sessionId: string,
  rowId: string,
  direction: -1 | 1,
  clock: Clock,
) {
  const session = await mustSession(repo, sessionId)
  await repo.saveSession(moveExercise(session, rowId, direction, clock.now().toISOString()))
}

export async function setPerSide(repo: Repository, sessionId: string, rowId: string, perSide: boolean, clock: Clock) {
  const session = await mustSession(repo, sessionId)
  const row = session.exercises.find((exercise) => exercise.id === rowId)
  await repo.saveSession(withPerSide(session, rowId, perSide, clock.now().toISOString()))
  if (!row) return
  const exercise = await repo.getExercise(row.exerciseId)
  if (!exercise) return
  const nowIso = clock.now().toISOString()
  await repo.saveExercise({ ...exercise, perSide, updatedAt: nowIso })
}

export async function setFormOk(repo: Repository, sessionId: string, rowId: string, formOk: boolean, clock: Clock) {
  const session = await mustSession(repo, sessionId)
  await repo.saveSession(withFormOk(session, rowId, formOk, clock.now().toISOString()))
}

export async function setNotes(repo: Repository, sessionId: string, notes: string, clock: Clock) {
  const session = await mustSession(repo, sessionId)
  await repo.saveSession(withNotes(session, notes, clock.now().toISOString()))
}

export async function setFeelings(
  repo: Repository,
  sessionId: string,
  patch: Pick<WorkoutSession, 'energyLevel' | 'jointDiscomfort' | 'moodBefore' | 'moodAfter'>,
  clock: Clock,
) {
  const session = await mustSession(repo, sessionId)
  await repo.saveSession(withFeelings(session, patch, clock.now().toISOString()))
}

export async function toggleWarmupItem(repo: Repository, sessionId: string, itemId: string, clock: Clock) {
  const session = await mustSession(repo, sessionId)
  await repo.saveSession(toggleWarmup(session, itemId, clock.now().toISOString()))
}

export async function appendWarmupItem(repo: Repository, sessionId: string, label: string, clock: Clock) {
  const session = await mustSession(repo, sessionId)
  await repo.saveSession(addWarmupItem(session, clock.id(), label, clock.now().toISOString()))
}

export async function setRecovery(
  repo: Repository,
  sessionId: string,
  activity: RecoveryActivity,
  patch: { done?: boolean; minutes?: number | null },
  clock: Clock,
) {
  const session = await mustSession(repo, sessionId)
  await repo.saveSession(withRecovery(session, activity, patch, clock.now().toISOString()))
}

export async function finishWorkout(repo: Repository, sessionId: string, clock: Clock): Promise<WorkoutSession> {
  const session = await mustSession(repo, sessionId)
  const nowIso = clock.now().toISOString()
  const finished = completeSession(session, nowIso)
  await repo.saveSession(finished)
  await applyProgression(repo, finished, nowIso)
  return finished
}

async function applyProgression(repo: Repository, session: WorkoutSession, nowIso: string): Promise<void> {
  const seen = new Set<string>()
  for (const row of [...session.exercises].sort((a, b) => a.order - b.order)) {
    if (seen.has(row.exerciseId)) continue
    seen.add(row.exerciseId)
    const exercise = await repo.getExercise(row.exerciseId)
    const previous = (await repo.getProgression(row.exerciseId)) ?? freshProgression(row.exerciseId)
    const evaluation = evaluateProject22({
      sets: row.sets,
      perSide: row.perSide,
      workingWeightLb: previous.workingWeightLb,
      stage: previous.stage,
      formOk: row.formOk,
      incrementLb: exercise?.incrementLb ?? 5,
    })
    const overrides = [...previous.overrides]
    if (evaluation.weightOverride) {
      overrides.push({
        at: nowIso,
        sessionId: session.id,
        field: 'weight',
        from: evaluation.weightOverride.from,
        to: evaluation.weightOverride.to,
      })
    }
    const doneReps = row.sets
      .filter((set) => set.done)
      .map((set) => repValue(set, row.perSide))
      .filter((value): value is number => value != null)
    if (doneReps.length > 0 && doneReps.some((value) => value !== previous.stage)) {
      overrides.push({
        at: nowIso,
        sessionId: session.id,
        field: 'reps',
        from: previous.stage,
        to: doneReps[0],
      })
    }
    if (row.sets.length !== row.target.sets) {
      overrides.push({
        at: nowIso,
        sessionId: session.id,
        field: 'sets',
        from: row.target.sets,
        to: row.sets.length,
      })
    }
    await repo.saveProgression({
      exerciseId: row.exerciseId,
      workingWeightLb: evaluation.nextWeightLb,
      stage: evaluation.nextStage,
      lastQualifyingSessionId: evaluation.qualified ? session.id : previous.lastQualifyingSessionId,
      lastEvaluatedAt: nowIso,
      pendingSuggestion: evaluation.suggestion,
      overrides,
    })
  }
}

export async function discardWorkout(
  repo: Repository,
  sessionId: string,
  confirmed: boolean,
  clock: Clock,
): Promise<'discarded' | 'confirm'> {
  const session = await mustSession(repo, sessionId)
  if (sessionHasRecordedData(session) && !confirmed) return 'confirm'
  await repo.saveSession(discardSession(session, clock.now().toISOString()))
  return 'discarded'
}

export async function saveSessionToTemplate(repo: Repository, sessionId: string, clock: Clock): Promise<void> {
  const session = await mustSession(repo, sessionId)
  const template = await mustTemplate(repo, session.templateId)
  await writeNewVersion(repo, template, templateItemsFromSession(session), clock)
}

export function visitsThisWeek(sessions: WorkoutSession[], today: Date): number {
  const bounds = weekBounds(today)
  return sessions.filter(
    (session) => session.status === 'completed' && session.date >= bounds.start && session.date <= bounds.end,
  ).length
}

export async function createCustomExercise(
  repo: Repository,
  input: { name: string; equipment: Exercise['equipment']; perSide: boolean; incrementLb: number },
  clock: Clock,
): Promise<Exercise> {
  const name = input.name.trim()
  if (!name) throw new Error('Name the exercise')
  const nowIso = clock.now().toISOString()
  const exercise: Exercise = {
    id: clock.id(),
    name,
    equipment: input.equipment,
    perSide: input.perSide,
    incrementLb: input.incrementLb > 0 ? input.incrementLb : 5,
    isCustom: true,
    archived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  await repo.saveExercise(exercise)
  return exercise
}

export function inProgressFor(sessions: WorkoutSession[], templateId: string): WorkoutSession | undefined {
  return sessions
    .filter((session) => session.status === 'in_progress' && session.templateId === templateId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

export function latestInProgress(sessions: WorkoutSession[]): WorkoutSession | undefined {
  return sessions
    .filter((session) => session.status === 'in_progress')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}
