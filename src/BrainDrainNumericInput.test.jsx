// @vitest-environment jsdom
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
import NumericInput, { isCompleteNumber, numericChangeEvent, numericValidationMessage } from './BrainDrainNumericInput.jsx'

let root, host
function setup(initial = 0, props = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  function Form() {
    const [value, setValue] = React.useState(initial)
    return <NumericInput type="number" aria-label="Amount" value={value} onChange={event => setValue(Number(event.target.value))} {...props} />
  }
  act(() => root.render(<Form />))
  return host.querySelector('input')
}
function focus(input) { act(() => input.focus()) }
function type(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function blur(input) { act(() => input.blur()) }
afterEach(() => {
  if (root) act(() => root.unmount())
  host?.remove()
  root = host = null
})
describe('shared numerical editing', () => {
  it('clears zero on focus and accepts a replacement without a leading zero', () => {
    const input = setup(0)
    focus(input)
    expect(input.value).toBe('')
    expect(input.type).toBe('text')
    type(input, '123')
    expect(input.value).toBe('123')
    blur(input)
    expect(input.value).toBe('123')
    expect(input.type).toBe('number')
  })
  it('selects a nonzero value and permits backspace, empty and decimal intermediate states', () => {
    const input = setup(123)
    focus(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(3)
    type(input, '')
    expect(input.value).toBe('')
    type(input, '1.')
    expect(input.value).toBe('1.')
    type(input, '1.25')
    expect(input.value).toBe('1.25')
    blur(input)
    expect(input.value).toBe('1.25')
  })
  it('preserves a negative sign until a valid negative number is entered', () => {
    const input = setup(0, { min: -100, step: .01 })
    focus(input)
    type(input, '-')
    expect(input.value).toBe('-')
    type(input, '-5.25')
    blur(input)
    expect(input.value).toBe('-5.25')
  })
  it('keeps native number constraints and leaves unrelated text inputs unchanged', () => {
    const input = setup(5, { min: 1, max: 10, required: true })
    expect(input.min).toBe('1')
    expect(input.max).toBe('10')
    expect(input.required).toBe(true)
    focus(input)
    type(input, '11')
    expect(input.validity.valid).toBe(false)
    type(input, '5')
    expect(input.validity.valid).toBe(true)
    blur(input)
    const html = document.createElement('div')
    act(() => root.render(<NumericInput type="text" value="hello" readOnly />))
    expect(host.querySelector('input').value).toBe('hello')
    expect(host.querySelector('input').type).toBe('text')
  })
  it('recognises complete finite numbers without coercing partial states', () => {
    for (const value of ['', '-', '.', '1e', '1e-', 'Infinity', 'NaN']) expect(isCompleteNumber(value)).toBe(false)
    for (const value of ['0', '0.0', '-5', '.25', '1.', '1e-3']) expect(isCompleteNumber(value)).toBe(true)
    const target = { value: '5', type: 'text', valueAsNumber: NaN }
    const event = numericChangeEvent({ target }, '5.5')
    expect(event.target.valueAsNumber).toBe(5.5)
    expect(event.target.type).toBe('number')
    expect(numericValidationMessage('1.5', { min: 0, max: 10, step: 1 })).not.toBe('')
  })
})
