import { durationMinutes, formatDayBadge, suggestedWorkoutName } from '../domain/dates'
import { visitsThisWeek, inProgressFor, latestInProgress } from '../app/usecases'
import { byWorkoutOrder, completedSessions } from './order'
import { useModel } from './model'
import { useRouter } from './router'

export function Dashboard() {
  const model = useModel()
  const { navigate } = useRouter()
  const today = new Date()
  const templates = byWorkoutOrder(model.templates)
  const suggestedName = suggestedWorkoutName(today)
  const suggested = templates.find((template) => template.name === suggestedName)
  const resume = latestInProgress(model.sessions)
  const done = completedSessions(model.sessions)
  const last = done[0]
  const goal = model.settings?.weeklyGoal ?? 3
  const visits = visitsThisWeek(model.sessions, today)
  const dots = Array.from({ length: Math.max(goal, 1) }, (_, index) => (index < visits ? '●' : '○')).join('')

  async function openTemplate(templateId: string) {
    const id = await model.startOrResume(templateId)
    if (id) navigate(`/workout/${id}`)
  }

  return (
    <section className="stack">
      <p className="kicker">Today · {today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      {resume ? (
        <article className="hero">
          <p className="kicker">In progress</p>
          <h2>{resume.templateNameSnapshot}</h2>
          <button type="button" className="btn primary" data-testid="resume-workout" onClick={() => navigate(`/workout/${resume.id}`)}>
            Resume workout
          </button>
        </article>
      ) : suggested ? (
        <article className="hero" data-testid="suggested">
          <p className="kicker">Suggested</p>
          <h2>{suggested.name}</h2>
          <button type="button" className="btn primary" data-testid="start-suggested" onClick={() => void openTemplate(suggested.id)}>
            Start workout
          </button>
        </article>
      ) : (
        <article className="hero">
          <h2>Pick any workout</h2>
          <p className="muted">Saturday and Sunday have no suggested day. Every workout is available.</p>
        </article>
      )}
      <div>
        <p className="kicker">Or pick any workout</p>
        <div className="workout-grid">
          {templates.map((template) => {
            const open = inProgressFor(model.sessions, template.id)
            return (
              <button
                key={template.id}
                type="button"
                className="workout-btn"
                data-testid="workout"
                data-name={template.name}
                aria-label={template.name}
                onClick={() => void openTemplate(template.id)}
              >
                <span>{template.name}</span>
                {open ? <small>Resume</small> : <small>{template.suggestedDay}</small>}
              </button>
            )
          })}
        </div>
      </div>
      <p className="week" data-testid="week-count">
        <span aria-hidden="true">{dots} </span>
        {visits} of {goal} visits
      </p>
      <p className="muted">Missed days stay missed. They do not reset your progress. The weekly goal is only a count.</p>
      <div>
        <h2 className="section-title">Last workout</h2>
        {last ? (
          <button type="button" className="list-btn" data-testid="last-workout" onClick={() => navigate(`/history/${last.id}`)}>
            <span>
              {formatDayBadge(last.date)} · {last.templateNameSnapshot}
            </span>
            <span>{durationMinutes(last.startedAt, last.finishedAt) ?? 0} min</span>
          </button>
        ) : (
          <p className="muted">No workouts yet.</p>
        )}
      </div>
      <div>
        <h2 className="section-title">Recent</h2>
        {done.length === 0 ? <p className="muted">Finished workouts will show up here.</p> : null}
        <div className="list">
          {done.slice(0, 8).map((session) => (
            <button key={session.id} type="button" className="list-btn" onClick={() => navigate(`/history/${session.id}`)}>
              <span>
                {formatDayBadge(session.date)} · {session.templateNameSnapshot}
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
