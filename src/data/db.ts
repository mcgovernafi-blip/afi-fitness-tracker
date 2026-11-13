import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  ProgressionState,
  Settings,
  TemplateVersion,
  WarmupDefaults,
  WorkoutSession,
  WorkoutTemplate,
} from '../domain/types'

export class AfiDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  templates!: EntityTable<WorkoutTemplate, 'id'>
  templateVersions!: EntityTable<TemplateVersion, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  progression!: EntityTable<ProgressionState, 'exerciseId'>
  settings!: EntityTable<Settings, 'id'>
  warmup!: EntityTable<WarmupDefaults, 'id'>

  constructor(name = 'afi-fitness-tracker') {
    super(name)
    this.version(1).stores({
      exercises: 'id, name, archived',
      templates: 'id, name',
      templateVersions: 'id, templateId, version',
      sessions: 'id, templateId, date, status',
      progression: 'exerciseId',
      settings: 'id',
      warmup: 'id',
    })
  }
}

export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
