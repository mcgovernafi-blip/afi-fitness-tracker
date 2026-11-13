import type { Clock } from './clock'
import type { Equipment, Exercise, TemplateVersion, Variant, WarmupDefaults, Weekday, WorkoutTemplate } from './types'
import { SCHEMA_VERSION } from './types'
import type { Repository } from '../data/repository'

export const MACHINE_NAMES = [
  'Seated Row',
  'Lat Pulldown',
  'Chest Press',
  'Incline Chest Press',
  'Pec Fly',
  'Rear Delt Fly',
  'Shoulder Press',
  'Lateral Raise',
  'Biceps Curl',
  'Triceps Extension',
  'Cable Triceps Pushdown',
  'Assisted Dip',
  'Seated Leg Press',
  'Leg Extension',
  'Seated Leg Curl',
  'Hip Abduction',
  'Hip Adduction',
  'Rotary Torso',
  'Abdominal Crunch',
  'Back Extension',
  'Cable Pallof Press',
] as const

const CABLE = new Set<string>(['Seated Row', 'Cable Triceps Pushdown', 'Cable Pallof Press'])

export const TEMPLATE_SEEDS: {
  id: string
  name: string
  suggestedDay: Weekday
  variant: Variant
}[] = [
  { id: 'tpl-back-biceps-a', name: 'Back & Biceps A', suggestedDay: 'Mon', variant: 'A' },
  { id: 'tpl-chest-triceps-a', name: 'Chest & Triceps A', suggestedDay: 'Tue', variant: 'A' },
  { id: 'tpl-back-biceps-b', name: 'Back & Biceps B', suggestedDay: 'Wed', variant: 'B' },
  { id: 'tpl-chest-triceps-b', name: 'Chest & Triceps B', suggestedDay: 'Thu', variant: 'B' },
  { id: 'tpl-legs', name: 'Legs & Stretching', suggestedDay: 'Fri', variant: null },
]

export const DEFAULT_WARMUP = [
  { id: 'wu-cardio', label: 'Easy cardio' },
  { id: 'wu-mobility', label: 'Joint mobility' },
  { id: 'wu-light-set', label: 'Light warm-up set' },
]

export function slugId(prefix: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${prefix}-${slug}`
}

export function catalogExercise(name: string, nowIso: string): Exercise {
  const equipment: Equipment = CABLE.has(name) ? 'cable' : 'selectorized'
  return {
    id: slugId('ex', name),
    name,
    equipment,
    perSide: name === 'Rotary Torso',
    incrementLb: 5,
    isCustom: false,
    archived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export async function seedDatabase(repo: Repository, clock: Clock): Promise<void> {
  const nowIso = clock.now().toISOString()
  for (const name of MACHINE_NAMES) {
    await repo.saveExercise(catalogExercise(name, nowIso))
  }
  for (const templateSeed of TEMPLATE_SEEDS) {
    const createdAt = clock.now().toISOString()
    const template: WorkoutTemplate = {
      id: templateSeed.id,
      name: templateSeed.name,
      suggestedDay: templateSeed.suggestedDay,
      variant: templateSeed.variant,
      currentVersion: 1,
      createdAt,
      updatedAt: createdAt,
    }
    const version: TemplateVersion = {
      id: `${templateSeed.id}-v1`,
      templateId: template.id,
      version: 1,
      items: [],
      createdAt,
    }
    await repo.saveTemplate(template)
    await repo.saveVersion(version)
  }
  const settingsId = clock.id()
  await repo.saveSettings({
    id: 'settings',
    weeklyGoal: 3,
    units: 'lb',
    theme: 'system',
    storagePersisted: false,
    deviceId: settingsId,
    schemaVersion: SCHEMA_VERSION,
  })
  const warmup: WarmupDefaults = { id: 'warmup', items: DEFAULT_WARMUP.map((item) => ({ ...item })) }
  await repo.saveWarmupDefaults(warmup)
}
