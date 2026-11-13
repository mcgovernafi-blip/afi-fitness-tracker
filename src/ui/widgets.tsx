import { useEffect, useRef, useState } from 'preact/hooks'
import { parseCount } from '../domain/dates'

export function Stepper({
  label,
  value,
  step,
  testId,
  onChange,
}: {
  label: string
  value: number | null
  step: number
  testId?: string
  onChange: (value: number | null) => void
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : String(value))
  }, [value])

  function shown(): number | null {
    const parsed = parseCount(text)
    return parsed === undefined ? value : parsed
  }

  function commit(next: number | null) {
    setText(next == null ? '' : String(next))
    onChange(next)
  }

  return (
    <div className="stepper">
      <button
        type="button"
        aria-label={`${label} decrease`}
        onClick={() => {
          const current = shown()
          commit(current == null ? null : Math.max(0, current - step))
        }}
      >
        −
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        data-testid={testId}
        value={text}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
        }}
        onInput={(event) => {
          const raw = (event.currentTarget as HTMLInputElement).value
          const parsed = parseCount(raw)
          setText(raw)
          if (parsed !== undefined) onChange(parsed)
        }}
      />
      <button
        type="button"
        aria-label={`${label} increase`}
        onClick={() => {
          const current = shown()
          commit(current == null ? step : Math.min(2000, current + step))
        }}
      >
        +
      </button>
    </div>
  )
}

export function Choice({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={selected ? 'chip on' : 'chip'} aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  )
}
