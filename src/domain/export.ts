import type { BackupFile, SessionExercise, SetEntry, WorkoutSession } from './types'
import { durationMinutes, formatClock, formatWeekdayMonthDay } from './dates'

function formatTimeRange(startedAt: string, finishedAt: string | undefined, timeZone?: string): string {
  const start = formatClock(startedAt, timeZone)
  if (!finishedAt) return start
  const end = formatClock(finishedAt, timeZone)
  const startPeriod = start.slice(-2)
  const endPeriod = end.slice(-2)
  if (startPeriod === endPeriod) return `${start.slice(0, -3)}–${end}`
  return `${start}–${end}`
}

export function formatSetToken(set: SetEntry, perSide: boolean): string {
  const weight = set.weightLb == null ? '—' : String(set.weightLb)
  const reps = perSide
    ? `L${set.repsLeft ?? '—'}/R${set.repsRight ?? '—'}`
    : set.reps == null
      ? '—'
      : String(set.reps)
  return `${weight}×${reps}${set.done ? ' ✓' : ''}`
}

export function exerciseLabel(exercise: SessionExercise): string {
  if (exercise.origin === 'substituted' && exercise.substitutedForName) {
    return `${exercise.exerciseNameSnapshot} (sub for ${exercise.substitutedForName})`
  }
  if (exercise.origin === 'added') return `${exercise.exerciseNameSnapshot} (added)`
  return exercise.exerciseNameSnapshot
}

export function formatExerciseLine(exercise: SessionExercise): string {
  const sets = [...exercise.sets].sort((a, b) => a.index - b.index).map((set) => formatSetToken(set, exercise.perSide))
  return `${exercise.order}. ${exerciseLabel(exercise)}: ${sets.join(', ')}`
}

export function formatWorkoutText(session: WorkoutSession, timeZone?: string): string {
  const date = formatWeekdayMonthDay(session.date)
  const when = `${date}, ${formatTimeRange(session.startedAt, session.finishedAt, timeZone)}`
  const lines = [`AFI Fitness Tracker — ${session.templateNameSnapshot} — ${when}`]
  const exercises = [...session.exercises].sort((a, b) => a.order - b.order)
  if (exercises.length === 0) lines.push('No exercises.')
  else for (const exercise of exercises) lines.push(formatExerciseLine(exercise))
  const incomplete = exercises.filter((exercise) => exercise.status !== 'complete').map((exercise) => exercise.exerciseNameSnapshot)
  if (incomplete.length) lines.push(`Incomplete: ${incomplete.join(', ')}`)
  const recovery = session.recovery
    .filter((entry) => entry.done)
    .map((entry) => (entry.minutes != null ? `${entry.activity} ${entry.minutes} min` : entry.activity))
  if (recovery.length) lines.push(`Recovery: ${recovery.join(', ')}`)
  const feelings: string[] = []
  if (session.energyLevel) feelings.push(`Energy ${session.energyLevel}/5`)
  if (session.jointDiscomfort) {
    const note = session.jointDiscomfort.note?.trim()
    feelings.push(note ? `Joint discomfort ${session.jointDiscomfort.level} (${note})` : `Joint discomfort ${session.jointDiscomfort.level}`)
  }
  if (session.moodBefore && session.moodAfter) feelings.push(`Mood ${session.moodBefore}→${session.moodAfter}`)
  else if (session.moodBefore) feelings.push(`Mood before ${session.moodBefore}`)
  else if (session.moodAfter) feelings.push(`Mood after ${session.moodAfter}`)
  if (feelings.length) lines.push(feelings.join(' · '))
  if (session.notes.trim()) lines.push(`Notes: ${session.notes.trim()}`)
  return lines.join('\n')
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  let text = String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const CSV_HEADER = [
  'date',
  'workout',
  'started_at',
  'finished_at',
  'exercise',
  'origin',
  'substituted_for',
  'set_index',
  'weight_lb',
  'reps',
  'reps_left',
  'reps_right',
  'done',
  'set_notes',
  'energy',
  'joint_discomfort',
  'mood_before',
  'mood_after',
  'recovery',
  'session_notes',
]

export function formatHistoryCsv(sessions: WorkoutSession[]): string {
  const rows = [CSV_HEADER.join(',')]
  const completed = [...sessions]
    .filter((session) => session.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))
  for (const session of completed) {
    const recovery = session.recovery
      .filter((entry) => entry.done)
      .map((entry) => (entry.minutes != null ? `${entry.activity} ${entry.minutes} min` : entry.activity))
      .join('|')
    const exercises = [...session.exercises].sort((a, b) => a.order - b.order)
    const write = (exercise: SessionExercise | null, set: SetEntry | null) => {
      rows.push(
        [
          session.date,
          session.templateNameSnapshot,
          session.startedAt,
          session.finishedAt ?? '',
          exercise?.exerciseNameSnapshot ?? '',
          exercise?.origin ?? '',
          exercise?.substitutedForName ?? '',
          set?.index ?? '',
          set?.weightLb ?? '',
          set?.reps ?? '',
          set?.repsLeft ?? '',
          set?.repsRight ?? '',
          set ? (set.done ? 'yes' : 'no') : '',
          set?.notes ?? '',
          session.energyLevel ?? '',
          session.jointDiscomfort?.level ?? '',
          session.moodBefore ?? '',
          session.moodAfter ?? '',
          recovery,
          session.notes,
        ]
          .map(csvCell)
          .join(','),
      )
    }
    if (exercises.length === 0) write(null, null)
    for (const exercise of exercises) {
      if (exercise.sets.length === 0) write(exercise, null)
      for (const set of [...exercise.sets].sort((a, b) => a.index - b.index)) write(exercise, set)
    }
  }
  return `${rows.join('\n')}\n`
}

export function backupFilename(exportedAt: string): string {
  return `afi-fitness-tracker-backup-${exportedAt.slice(0, 10)}.json`
}

export function historyHasSessions(backup: BackupFile): boolean {
  return backup.sessions.some((session) => session.status === 'completed')
}

export { durationMinutes }
