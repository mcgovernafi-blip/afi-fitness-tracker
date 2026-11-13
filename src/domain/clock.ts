export interface Clock {
  now(): Date
  id(): string
}

export const systemClock: Clock = {
  now: () => new Date(),
  id: () => crypto.randomUUID(),
}

export function sequenceClock(startIso: string): Clock {
  let tick = 0
  let n = 0
  const start = new Date(startIso).getTime()
  return {
    now: () => new Date(start + tick++ * 1000),
    id: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  }
}
