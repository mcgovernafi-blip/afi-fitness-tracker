import { useState } from 'preact/hooks'
import { COPYRIGHT } from '../domain/types'
import { migrateBackup } from '../domain/migrate'
import { backupIsStale, localDate } from '../domain/dates'
import { formatWorkoutText } from '../domain/export'
import { completedSessions } from './order'
import { useModel } from './model'
import { useRouter } from './router'

export function ExportPage() {
  const model = useModel()
  const { navigate } = useRouter()
  const [pending, setPending] = useState<unknown>(null)
  const [copied, setCopied] = useState('')
  const last = completedSessions(model.sessions)[0]
  const backedUp = model.settings?.lastBackupAt
  const stale = backupIsStale(backedUp, new Date())

  async function onFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    let raw: unknown
    try {
      raw = JSON.parse(text) as unknown
    } catch {
      model.showError('Backup file is not valid')
      return
    }
    try {
      migrateBackup(raw)
    } catch (error) {
      model.showError(error instanceof Error ? error.message : 'Backup file is not valid')
      return
    }
    setPending(raw)
  }

  return (
    <section className="stack">
      <h2>Export & backup</h2>
      <p data-testid="last-backup">{backedUp ? `Last backup: ${localDate(new Date(backedUp))}` : 'Last backup: never'}</p>
      <p data-testid="storage-status">Storage: {model.settings?.storagePersisted ? 'Persistent' : 'Not persistent'}</p>
      {stale ? <p className="warn">A backup older than 7 days, or no backup yet, can be replaced if the Home Screen icon is deleted.</p> : null}
      <button
        type="button"
        className="btn"
        data-testid="copy-last"
        disabled={!last}
        onClick={() => {
          if (!last) return
          void model.copy(formatWorkoutText(last)).then((ok) => setCopied(ok ? 'Copied' : ''))
        }}
      >
        Copy last workout as text
      </button>
      <p data-testid="copy-status">{copied}</p>
      <button type="button" className="btn" data-testid="download-csv" onClick={() => void model.downloadCsv()}>
        Share workout history (CSV)
      </button>
      <button type="button" className="btn primary" data-testid="download-backup" onClick={() => void model.downloadBackup()}>
        Full backup (JSON)
      </button>
      <label className="btn">
        Restore from backup
        <input data-testid="restore-file" className="file-input" type="file" accept="application/json" onChange={(event) => void onFile(event)} />
      </label>
      {pending ? (
        <div className="confirm" role="group" aria-label="Confirm restore">
          <p>Replace all workouts on this device with this backup?</p>
          <button type="button" className="btn danger" data-testid="confirm-restore" onClick={() => void model.restore(pending).then(() => setPending(null))}>
            Replace data
          </button>
          <button type="button" className="btn" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      <article className="card safety">
        <h3>Data safety</h3>
        <p>Deleting the Home Screen icon or clearing Safari website data erases this app’s data. Keep a backup in Files or iCloud Drive.</p>
        <button type="button" className="btn ghost" onClick={() => navigate('/settings')}>
          Warm-up list and goal
        </button>
      </article>
    </section>
  )
}

export function Settings() {
  const model = useModel()
  const settings = model.settings
  const [items, setItems] = useState(model.warmup?.items.map((item) => ({ ...item })) ?? [])
  const [label, setLabel] = useState('')
  if (!settings) return null
  return (
    <section className="stack">
      <h2>Settings</h2>
      <div>
        <p className="kicker">Theme</p>
        <div className="chips">
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              className={settings.theme === theme ? 'chip on' : 'chip'}
              data-testid={`theme-${theme}`}
              aria-pressed={settings.theme === theme}
              onClick={() => void model.saveSettings({ theme })}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="kicker">Weekly visit goal</p>
        <div className="stepper">
          <button
            type="button"
            data-testid="goal-down"
            aria-label="Decrease weekly goal"
            onClick={() => void model.saveSettings({ weeklyGoal: settings.weeklyGoal - 1 })}
          >
            −
          </button>
          <output data-testid="weekly-goal">{settings.weeklyGoal}</output>
          <button
            type="button"
            data-testid="goal-up"
            aria-label="Increase weekly goal"
            onClick={() => void model.saveSettings({ weeklyGoal: settings.weeklyGoal + 1 })}
          >
            +
          </button>
        </div>
        <p className="muted">Pounds only. The goal is a count, not a streak.</p>
      </div>
      <div className="stack tight">
        <h3>Warm-up checklist</h3>
        <p className="muted">Edits apply to the next workout. The current workout keeps its own copy.</p>
        {items.map((item, index) => (
          <div key={item.id} className="inline-form">
            <input
              aria-label={`Warm-up ${index + 1}`}
              value={item.label}
              onInput={(event) => {
                const value = (event.currentTarget as HTMLInputElement).value
                setItems((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, label: value } : entry)))
              }}
            />
            <button type="button" className="btn" onClick={() => setItems((current) => current.filter((_, entryIndex) => entryIndex !== index))}>
              Remove
            </button>
          </div>
        ))}
        <div className="inline-form">
          <input aria-label="New warm-up item" value={label} onInput={(event) => setLabel((event.currentTarget as HTMLInputElement).value)} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              const trimmed = label.trim()
              if (!trimmed) return
              setItems((current) => [...current, { id: crypto.randomUUID(), label: trimmed }])
              setLabel('')
            }}
          >
            Add
          </button>
        </div>
        <button type="button" className="btn primary" data-testid="save-warmup" onClick={() => void model.saveWarmup(items)}>
          Save warm-up list
        </button>
      </div>
      <p className="muted">Units: lb. Progress charts and recovery panels wait for a later phase. This phase records them on each workout.</p>
      <p className="copyright">{COPYRIGHT}</p>
    </section>
  )
}
