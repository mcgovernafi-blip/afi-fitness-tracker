import { useState } from 'preact/hooks'
import type { Exercise } from '../domain/types'
import { equipmentLabel, recentExercises } from './order'
import { useModel } from './model'
import { useRouter } from './router'

export function Picker({ sessionId, rowId }: { sessionId: string; rowId?: string }) {
  const model = useModel()
  const { navigate } = useRouter()
  const [query, setQuery] = useState('')
  const [saveToTemplate, setSaveToTemplate] = useState(false)
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState<Exercise['equipment']>('selectorized')
  const [perSide, setPerSide] = useState(false)
  const [increment, setIncrement] = useState(5)
  const session = model.sessions.find((item) => item.id === sessionId)
  const replacing = rowId ? session?.exercises.find((exercise) => exercise.id === rowId) : undefined
  const needle = query.trim().toLowerCase()
  const available = model.exercises
    .filter((exercise) => !exercise.archived)
    .filter((exercise) => (needle ? exercise.name.toLowerCase().includes(needle) : true))
    .sort((a, b) => a.name.localeCompare(b.name))
  const recent = recentExercises(model.sessions, model.exercises).filter((exercise) =>
    needle ? exercise.name.toLowerCase().includes(needle) : true,
  )

  async function choose(exerciseId: string) {
    if (rowId) await model.substitute(sessionId, rowId, exerciseId, saveToTemplate)
    else await model.addExercise(sessionId, exerciseId, saveToTemplate)
    if (!model.error) navigate(`/workout/${sessionId}`)
  }

  async function saveCustom(event: Event) {
    event.preventDefault()
    const id = await model.createCustom({ name, equipment, perSide, incrementLb: increment })
    if (!id) return
    if (rowId) await model.substitute(sessionId, rowId, id, saveToTemplate)
    else await model.addExercise(sessionId, id, saveToTemplate)
    navigate(`/workout/${sessionId}`)
  }

  return (
    <section className="stack">
      <h2>{replacing ? `Substitute for ${replacing.exerciseNameSnapshot}` : 'Add exercise'}</h2>
      <input
        data-testid="catalog-search"
        placeholder="Search machines"
        aria-label="Search machines"
        value={query}
        onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
      />
      {recent.length > 0 ? (
        <div>
          <p className="kicker">Recent</p>
          <div className="list">
            {recent.map((exercise) => (
              <CatalogButton key={`recent-${exercise.id}`} exercise={exercise} onChoose={() => void choose(exercise.id)} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="list">
        {available.map((exercise) => (
          <CatalogButton key={exercise.id} exercise={exercise} onChoose={() => void choose(exercise.id)} />
        ))}
      </div>
      <form className="card stack tight" onSubmit={(event) => void saveCustom(event)}>
        <h3>Custom exercise</h3>
        <input data-testid="custom-name" aria-label="Custom exercise name" value={name} onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)} />
        <div className="chips">
          <button type="button" className={equipment === 'cable' ? 'chip on' : 'chip'} onClick={() => setEquipment('cable')}>
            Cable
          </button>
          <button type="button" className={equipment === 'selectorized' ? 'chip on' : 'chip'} onClick={() => setEquipment('selectorized')}>
            Stack
          </button>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={perSide} onChange={() => setPerSide((value) => !value)} />
          <span>Per side</span>
        </label>
        <label className="stack tight">
          <span>Increment (lb)</span>
          <input
            inputMode="numeric"
            aria-label="Increment pounds"
            value={increment}
            onInput={(event) => setIncrement(Number((event.currentTarget as HTMLInputElement).value) || 5)}
          />
        </label>
        <button type="submit" className="btn primary" data-testid="custom-save">
          Save custom exercise
        </button>
      </form>
      <fieldset className="apply">
        <legend>Apply to</legend>
        <label className="check-row">
          <input data-testid="apply-today" type="radio" name="apply" checked={!saveToTemplate} onChange={() => setSaveToTemplate(false)} />
          <span>Today only</span>
        </label>
        <label className="check-row">
          <input data-testid="apply-template" type="radio" name="apply" checked={saveToTemplate} onChange={() => setSaveToTemplate(true)} />
          <span>Today + save to template</span>
        </label>
      </fieldset>
    </section>
  )
}

function CatalogButton({ exercise, onChoose }: { exercise: Exercise; onChoose: () => void }) {
  return (
    <button type="button" className="list-btn" data-testid="catalog-add" data-name={exercise.name} onClick={onChoose}>
      <span>
        {exercise.name}
        {exercise.perSide ? <span className="tag">per side</span> : null}
      </span>
      <span>{equipmentLabel(exercise.equipment)}</span>
    </button>
  )
}
