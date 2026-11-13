import { useEffect, useState } from 'preact/hooks'
import type { RecoveryActivity, SessionExercise, WorkoutSession } from '../domain/types'
import { RECOVERY_ACTIVITIES } from '../domain/types'
import { Choice, Stepper } from './widgets'
import { useModel } from './model'
import { useRouter } from './router'

export function Logger({ sessionId }: { sessionId: string }) {
  const model = useModel()
  const session = model.sessions.find((item) => item.id === sessionId)
  if (!session) return <p>Workout not found.</p>
  if (session.status !== 'in_progress') return <FinishedRedirect key={sessionId} sessionId={sessionId} />
  return <ActiveLogger key={session.id} session={session} />
}

function FinishedRedirect({ sessionId }: { sessionId: string }) {
  const { navigate } = useRouter()
  useEffect(() => {
    navigate(`/history/${sessionId}`, { replace: true })
  }, [navigate, sessionId])
  return <p>Opening the saved workout…</p>
}

function ActiveLogger({ session }: { session: WorkoutSession }) {
  const model = useModel()
  const { navigate } = useRouter()
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [notes, setNotes] = useState(session.notes)
  const [warmupLabel, setWarmupLabel] = useState('')
  const doneSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0)
  const totalSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const ratio = totalSets === 0 ? 0 : doneSets / totalSets

  useEffect(() => {
    setNotes(session.notes)
  }, [session.id])

  async function finish() {
    const ok = await model.finish(session.id)
    if (ok) navigate(`/history/${session.id}`, { replace: true, search: '?done=1' })
  }

  async function discard(confirmed: boolean) {
    const result = await model.discard(session.id, confirmed)
    if (result === 'confirm') setConfirmDiscard(true)
    if (result === 'discarded') navigate('/')
  }

  return (
    <section className="stack logger">
      <div className="logger-head">
        <p className="kicker">{session.date}</p>
        <h2 data-testid="logger-title">{session.templateNameSnapshot}</h2>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSets}
          aria-valuenow={doneSets}
          data-testid="progress-bar"
        >
          <span style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="muted">
          {doneSets} / {totalSets} sets
        </p>
      </div>

      <details className="panel" open>
        <summary>Warm-up</summary>
        <div className="stack tight">
          {session.warmup.map((item) => (
            <label key={item.id} className="check-row" data-testid="warmup-item">
              <input type="checkbox" checked={item.done} onChange={() => void model.toggleWarmup(session.id, item.id)} />
              <span>{item.label}</span>
            </label>
          ))}
          <div className="inline-form">
            <input
              aria-label="Add warm-up item"
              value={warmupLabel}
              onInput={(event) => setWarmupLabel((event.currentTarget as HTMLInputElement).value)}
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                void model.addWarmup(session.id, warmupLabel)
                setWarmupLabel('')
              }}
            >
              Add
            </button>
          </div>
        </div>
      </details>

      {session.exercises.length === 0 ? (
        <p className="empty" data-testid="empty-exercises">
          This workout starts empty. Add the machines you are using. Nothing here was invented for you.
        </p>
      ) : null}

      {session.exercises
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((exercise) => (
          <ExerciseCard key={exercise.id} session={session} exercise={exercise} />
        ))}

      <button type="button" className="btn" data-testid="add-exercise" onClick={() => navigate(`/workout/${session.id}/add`)}>
        Add exercise
      </button>

      <details className="panel" open>
        <summary>Recovery</summary>
        <div className="stack tight">
          {session.recovery.map((entry) => (
            <RecoveryRow key={entry.activity} sessionId={session.id} activity={entry.activity} done={entry.done} minutes={entry.minutes} planned={entry.planned} />
          ))}
        </div>
      </details>

      <details className="panel" open>
        <summary>How I feel</summary>
        <div className="stack tight">
          <p className="kicker">Energy</p>
          <div className="chips">
            {[1, 2, 3, 4, 5].map((level) => (
              <Choice
                key={level}
                label={String(level)}
                selected={session.energyLevel === level}
                onClick={() =>
                  void model.setFeelings(session.id, {
                    energyLevel: session.energyLevel === level ? undefined : (level as 1 | 2 | 3 | 4 | 5),
                  })
                }
              />
            ))}
          </div>
          <p className="kicker">Joint discomfort</p>
          <div className="chips">
            {[0, 1, 2, 3].map((level) => (
              <Choice
                key={level}
                label={String(level)}
                selected={session.jointDiscomfort?.level === level}
                onClick={() =>
                  void model.setFeelings(session.id, {
                    jointDiscomfort:
                      session.jointDiscomfort?.level === level ? undefined : { level: level as 0 | 1 | 2 | 3, note: session.jointDiscomfort?.note },
                  })
                }
              />
            ))}
          </div>
          {session.jointDiscomfort ? (
            <input
              aria-label="Joint note"
              placeholder="Joint note"
              value={session.jointDiscomfort.note ?? ''}
              onInput={(event) =>
                void model.setFeelings(session.id, {
                  jointDiscomfort: {
                    level: session.jointDiscomfort?.level ?? 0,
                    note: (event.currentTarget as HTMLInputElement).value,
                  },
                })
              }
            />
          ) : null}
          <p className="kicker">Mood before</p>
          <div className="chips">
            {[1, 2, 3, 4, 5].map((level) => (
              <Choice
                key={level}
                label={String(level)}
                selected={session.moodBefore === level}
                onClick={() =>
                  void model.setFeelings(session.id, {
                    moodBefore: session.moodBefore === level ? undefined : (level as 1 | 2 | 3 | 4 | 5),
                  })
                }
              />
            ))}
          </div>
          <p className="kicker">Mood after</p>
          <div className="chips">
            {[1, 2, 3, 4, 5].map((level) => (
              <Choice
                key={level}
                label={String(level)}
                selected={session.moodAfter === level}
                onClick={() =>
                  void model.setFeelings(session.id, {
                    moodAfter: session.moodAfter === level ? undefined : (level as 1 | 2 | 3 | 4 | 5),
                  })
                }
              />
            ))}
          </div>
        </div>
      </details>

      <label className="stack tight">
        <span className="kicker">Notes</span>
        <textarea
          data-testid="notes"
          value={notes}
          onInput={(event) => {
            const value = (event.currentTarget as HTMLTextAreaElement).value
            setNotes(value)
            void model.setNotes(session.id, value)
          }}
        />
      </label>

      <button type="button" className="btn" data-testid="save-to-template" onClick={() => void model.saveSessionToTemplate(session.id)}>
        Save today’s exercises to template
      </button>
      <p className="muted">This writes a new template version. Finished workouts stay as they were.</p>

      {confirmDiscard ? (
        <div className="confirm" role="group" aria-label="Confirm discard">
          <p>Discard this workout? It leaves history and does not change your progress.</p>
          <button type="button" className="btn danger" data-testid="confirm-discard" onClick={() => void discard(true)}>
            Discard
          </button>
          <button type="button" className="btn" onClick={() => setConfirmDiscard(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button type="button" className="btn ghost" data-testid="discard-workout" onClick={() => void discard(false)}>
          Discard workout
        </button>
      )}

      <div className="finish-bar">
        {confirmFinish ? (
          <div className="confirm" role="group" aria-label="Confirm finish">
            <p>Finish locks this workout. You can review it later, not edit it.</p>
            <button type="button" className="btn primary" data-testid="confirm-finish" onClick={() => void finish()}>
              Finish and save
            </button>
            <button type="button" className="btn" data-testid="cancel-finish" onClick={() => setConfirmFinish(false)}>
              Keep going
            </button>
          </div>
        ) : (
          <button type="button" className="btn primary" data-testid="finish-workout" onClick={() => setConfirmFinish(true)}>
            Finish workout
          </button>
        )}
      </div>
    </section>
  )
}

function ExerciseCard({ session, exercise }: { session: WorkoutSession; exercise: SessionExercise }) {
  const model = useModel()
  const { navigate } = useRouter()
  const [confirmRemoveSet, setConfirmRemoveSet] = useState(false)
  const [confirmRemoveExercise, setConfirmRemoveExercise] = useState(false)
  const catalog = model.exercises.find((item) => item.id === exercise.exerciseId)
  const increment = catalog?.incrementLb || 5
  const weightText = exercise.target.weightLb == null ? '' : ` @ ${exercise.target.weightLb} lb`
  const suggestion = exercise.progressionSuggestion?.reason

  async function removeSet(confirmed: boolean) {
    const result = await model.removeSet(session.id, exercise.id, confirmed)
    if (result === 'confirm') setConfirmRemoveSet(true)
    if (result === 'removed') setConfirmRemoveSet(false)
  }

  async function removeRow(confirmed: boolean) {
    const result = await model.removeExercise(session.id, exercise.id, confirmed)
    if (result === 'confirm') setConfirmRemoveExercise(true)
    if (result === 'removed') setConfirmRemoveExercise(false)
  }

  return (
    <article className="card" data-testid="exercise-card" data-name={exercise.exerciseNameSnapshot}>
      <header className="card-head">
        <div>
          <p className="index">{exercise.order}</p>
          <h3 data-testid="exercise-name">
            {exercise.exerciseNameSnapshot}
            {exercise.perSide ? <span className="tag">per side</span> : null}
          </h3>
          {exercise.origin === 'substituted' && exercise.substitutedForName ? (
            <p data-testid="sub-label">sub for {exercise.substitutedForName}</p>
          ) : null}
          {exercise.origin === 'added' ? <p>added today</p> : null}
        </div>
        <details className="menu" data-testid="exercise-menu">
          <summary aria-label={`Options for ${exercise.exerciseNameSnapshot}`}>···</summary>
          <div className="menu-panel">
            <button type="button" data-testid="substitute" onClick={() => navigate(`/workout/${session.id}/sub/${exercise.id}`)}>
              Substitute
            </button>
            <button type="button" onClick={() => void model.moveExercise(session.id, exercise.id, -1)}>
              Move up
            </button>
            <button type="button" onClick={() => void model.moveExercise(session.id, exercise.id, 1)}>
              Move down
            </button>
            <button type="button" data-testid="per-side" aria-pressed={exercise.perSide} onClick={() => void model.setPerSide(session.id, exercise.id, !exercise.perSide)}>
              Per side: {exercise.perSide ? 'On' : 'Off'}
            </button>
            <button type="button" data-testid="form-ok" aria-pressed={exercise.formOk} onClick={() => void model.setFormOk(session.id, exercise.id, !exercise.formOk)}>
              Form OK: {exercise.formOk ? 'On' : 'Off'}
            </button>
            <button type="button" onClick={() => void removeRow(false)}>
              Remove from today
            </button>
          </div>
        </details>
      </header>
      <p className="target">
        Target {exercise.target.sets} × {exercise.target.reps}
        {weightText}
      </p>
      <p className="p22" data-testid="p22">
        {suggestion ? `P22: ${suggestion}` : 'P22: 2×10 to start. Enter the weight you use. This is a suggestion only.'}
      </p>
      {!exercise.formOk ? <p className="warn">Form not marked OK. Project 22 will not suggest a weight increase from this exercise.</p> : null}
      <div>
        {exercise.sets.map((set) => (
          <div key={set.id} className="set-line" data-testid="set-row" data-index={set.index}>
            <div className="set-main">
              <span className="set-label">Set {set.index}</span>
              <Stepper
                label={`Set ${set.index} weight pounds`}
                value={set.weightLb}
                step={increment}
                testId="weight-input"
                onChange={(weightLb) => void model.patchSet(session.id, set.id, { weightLb })}
              />
              <button
                type="button"
                className={set.done ? 'check on' : 'check'}
                data-testid="set-done"
                aria-pressed={set.done}
                aria-label={`Set ${set.index} done`}
                onClick={() => void model.patchSet(session.id, set.id, { done: !set.done })}
              >
                ✓
              </button>
            </div>
            {exercise.perSide ? (
              <div className="side-reps">
                <span>L</span>
                <Stepper
                  label={`Set ${set.index} left reps`}
                  value={set.repsLeft}
                  step={1}
                  testId="reps-left"
                  onChange={(repsLeft) => void model.patchSet(session.id, set.id, { repsLeft })}
                />
                <span>R</span>
                <Stepper
                  label={`Set ${set.index} right reps`}
                  value={set.repsRight}
                  step={1}
                  testId="reps-right"
                  onChange={(repsRight) => void model.patchSet(session.id, set.id, { repsRight })}
                />
              </div>
            ) : (
              <div className="side-reps">
                <span>Reps</span>
                <Stepper
                  label={`Set ${set.index} reps`}
                  value={set.reps}
                  step={1}
                  testId="reps-input"
                  onChange={(reps) => void model.patchSet(session.id, set.id, { reps })}
                />
              </div>
            )}
            <SetNote
              initial={set.notes ?? ''}
              label={`Set ${set.index} note`}
              onChange={(notes) => void model.patchSet(session.id, set.id, { notes })}
            />
          </div>
        ))}
      </div>
      <div className="row-actions">
        <button type="button" className="btn" data-testid="add-set" onClick={() => void model.addSet(session.id, exercise.id)}>
          Add set
        </button>
        <button type="button" className="btn" data-testid="remove-set" onClick={() => void removeSet(false)}>
          Remove set
        </button>
      </div>
      {confirmRemoveSet ? (
        <div className="confirm" role="group" aria-label="Confirm remove set">
          <p>Remove this set? It has weight, reps, or a check recorded.</p>
          <button type="button" className="btn danger" data-testid="confirm-remove-set" onClick={() => void removeSet(true)}>
            Remove set
          </button>
          <button type="button" className="btn" data-testid="cancel-remove-set" onClick={() => setConfirmRemoveSet(false)}>
            Keep
          </button>
        </div>
      ) : null}
      {confirmRemoveExercise ? (
        <div className="confirm" role="group" aria-label="Confirm remove exercise">
          <p>Remove {exercise.exerciseNameSnapshot} from today? Recorded sets will be dropped from this workout only.</p>
          <button type="button" className="btn danger" data-testid="confirm-remove-exercise" onClick={() => void removeRow(true)}>
            Remove from today
          </button>
          <button type="button" className="btn" onClick={() => setConfirmRemoveExercise(false)}>
            Keep
          </button>
        </div>
      ) : null}
    </article>
  )
}

function SetNote({ initial, label, onChange }: { initial: string; label: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(initial)
  return (
    <label className="set-note">
      <span>Note</span>
      <input
        aria-label={label}
        value={text}
        onInput={(event) => {
          const value = (event.currentTarget as HTMLInputElement).value
          setText(value)
          onChange(value)
        }}
      />
    </label>
  )
}

function RecoveryRow({
  sessionId,
  activity,
  done,
  minutes,
  planned,
}: {
  sessionId: string
  activity: RecoveryActivity
  done: boolean
  minutes?: number
  planned: boolean
}) {
  const model = useModel()
  if (!RECOVERY_ACTIVITIES.includes(activity)) return null
  return (
    <div className="recovery-row">
      <label className="check-row">
        <input
          type="checkbox"
          checked={done}
          onChange={() => void model.setRecovery(sessionId, activity, { done: !done })}
        />
        <span>
          {activity}
          {planned ? <span className="tag">planned</span> : null}
        </span>
      </label>
      {done ? (
        <Stepper
          label={`${activity} minutes`}
          value={minutes ?? null}
          step={5}
          onChange={(value) => void model.setRecovery(sessionId, activity, { minutes: value })}
        />
      ) : null}
    </div>
  )
}
