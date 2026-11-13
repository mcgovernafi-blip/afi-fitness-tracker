import { useEffect, useState } from 'preact/hooks'
import { COPYRIGHT } from '../domain/types'
import { Catalog, ExerciseEditor, TemplateEditor } from './catalog'
import { Dashboard } from './dashboard'
import { ExportPage, Settings } from './data-pages'
import { ExerciseHistory, History, HistoryDetail } from './history'
import { Logger } from './logger'
import { useModel } from './model'
import { Picker } from './picker'
import { useRouter } from './router'

export function Shell() {
  const model = useModel()
  const { route, navigate } = useRouter()
  const standalone = useStandalone()
  const showTabs = route.name === 'dashboard' || route.name === 'history' || route.name === 'catalog' || route.name === 'export'
  const title = titleFor(route.name)

  useEffect(() => {
    document.title = title
  }, [title])

  if (!model.ready) {
    return (
      <main className="content">
        <h1>AFI Fitness Tracker</h1>
        <p>{model.error ?? 'Loading…'}</p>
      </main>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        {route.name === 'dashboard' ? (
          <h1 data-testid="app-title">AFI Fitness Tracker</h1>
        ) : (
          <button type="button" className="back" data-testid="back" onClick={() => navigate(backPath(route))}>
            Back
          </button>
        )}
        {route.name !== 'dashboard' ? <p className="top-title">{title}</p> : null}
        <button type="button" data-testid="open-settings" aria-label="Settings" onClick={() => navigate('/settings')}>
          Settings
        </button>
      </header>
      {!standalone ? (
        <p className="banner" data-testid="install-banner">
          Add to Home Screen in Safari so this app keeps its own storage.
        </p>
      ) : null}
      {model.error ? (
        <p role="alert" className="error" data-testid="error">
          {model.error}
          <button type="button" onClick={() => model.clearError()}>
            Dismiss
          </button>
        </p>
      ) : null}
      <main className={showTabs ? 'content with-tabs' : 'content'}>{screenFor(route)}</main>
      {showTabs ? (
        <nav className="tabbar" aria-label="Primary">
          <button type="button" data-testid="nav-home" aria-current={route.name === 'dashboard' ? 'page' : undefined} onClick={() => navigate('/')}>
            Home
          </button>
          <button type="button" data-testid="nav-history" aria-current={route.name === 'history' ? 'page' : undefined} onClick={() => navigate('/history')}>
            History
          </button>
          <button type="button" data-testid="nav-catalog" aria-current={route.name === 'catalog' ? 'page' : undefined} onClick={() => navigate('/catalog')}>
            Catalog
          </button>
          <button type="button" data-testid="nav-export" aria-current={route.name === 'export' ? 'page' : undefined} onClick={() => navigate('/export')}>
            Export
          </button>
        </nav>
      ) : null}
      <p className="sr-only">{COPYRIGHT}</p>
    </div>
  )
}

function screenFor(route: ReturnType<typeof useRouter>['route']) {
  switch (route.name) {
    case 'dashboard':
      return <Dashboard />
    case 'workout':
      return <Logger key={route.sessionId} sessionId={route.sessionId} />
    case 'add':
      return <Picker key={`${route.sessionId}-add`} sessionId={route.sessionId} />
    case 'substitute':
      return <Picker key={`${route.sessionId}-${route.rowId}`} sessionId={route.sessionId} rowId={route.rowId} />
    case 'history':
      return <History />
    case 'historyDetail':
      return <HistoryDetail key={route.sessionId} sessionId={route.sessionId} />
    case 'exerciseHistory':
      return <ExerciseHistory key={route.exerciseId} exerciseId={route.exerciseId} />
    case 'catalog':
      return <Catalog />
    case 'template':
      return <TemplateEditor key={route.templateId} templateId={route.templateId} />
    case 'exercise':
      return <ExerciseEditor key={route.exerciseId} exerciseId={route.exerciseId} />
    case 'export':
      return <ExportPage />
    case 'settings':
      return <Settings />
    default:
      return <Dashboard />
  }
}

function backPath(route: ReturnType<typeof useRouter>['route']): string {
  switch (route.name) {
    case 'workout':
      return '/'
    case 'add':
    case 'substitute':
      return `/workout/${route.sessionId}`
    case 'historyDetail':
      return '/history'
    case 'exerciseHistory':
      return '/history'
    case 'template':
    case 'exercise':
      return '/catalog'
    default:
      return '/'
  }
}

function titleFor(name: ReturnType<typeof useRouter>['route']['name']): string {
  switch (name) {
    case 'history':
    case 'historyDetail':
      return 'History'
    case 'catalog':
    case 'template':
    case 'exercise':
      return 'Catalog'
    case 'export':
      return 'Export'
    case 'settings':
      return 'Settings'
    case 'add':
      return 'Add exercise'
    case 'substitute':
      return 'Substitute'
    default:
      return 'AFI Fitness Tracker'
  }
}

function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const update = () => setStandalone(media.matches || ios)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return standalone
}
