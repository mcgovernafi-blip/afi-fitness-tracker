import { useState } from 'preact/hooks'
import { backupIsStale, durationMinutes, formatDayBadge, formatMonthYear } from '../domain/dates'
import { exerciseLabel, formatSetToken, formatWorkoutText } from '../domain/export'
import { byWorkoutOrder, completedSessions } from './order'
import { shareText } from './files'
import { useModel } from './model'
import { useRouter } from './router'

export function History() {
  const model = useModel()
  const { navigate } = useRouter()
  const [filter, setFilter] = useState('all')
  const templates = byWorkoutOrder(model.templates)
  const sessions = completedSessions(model.sessions).filter((session) => filter === 'all' || session.templateId === filter)
  const groups = new Map<string, typeof sessions>()
  for (const session of sessions) {
    const key = formatMonthYear(session.date)
    groups.set(key, [...(groups.get(key) ?? []), session])
  }
  return (
    <section className="stack">
      <div className="spread">
        <h2>History</h2>
        <select data-testid="history-filter" aria-label="Filter workouts" value={filter} onChange={(event) => setFilter((event.currentTarget as HTMLSelectElement).value)}>
          <option value="all">All workouts</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
      {sessions.length === 0 ? <p className="muted">No finished workouts yet.</p> : null}
      {[...groups.entries()].map(([month, rows]) => (
        <div key={month}>
          <h3 className="section-title">{month}</h3>
          <div className="list">
            {rows.map((session) => {
              const incomplete = session.exercises.some((exercise) => exercise.status !== 'complete')
              const minutes = durationMinutes(session.startedAt, session.finishedAt)
              return (
                <button
                  key={session.id}
                  type="button"
                  className="list-btn"
                  data-testid="history-item"
                  data-name={session.templateNameSnapshot}
                  onClick={() => navigate(`/history/${session.id}`)}
                >
                  <span>
                    {formatDayBadge(session.date)} · {session.templateNameSnapshot}
                  </span>
                  <span>
                    {minutes != null ? `${minutes}m` : ''} {incomplete ? '◐' : '✓'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

export function HistoryDetail({ sessionId }: { sessionId: string }) {
  const model = useModel()
  const { navigate, search } = useRouter()
  const [copied, setCopied] = useState('')
  const [hideReminder, setHideReminder] = useState(false)
  const session = model.sessions.find((item) => item.id === sessionId)
  if (!session) return <p>Workout not found.</p>
  const text = formatWorkoutText(session)
  const justFinished = new URLSearchParams(search).get('done') === '1'
  const stale = backupIsStale(model.settings?.lastBackupAt, new Date())
  const exercises = session.exercises.slice().sort((a, b) => a.order - b.order)

  async function copy() {
    const ok = await model.copy(text)
    setCopied(ok ? 'Copied' : '')
  }

  return (
    <section className="stack" data-testid="history-detail">
      <p className="kicker">
        {session.date}
        {session.finishedAt ? ` · ${durationMinutes(session.startedAt, session.finishedAt) ?? 0} min` : ''}
      </p>
      <h2>{session.templateNameSnapshot}</h2>
      <p className="muted">Saved workouts stay read-only. Template edits do not change this log.</p>
      {justFinished && stale && !hideReminder ? (
        <div className="reminder" data-testid="backup-reminder">
          <p>Last full backup is more than a week old, or you have not made one yet.</p>
          <button type="button" className="btn" onClick={() => navigate('/export')}>
            Back up
          </button>
          <button type="button" className="btn ghost" data-testid="dismiss-backup" onClick={() => setHideReminder(true)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {exercises.map((exercise) => {
        const progress = model.progression.find((item) => item.exerciseId === exercise.exerciseId)
        return (
          <article key={exercise.id} className="card">
            <h3>{exerciseLabel(exercise)}</h3>
            <p>{exercise.sets.map((set) => formatSetToken(set, exercise.perSide)).join(', ')}</p>
            {exercise.status !== 'complete' ? <p className="warn">Incomplete</p> : null}
            {progress?.pendingSuggestion ? <p className="p22">Next time: {progress.pendingSuggestion.reason}</p> : null}
            <button type="button" className="btn ghost" data-testid="exercise-history-link" onClick={() => navigate(`/exercise-history/${exercise.exerciseId}`)}>
              {exercise.exerciseNameSnapshot} history
            </button>
          </article>
        )
      })}
      {session.recovery.some((entry) => entry.done) ? (
        <p>Recovery: {session.recovery.filter((entry) => entry.done).map((entry) => entry.activity).join(', ')}</p>
      ) : null}
      <pre data-testid="log-text">{text}</pre>
      <button type="button" className="btn primary" data-testid="copy-log" onClick={() => void copy()}>
        Copy as text
      </button>
      <p data-testid="copy-status">{copied}</p>
      <button
        type="button"
        className="btn"
        data-testid="share-log"
        onClick={() =>
          void shareText(text).then((result) => {
            if (result === 'copied') setCopied('Copied')
          })
        }
      >
        Share
      </button>
    </section>
  )
}

export function ExerciseHistory({ exerciseId }: { exerciseId: string }) {
  const model = useModel()
  const exercise = model.exercises.find((item) => item.id === exerciseId)
  const rows = completedSessions(model.sessions).flatMap((session) =>
    session.exercises
      .filter((item) => item.exerciseId === exerciseId)
      .map((item) => ({ session, item })),
  )
  return (
    <section className="stack">
      <h2>{exercise?.name ?? 'Exercise'} history</h2>
      {rows.length === 0 ? <p className="muted">No finished sets yet.</p> : null}
      {rows.map(({ session, item }) => (
        <article key={`${session.id}-${item.id}`} className="card">
          <h3>
            {formatDayBadge(session.date)} · {session.templateNameSnapshot}
          </h3>
          <p>{item.sets.map((set) => formatSetToken(set, item.perSide)).join(', ')}</p>
        </article>
      ))}
    </section>
  )
}
