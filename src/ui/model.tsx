import { createContext } from 'preact'
import { useContext, useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import {
  addExercise,
  appendSet,
  appendWarmupItem,
  createCustomExercise,
  discardWorkout,
  dropExercise,
  dropLastSet,
  finishWorkout,
  reorderExercise,
  saveSessionToTemplate,
  setFeelings,
  setFormOk,
  setNotes,
  setPerSide,
  setRecovery,
  startOrResume,
  substitute,
  toggleWarmupItem,
  updateSet,
  writeNewVersion,
} from '../app/usecases'
import { systemClock } from '../domain/clock'
import { backupFilename, formatHistoryCsv } from '../domain/export'
import type {
  Exercise,
  ProgressionState,
  RecoveryActivity,
  Settings,
  SetPatch,
  TemplateItem,
  TemplateVersion,
  WarmupDefaults,
  WorkoutSession,
  WorkoutTemplate,
} from '../domain/types'
import { DexieRepository } from '../data/dexie-repository'
import { downloadFile, copyText } from './files'
import { applyTheme } from './theme'

export interface ModelState {
  ready: boolean
  error: string | null
  settings: Settings | null
  exercises: Exercise[]
  templates: WorkoutTemplate[]
  versions: TemplateVersion[]
  sessions: WorkoutSession[]
  progression: ProgressionState[]
  warmup: WarmupDefaults | null
  showError: (message: string) => void
  clearError: () => void
  startOrResume: (templateId: string) => Promise<string | null>
  patchSet: (sessionId: string, setId: string, patch: SetPatch) => Promise<void>
  addSet: (sessionId: string, rowId: string) => Promise<void>
  removeSet: (sessionId: string, rowId: string, confirmed: boolean) => Promise<'removed' | 'confirm' | null>
  addExercise: (sessionId: string, exerciseId: string, saveToTemplate: boolean) => Promise<void>
  substitute: (sessionId: string, rowId: string, exerciseId: string, saveToTemplate: boolean) => Promise<void>
  removeExercise: (sessionId: string, rowId: string, confirmed: boolean) => Promise<'removed' | 'confirm' | null>
  moveExercise: (sessionId: string, rowId: string, direction: -1 | 1) => Promise<void>
  setPerSide: (sessionId: string, rowId: string, perSide: boolean) => Promise<void>
  setFormOk: (sessionId: string, rowId: string, formOk: boolean) => Promise<void>
  setNotes: (sessionId: string, notes: string) => Promise<void>
  setFeelings: (sessionId: string, patch: Pick<WorkoutSession, 'energyLevel' | 'jointDiscomfort' | 'moodBefore' | 'moodAfter'>) => Promise<void>
  toggleWarmup: (sessionId: string, itemId: string) => Promise<void>
  addWarmup: (sessionId: string, label: string) => Promise<void>
  setRecovery: (sessionId: string, activity: RecoveryActivity, patch: { done?: boolean; minutes?: number | null }) => Promise<void>
  finish: (sessionId: string) => Promise<boolean>
  discard: (sessionId: string, confirmed: boolean) => Promise<'discarded' | 'confirm' | null>
  saveSessionToTemplate: (sessionId: string) => Promise<void>
  saveTemplateItems: (templateId: string, items: TemplateItem[]) => Promise<void>
  saveExercise: (exercise: Exercise) => Promise<void>
  createCustom: (input: { name: string; equipment: Exercise['equipment']; perSide: boolean; incrementLb: number }) => Promise<string | null>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  saveWarmup: (items: { id: string; label: string }[]) => Promise<void>
  downloadBackup: () => Promise<void>
  downloadCsv: () => Promise<void>
  copy: (text: string) => Promise<boolean>
  restore: (raw: unknown) => Promise<void>
}

const ModelContext = createContext<ModelState | null>(null)

async function requestPersistence(repo: DexieRepository): Promise<void> {
  try {
    if (!navigator.storage?.persist) return
    const already = (await navigator.storage.persisted?.()) ?? false
    const granted = already || (await navigator.storage.persist())
    const settings = await repo.getSettings()
    if (settings.storagePersisted !== granted) {
      await repo.saveSettings({ ...settings, storagePersisted: granted })
    }
  } catch {
    /* persistence is a hint; the log still writes locally */
  }
}

export function ModelProvider({ children }: { children: ComponentChildren }) {
  const repoRef = useRef<DexieRepository | null>(null)
  if (!repoRef.current) repoRef.current = new DexieRepository()
  const queue = useRef(Promise.resolve())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [progression, setProgression] = useState<ProgressionState[]>([])
  const [warmup, setWarmup] = useState<WarmupDefaults | null>(null)

  async function reload(): Promise<void> {
    const repo = repoRef.current
    if (!repo) return
    const [nextSettings, nextExercises, nextTemplates, nextVersions, nextSessions, nextProgression, nextWarmup] =
      await Promise.all([
        repo.getSettings(),
        repo.listExercises(),
        repo.listTemplates(),
        repo.listVersions(),
        repo.listSessions(),
        repo.listProgression(),
        repo.getWarmupDefaults(),
      ])
    applyTheme(nextSettings.theme)
    setSettings(nextSettings)
    setExercises(nextExercises)
    setTemplates(nextTemplates)
    setVersions(nextVersions)
    setSessions(nextSessions)
    setProgression(nextProgression)
    setWarmup(nextWarmup)
    setReady(true)
  }

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const repo = repoRef.current
        if (!repo) return
        await repo.ready()
        await requestPersistence(repo)
        if (!cancel) await reload()
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : 'Could not open the workout log')
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  function enqueue<T>(work: (repo: DexieRepository) => Promise<T>): Promise<T | null> {
    const run = queue.current.then(async () => {
      const repo = repoRef.current
      if (!repo) throw new Error('Storage is not ready')
      const result = await work(repo)
      await reload()
      setError(null)
      return result
    })
    queue.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run.catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      return null
    })
  }

  const model: ModelState = {
    ready,
    error,
    settings,
    exercises,
    templates,
    versions,
    sessions,
    progression,
    warmup,
    showError: (message) => setError(message),
    clearError: () => setError(null),
    startOrResume: (templateId) => enqueue((repo) => startOrResume(repo, templateId, systemClock).then((session) => session.id)),
    patchSet: (sessionId, setId, patch) => enqueue((repo) => updateSet(repo, sessionId, setId, patch, systemClock)).then(() => undefined),
    addSet: (sessionId, rowId) => enqueue((repo) => appendSet(repo, sessionId, rowId, systemClock)).then(() => undefined),
    removeSet: (sessionId, rowId, confirmed) => enqueue((repo) => dropLastSet(repo, sessionId, rowId, confirmed, systemClock)),
    addExercise: (sessionId, exerciseId, saveToTemplate) =>
      enqueue((repo) => addExercise(repo, sessionId, exerciseId, saveToTemplate, systemClock)).then(() => undefined),
    substitute: (sessionId, rowId, exerciseId, saveToTemplate) =>
      enqueue((repo) => substitute(repo, sessionId, rowId, exerciseId, saveToTemplate, systemClock)).then(() => undefined),
    removeExercise: (sessionId, rowId, confirmed) =>
      enqueue((repo) => dropExercise(repo, sessionId, rowId, confirmed, systemClock)),
    moveExercise: (sessionId, rowId, direction) =>
      enqueue((repo) => reorderExercise(repo, sessionId, rowId, direction, systemClock)).then(() => undefined),
    setPerSide: (sessionId, rowId, perSide) =>
      enqueue((repo) => setPerSide(repo, sessionId, rowId, perSide, systemClock)).then(() => undefined),
    setFormOk: (sessionId, rowId, formOk) =>
      enqueue((repo) => setFormOk(repo, sessionId, rowId, formOk, systemClock)).then(() => undefined),
    setNotes: (sessionId, notes) => enqueue((repo) => setNotes(repo, sessionId, notes, systemClock)).then(() => undefined),
    setFeelings: (sessionId, patch) => enqueue((repo) => setFeelings(repo, sessionId, patch, systemClock)).then(() => undefined),
    toggleWarmup: (sessionId, itemId) =>
      enqueue((repo) => toggleWarmupItem(repo, sessionId, itemId, systemClock)).then(() => undefined),
    addWarmup: (sessionId, label) =>
      enqueue((repo) => appendWarmupItem(repo, sessionId, label, systemClock)).then(() => undefined),
    setRecovery: (sessionId, activity, patch) =>
      enqueue((repo) => setRecovery(repo, sessionId, activity, patch, systemClock)).then(() => undefined),
    finish: async (sessionId) => {
      const id = await enqueue((repo) => finishWorkout(repo, sessionId, systemClock).then(() => true))
      return id === true
    },
    discard: (sessionId, confirmed) => enqueue((repo) => discardWorkout(repo, sessionId, confirmed, systemClock)),
    saveSessionToTemplate: (sessionId) =>
      enqueue((repo) => saveSessionToTemplate(repo, sessionId, systemClock)).then(() => undefined),
    saveTemplateItems: (templateId, items) =>
      enqueue(async (repo) => {
        const template = await repo.getTemplate(templateId)
        if (!template) throw new Error('Workout template not found')
        await writeNewVersion(repo, template, items, systemClock)
      }).then(() => undefined),
    saveExercise: (exercise) =>
      enqueue((repo) =>
        repo.saveExercise({
          ...exercise,
          incrementLb: exercise.incrementLb > 0 ? exercise.incrementLb : 5,
          updatedAt: new Date().toISOString(),
        }),
      ).then(() => undefined),
    createCustom: (input) => enqueue((repo) => createCustomExercise(repo, input, systemClock).then((exercise) => exercise.id)),
    saveSettings: (patch) =>
      enqueue(async (repo) => {
        const current = await repo.getSettings()
        const next: Settings = {
          ...current,
          ...patch,
          id: 'settings',
          units: 'lb',
          weeklyGoal: Math.min(14, Math.max(1, patch.weeklyGoal ?? current.weeklyGoal)),
        }
        await repo.saveSettings(next)
        applyTheme(next.theme)
      }).then(() => undefined),
    saveWarmup: (items) =>
      enqueue((repo) => repo.saveWarmupDefaults({ id: 'warmup', items: items.filter((item) => item.label.trim()) })).then(
        () => undefined,
      ),
    downloadBackup: () =>
      enqueue(async (repo) => {
        const exportedAt = new Date().toISOString()
        const backup = await repo.exportAll(exportedAt)
        downloadFile(backupFilename(exportedAt), 'application/json', JSON.stringify(backup, null, 2))
        const current = await repo.getSettings()
        await repo.saveSettings({ ...current, lastBackupAt: exportedAt })
      }).then(() => undefined),
    downloadCsv: () =>
      enqueue(async (repo) => {
        const rows = await repo.listSessions()
        downloadFile('afi-fitness-tracker-history.csv', 'text/csv', formatHistoryCsv(rows))
      }).then(() => undefined),
    copy: async (text) => {
      try {
        await copyText(text)
        return true
      } catch {
        setError('Could not copy. Select the log text instead.')
        return false
      }
    },
    restore: (raw) => enqueue((repo) => repo.importAll(raw)).then(() => undefined),
  }

  return <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
}

export function useModel(): ModelState {
  const model = useContext(ModelContext)
  if (!model) throw new Error('Model missing')
  return model
}
