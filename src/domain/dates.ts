const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function formatWeekdayMonthDay(isoDate: string): string {
  const date = parseLocalDate(isoDate)
  return `${WEEKDAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
}

export function formatMonthYear(isoDate: string): string {
  const date = parseLocalDate(isoDate)
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDayBadge(isoDate: string): string {
  const date = parseLocalDate(isoDate)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`
}

export function formatClock(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).formatToParts(new Date(iso))
  const hour = parts.find((part) => part.type === 'hour')?.value ?? ''
  const minute = parts.find((part) => part.type === 'minute')?.value ?? ''
  const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value ?? ''
  return `${hour}:${minute} ${dayPeriod}`
}

export function durationMinutes(startedAt?: string, finishedAt?: string): number | null {
  if (!startedAt || !finishedAt) return null
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60_000)
}

/** Monday-start week containing `today`, as local YYYY-MM-DD bounds. */
export function weekBounds(today: Date): { start: string; end: string } {
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return { start: localDate(start), end: localDate(end) }
}

export const SUGGESTED_WORKOUT_BY_WEEKDAY: readonly (string | null)[] = [
  null,
  'Back & Biceps A',
  'Chest & Triceps A',
  'Back & Biceps B',
  'Chest & Triceps B',
  'Legs & Stretching',
  null,
]

export function suggestedWorkoutName(today: Date): string | null {
  return SUGGESTED_WORKOUT_BY_WEEKDAY[today.getDay()] ?? null
}

export function backupIsStale(lastBackupAt: string | undefined, now: Date): boolean {
  if (!lastBackupAt) return true
  const age = now.getTime() - new Date(lastBackupAt).getTime()
  return age > 7 * 24 * 60 * 60 * 1000
}

export function parseCount(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return undefined
  const value = Number(trimmed)
  if (value > 2000) return 2000
  return value
}
