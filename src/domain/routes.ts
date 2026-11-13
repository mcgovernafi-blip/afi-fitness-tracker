export function normalizeBase(base: string): string {
  if (!base || base === '/') return '/'
  const withSlash = base.startsWith('/') ? base : `/${base}`
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`
}

export function stripBase(pathname: string, base: string): string {
  const normalized = normalizeBase(base)
  const path = pathname || '/'
  if (normalized === '/') return path.startsWith('/') ? path : `/${path}`
  const prefix = normalized.slice(0, -1)
  if (path === prefix || path === normalized || path === `${prefix}/`) return '/'
  if (path.startsWith(`${prefix}/`)) {
    const rest = path.slice(prefix.length)
    return rest || '/'
  }
  return path.startsWith('/') ? path : `/${path}`
}

export function joinBase(path: string, base: string): string {
  const normalized = normalizeBase(base)
  if (path === '/' || path === '') return normalized
  const suffix = path.startsWith('/') ? path.slice(1) : path
  return `${normalized}${suffix}`
}

export type Route =
  | { name: 'dashboard' }
  | { name: 'workout'; sessionId: string }
  | { name: 'add'; sessionId: string }
  | { name: 'substitute'; sessionId: string; rowId: string }
  | { name: 'history' }
  | { name: 'historyDetail'; sessionId: string }
  | { name: 'exerciseHistory'; exerciseId: string }
  | { name: 'catalog' }
  | { name: 'template'; templateId: string }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'export' }
  | { name: 'settings' }

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function matchRoute(pathname: string): Route {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  if (path === '/') return { name: 'dashboard' }
  let match = path.match(/^\/workout\/([^/]+)\/add$/)
  if (match) return { name: 'add', sessionId: decode(match[1]) }
  match = path.match(/^\/workout\/([^/]+)\/sub\/([^/]+)$/)
  if (match) return { name: 'substitute', sessionId: decode(match[1]), rowId: decode(match[2]) }
  match = path.match(/^\/workout\/([^/]+)$/)
  if (match) return { name: 'workout', sessionId: decode(match[1]) }
  if (path === '/history') return { name: 'history' }
  match = path.match(/^\/history\/([^/]+)$/)
  if (match) return { name: 'historyDetail', sessionId: decode(match[1]) }
  match = path.match(/^\/exercise-history\/([^/]+)$/)
  if (match) return { name: 'exerciseHistory', exerciseId: decode(match[1]) }
  if (path === '/catalog') return { name: 'catalog' }
  match = path.match(/^\/template\/([^/]+)$/)
  if (match) return { name: 'template', templateId: decode(match[1]) }
  match = path.match(/^\/exercise\/([^/]+)$/)
  if (match) return { name: 'exercise', exerciseId: decode(match[1]) }
  if (path === '/export') return { name: 'export' }
  if (path === '/settings') return { name: 'settings' }
  return { name: 'dashboard' }
}
