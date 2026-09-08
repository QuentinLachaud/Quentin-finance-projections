import React, { forwardRef, useLayoutEffect, useRef, useState } from 'react'

// Keep the native number input when idle. During editing, use a text surface
// with a numeric keyboard so selection, decimal points and partial signs work.
export const numericText = (value) => value == null ? '' : String(value)
export const isCompleteNumber = (value) => {
  const text = String(value).trim()
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) && Number.isFinite(Number(text))
}

export function numericInputMode(step) {
  return step !== undefined && step !== null && step !== 'any' && Number.isInteger(Number(step)) ? 'numeric' : 'decimal'
}

export function numericValidationMessage(text, { min, max, step, required } = {}) {
  if (text === '' && !required) return ''
  if (text !== '' && !isCompleteNumber(text)) return 'Enter a valid number.'
  if (typeof document === 'undefined') return ''
  const input = document.createElement('input')
  input.type = 'number'
  if (min !== undefined && min !== null) input.min = String(min)
  if (max !== undefined && max !== null) input.max = String(max)
  if (step !== undefined && step !== null) input.step = String(step)
  input.required = Boolean(required)
  input.value = text
  return input.validity.valid ? '' : input.validationMessage
}

// A proxy preserves the event contract of the original native number input,
// including valueAsNumber and type, for existing application handlers.
export function numericChangeEvent(event, value) {
  const target = new Proxy(event.target, {
    get(element, property) {
      if (property === 'valueAsNumber') return value === '' ? NaN : Number(value)
      if (property === 'type') return 'number'
      if (property === 'value') return value
      const result = Reflect.get(element, property, element)
      return typeof result === 'function' ? result.bind(element) : result
    },
  })
  return new Proxy(event, {
    get(original, property) {
      if (property === 'target' || property === 'currentTarget') return target
      const result = Reflect.get(original, property, original)
      return typeof result === 'function' ? result.bind(original) : result
    },
  })
}

export const BrainDrainNumericInput = forwardRef(function BrainDrainNumericInput({
  type = 'text', value, defaultValue, onFocus, onChange, onBlur, onKeyDown,
  inputMode, min, max, step, required, disabled, readOnly, ...rest
}, forwardedRef) {
  const numeric = type === 'number'
  const [draft, setDraft] = useState(null)
  const [uncontrolledValue, setUncontrolledValue] = useState(() => numericText(defaultValue))
  const elementRef = useRef(null)
  const lastValue = useRef(null)
  const setRef = (element) => {
    elementRef.current = element
    if (typeof forwardedRef === 'function') forwardedRef(element)
    else if (forwardedRef) forwardedRef.current = element
  }
  useLayoutEffect(() => {
    if (!numeric || draft === null || !elementRef.current) return
    elementRef.current.setCustomValidity(numericValidationMessage(draft, { min, max, step, required }))
    // Selection must occur after the input switches from number to text.
    if (elementRef.current.dataset.selectOnFocus === 'true') {
      elementRef.current.select()
      delete elementRef.current.dataset.selectOnFocus
    }
  }, [numeric, draft, min, max, step, required])

  if (!numeric) return <input {...rest} type={type} value={value} defaultValue={defaultValue}
    onFocus={onFocus} onChange={onChange} onBlur={onBlur} onKeyDown={onKeyDown}
    inputMode={inputMode} min={min} max={max} step={step} required={required}
    disabled={disabled} readOnly={readOnly} ref={setRef} />

  const external = numericText(value === undefined ? uncontrolledValue : value)
  const visible = draft === null ? external : draft
  const forward = (event, text) => onChange?.(numericChangeEvent(event, text))
  const handleFocus = (event) => {
    if (!disabled && !readOnly) {
      lastValue.current = external
      const initial = external.trim() !== '' && Number(external) === 0 ? '' : external
      event.currentTarget.dataset.selectOnFocus = 'true'
      setDraft(initial)
    }
    onFocus?.(event)
  }
  const handleChange = (event) => {
    const text = event.target.value
    setDraft(text)
    event.target.setCustomValidity(numericValidationMessage(text, { min, max, step, required }))
    // Empty and incomplete values are editing states, not a request to save 0.
    if (isCompleteNumber(text)) {
      if (value === undefined) setUncontrolledValue(text)
      forward(event, text)
    }
  }
  const handleBlur = (event) => {
    const text = event.target.value
    if (text.trim() === '') {
      if (value === undefined) setUncontrolledValue('')
      forward(event, '')
    }
    else if (!isCompleteNumber(text)) {
      // Restore the last externally accepted value rather than save NaN.
      event.target.value = numericText(value === undefined ? uncontrolledValue : value)
    }
    event.target.setCustomValidity('')
    setDraft(null)
    onBlur?.(numericChangeEvent(event, event.target.value))
    lastValue.current = null
  }
  return <input {...rest} ref={setRef} type={draft === null ? 'number' : 'text'}
    data-numeric-input="true" inputMode={inputMode || numericInputMode(step)}
    value={visible} min={min} max={max} step={step} required={required}
    disabled={disabled} readOnly={readOnly} onFocus={handleFocus}
    onChange={handleChange} onBlur={handleBlur} onKeyDown={onKeyDown} />
})

export default BrainDrainNumericInput
