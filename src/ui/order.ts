import type { Exercise, WorkoutSession } from '../domain/types'

export const WORKOUT_ORDER = [
  'Back & Biceps A',
  'Chest & Triceps A',
  'Back & Biceps B',
  'Chest & Triceps B',
  'Legs & Stretching',
]

export function byWorkoutOrder<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = WORKOUT_ORDER.indexOf(a.name)
    const bi = WORKOUT_ORDER.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

export function equipmentLabel(equipment: Exercise['equipment']): string {
  if (equipment === 'cable') return 'cable'
  if (equipment === 'selectorized') return 'stack'
  return 'custom'
}

export function recentExercises(sessions: WorkoutSession[], exercises: Exercise[]): Exercise[] {
  const ids: string[] = []
  const ordered = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  for (const session of ordered) {
    for (const row of [...session.exercises].sort((a, b) => a.order - b.order)) {
      if (!ids.includes(row.exerciseId)) ids.push(row.exerciseId)
    }
  }
  return ids
    .map((id) => exercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise && !exercise.archived))
    .slice(0, 5)
}

export function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt))
}
