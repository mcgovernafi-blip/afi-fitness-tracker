/** Copyright (c) 2026 mcgovernafi-blip, owner of this source. All rights reserved. */

export const SCHEMA_VERSION = 1
export const APP_ID = 'afi-fitness-tracker'
export const COPYRIGHT =
  'Copyright (c) 2026 mcgovernafi-blip, owner of this source. All rights reserved.'

export type UUID = string
export type Equipment = 'cable' | 'selectorized' | 'custom'
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
export type Variant = 'A' | 'B' | null
export type SessionStatus = 'in_progress' | 'completed' | 'discarded'
export type ExerciseOrigin = 'template' | 'added' | 'substituted'
export type ExerciseStatus = 'not_started' | 'partial' | 'complete' | 'skipped'
export type Stage = 10 | 11 | 12
export type SuggestionKind = 'hold' | 'advance_reps' | 'increase_weight'
export type Theme = 'system' | 'light' | 'dark'
export type Scale5 = 1 | 2 | 3 | 4 | 5
export type JointLevel = 0 | 1 | 2 | 3
export type RecoveryActivity =
  | 'HydroMassage'
  | 'Massage Chair'
  | 'Pool Walking'
  | 'Swimming'
  | 'Mobility Exercises'
  | 'Stretching'
  | 'Nightly Reset Yoga'

export const RECOVERY_ACTIVITIES: RecoveryActivity[] = [
  'HydroMassage',
  'Massage Chair',
  'Pool Walking',
  'Swimming',
  'Mobility Exercises',
  'Stretching',
  'Nightly Reset Yoga',
]

export interface Exercise {
  id: UUID
  name: string
  equipment: Equipment
  perSide: boolean
  incrementLb: number
  isCustom: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkoutTemplate {
  id: UUID
  name: string
  suggestedDay?: Weekday
  variant: Variant
  currentVersion: number
  createdAt: string
  updatedAt: string
}

export interface TemplateItem {
  exerciseId: UUID
  order: number
  targetSets: number
  targetReps: number
  targetWeightLb: number | null
}

export interface TemplateVersion {
  id: UUID
  templateId: UUID
  version: number
  items: TemplateItem[]
  createdAt: string
}

export interface ChecklistItem {
  id: UUID
  label: string
  done: boolean
}

export interface RecoveryEntry {
  activity: RecoveryActivity
  planned: boolean
  done: boolean
  minutes?: number
  notes?: string
}

export interface JointDiscomfort {
  level: JointLevel
  note?: string
}

export interface P22Suggestion {
  kind: SuggestionKind
  fromWeightLb: number | null
  toWeightLb: number | null
  fromReps: number
  toReps: number
  reason: string
}

export interface ProgressionOverride {
  at: string
  sessionId: UUID
  field: 'weight' | 'reps' | 'sets'
  from: number | null
  to: number | null
}

export interface ProgressionState {
  exerciseId: UUID
  workingWeightLb: number | null
  stage: Stage
  lastQualifyingSessionId?: UUID
  lastEvaluatedAt?: string
  pendingSuggestion?: P22Suggestion
  overrides: ProgressionOverride[]
}

export interface SetEntry {
  id: UUID
  sessionExerciseId: UUID
  index: number
  weightLb: number | null
  reps: number | null
  repsLeft: number | null
  repsRight: number | null
  done: boolean
  /**
   * True after the lifter edits or checks the set.
   * Prefilled targets are not recorded data, so an untouched set can be removed without a prompt.
   */
  touched: boolean
  notes?: string
  completedAt?: string
}

export interface SessionExercise {
  id: UUID
  sessionId: UUID
  order: number
  exerciseId: UUID
  exerciseNameSnapshot: string
  origin: ExerciseOrigin
  substitutedForExerciseId?: UUID
  substitutedForName?: string
  perSide: boolean
  formOk: boolean
  target: { sets: number; reps: number; weightLb: number | null }
  progressionSuggestion?: P22Suggestion
  status: ExerciseStatus
  sets: SetEntry[]
}

export interface WorkoutSession {
  id: UUID
  templateId: UUID
  templateVersionId: UUID
  templateNameSnapshot: string
  date: string
  startedAt: string
  finishedAt?: string
  status: SessionStatus
  warmup: ChecklistItem[]
  recovery: RecoveryEntry[]
  notes: string
  energyLevel?: Scale5
  jointDiscomfort?: JointDiscomfort
  moodBefore?: Scale5
  moodAfter?: Scale5
  schemaVersion: number
  createdAt: string
  updatedAt: string
  deviceId: string
  exercises: SessionExercise[]
}

export interface Settings {
  id: 'settings'
  weeklyGoal: number
  units: 'lb'
  theme: Theme
  lastBackupAt?: string
  storagePersisted: boolean
  deviceId: string
  schemaVersion: number
}

export interface WarmupDefaults {
  id: 'warmup'
  items: { id: UUID; label: string }[]
}

export interface BackupFile {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
  exercises: Exercise[]
  templates: WorkoutTemplate[]
  templateVersions: TemplateVersion[]
  sessions: WorkoutSession[]
  progression: ProgressionState[]
  settings: Settings
  warmupDefaults: WarmupDefaults
}

export interface SetPatch {
  weightLb?: number | null
  reps?: number | null
  repsLeft?: number | null
  repsRight?: number | null
  done?: boolean
  notes?: string
}
