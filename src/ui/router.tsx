import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { joinBase, matchRoute, stripBase, type Route } from '../domain/routes'

interface RouterValue {
  path: string
  search: string
  route: Route
  navigate: (path: string, options?: { replace?: boolean; search?: string }) => void
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children }: { children: ComponentChildren }) {
  const base = import.meta.env.BASE_URL
  const read = () => ({
    path: stripBase(window.location.pathname, base),
    search: window.location.search,
  })
  const [loc, setLoc] = useState(read)
  useEffect(() => {
    const onPop = () => setLoc({ path: stripBase(window.location.pathname, base), search: window.location.search })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [base])
  const navigate = useCallback((path: string, options?: { replace?: boolean; search?: string }) => {
    const url = joinBase(path, base) + (options?.search ?? '')
    if (options?.replace) history.replaceState({}, '', url)
    else history.pushState({}, '', url)
    setLoc({ path: stripBase(window.location.pathname, base), search: window.location.search })
  }, [base])
  const value = { path: loc.path, search: loc.search, route: matchRoute(loc.path), navigate }
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const router = useContext(RouterContext)
  if (!router) throw new Error('Router missing')
  return router
}
