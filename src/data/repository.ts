import type { Clock } from '../domain/clock'
import type {
  BackupFile,
  Exercise,
  ProgressionState,
  Settings,
  TemplateVersion,
  WarmupDefaults,
  WorkoutSession,
  WorkoutTemplate,
} from '../domain/types'

export interface Repository {
  ready(clock?: Clock): Promise<void>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
  listExercises(): Promise<Exercise[]>
  getExercise(id: string): Promise<Exercise | undefined>
  saveExercise(exercise: Exercise): Promise<void>
  listTemplates(): Promise<WorkoutTemplate[]>
  getTemplate(id: string): Promise<WorkoutTemplate | undefined>
  saveTemplate(template: WorkoutTemplate): Promise<void>
  listVersions(templateId?: string): Promise<TemplateVersion[]>
  getVersion(id: string): Promise<TemplateVersion | undefined>
  saveVersion(version: TemplateVersion): Promise<void>
  listSessions(): Promise<WorkoutSession[]>
  getSession(id: string): Promise<WorkoutSession | undefined>
  saveSession(session: WorkoutSession): Promise<void>
  getProgression(exerciseId: string): Promise<ProgressionState | undefined>
  listProgression(): Promise<ProgressionState[]>
  saveProgression(state: ProgressionState): Promise<void>
  getWarmupDefaults(): Promise<WarmupDefaults>
  saveWarmupDefaults(warmup: WarmupDefaults): Promise<void>
  exportAll(exportedAt: string): Promise<BackupFile>
  importAll(raw: unknown): Promise<void>
}
