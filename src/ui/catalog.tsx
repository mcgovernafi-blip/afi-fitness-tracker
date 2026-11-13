import { useState } from 'preact/hooks'
import type { Exercise, TemplateItem } from '../domain/types'
import { byWorkoutOrder, equipmentLabel } from './order'
import { useModel } from './model'
import { useRouter } from './router'

export function Catalog() {
  const model = useModel()
  const { navigate } = useRouter()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const needle = query.trim().toLowerCase()
  const exercises = model.exercises
    .filter((exercise) => (showArchived ? true : !exercise.archived))
    .filter((exercise) => (needle ? exercise.name.toLowerCase().includes(needle) : true))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <section className="stack">
      <h2>Catalog</h2>
      <input
        aria-label="Search catalog"
        placeholder="Search machines"
        value={query}
        onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
      />
      <div className="list">
        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            className="list-btn"
            data-testid="catalog-row"
            data-name={exercise.name}
            onClick={() => navigate(`/exercise/${exercise.id}`)}
          >
            <span>
              {exercise.name}
              {exercise.perSide ? <span className="tag">per side</span> : null}
              {exercise.archived ? <span className="tag">archived</span> : null}
            </span>
            <span>
              {equipmentLabel(exercise.equipment)} · {exercise.incrementLb} lb
            </span>
          </button>
        ))}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={showArchived} onChange={() => setShowArchived((value) => !value)} />
        <span>Show archived</span>
      </label>
      <h2 className="section-title">Workouts</h2>
      <p className="muted">Templates ship empty. Add the machines you use, then save a new version. Old workouts are not rewritten.</p>
      <div className="list">
        {byWorkoutOrder(model.templates).map((template) => (
          <button
            key={template.id}
            type="button"
            className="list-btn"
            data-testid="template-edit"
            data-name={template.name}
            onClick={() => navigate(`/template/${template.id}`)}
          >
            <span>{template.name}</span>
            <span>v{template.currentVersion}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function ExerciseEditor({ exerciseId }: { exerciseId: string }) {
  const model = useModel()
  const { navigate } = useRouter()
  const exercise = model.exercises.find((item) => item.id === exerciseId)
  const [draft, setDraft] = useState<Exercise | null>(exercise ?? null)
  if (!exercise || !draft) return <p>Exercise not found.</p>
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        void model.saveExercise({ ...draft, name: draft.name.trim() || exercise.name }).then(() => navigate('/catalog'))
      }}
    >
      <h2>Edit machine</h2>
      <label className="stack tight">
        <span>Name</span>
        <input aria-label="Exercise name" value={draft.name} onInput={(event) => setDraft({ ...draft, name: (event.currentTarget as HTMLInputElement).value })} />
      </label>
      <label className="stack tight">
        <span>Smallest increment (lb)</span>
        <input
          inputMode="numeric"
          aria-label="Increment pounds"
          value={draft.incrementLb}
          onInput={(event) => setDraft({ ...draft, incrementLb: Number((event.currentTarget as HTMLInputElement).value) || 1 })}
        />
      </label>
      <label className="check-row">
        <input type="checkbox" checked={draft.perSide} onChange={() => setDraft({ ...draft, perSide: !draft.perSide })} />
        <span>Reps per side</span>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={draft.archived} onChange={() => setDraft({ ...draft, archived: !draft.archived })} />
        <span>Archive (hide from the picker)</span>
      </label>
      <p className="muted">Archived machines stay in history. They are not deleted.</p>
      <button type="submit" className="btn primary">
        Save machine
      </button>
    </form>
  )
}

export function TemplateEditor({ templateId }: { templateId: string }) {
  const model = useModel()
  const { navigate } = useRouter()
  const template = model.templates.find((item) => item.id === templateId)
  const version = model.versions.find((item) => item.templateId === templateId && item.version === template?.currentVersion)
  const [items, setItems] = useState<TemplateItem[]>(version?.items.map((item) => ({ ...item })) ?? [])
  const [query, setQuery] = useState('')
  if (!template) return <p>Workout not found.</p>
  const needle = query.trim().toLowerCase()
  const choices = model.exercises.filter((exercise) => !exercise.archived && (!needle || exercise.name.toLowerCase().includes(needle)))

  function update(index: number, patch: Partial<TemplateItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  return (
    <section className="stack">
      <h2>{template.name}</h2>
      <p className="muted">Version {template.currentVersion}. Saving creates the next version and leaves finished workouts unchanged.</p>
      {items.length === 0 ? <p data-testid="template-empty">No exercises in this version.</p> : null}
      {items.map((item, index) => {
        const exercise = model.exercises.find((entry) => entry.id === item.exerciseId)
        return (
          <article key={`${item.exerciseId}-${index}`} className="card stack tight">
            <h3>{exercise?.name ?? 'Exercise'}</h3>
            <label>
              Sets
              <input inputMode="numeric" value={item.targetSets} onInput={(event) => update(index, { targetSets: Number((event.currentTarget as HTMLInputElement).value) || 1 })} />
            </label>
            <label>
              Reps
              <input inputMode="numeric" value={item.targetReps} onInput={(event) => update(index, { targetReps: Number((event.currentTarget as HTMLInputElement).value) || 10 })} />
            </label>
            <label>
              Weight lb
              <input
                inputMode="numeric"
                value={item.targetWeightLb ?? ''}
                onInput={(event) => {
                  const raw = (event.currentTarget as HTMLInputElement).value.trim()
                  update(index, { targetWeightLb: raw === '' ? null : Number(raw) })
                }}
              />
            </label>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setItems((current) => move(current, index, -1))}>
                Up
              </button>
              <button type="button" className="btn" onClick={() => setItems((current) => move(current, index, 1))}>
                Down
              </button>
              <button
                type="button"
                className="btn danger"
                data-testid="draft-remove"
                data-name={exercise?.name ?? ''}
                onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                Remove
              </button>
            </div>
          </article>
        )
      })}
      <input aria-label="Find a machine to add" placeholder="Add a machine" value={query} onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)} />
      <div className="list">
        {choices.slice(0, 8).map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            className="list-btn"
            data-testid="draft-add"
            data-name={exercise.name}
            onClick={() =>
              setItems((current) => [
                ...current,
                { exerciseId: exercise.id, order: current.length + 1, targetSets: 2, targetReps: 10, targetWeightLb: null },
              ])
            }
          >
            <span>Add {exercise.name}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn primary"
        data-testid="save-template-version"
        onClick={() => void model.saveTemplateItems(template.id, items).then(() => navigate('/catalog'))}
      >
        Save as new version
      </button>
    </section>
  )
}

function move(items: TemplateItem[], index: number, direction: -1 | 1): TemplateItem[] {
  const next = index + direction
  if (next < 0 || next >= items.length) return items
  const copy = items.slice()
  const current = copy[index]
  copy[index] = copy[next]
  copy[next] = current
  return copy.map((item, order) => ({ ...item, order: order + 1 }))
}
