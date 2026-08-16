import { describe, expect, it } from 'vitest'
import { newAccountDefaults } from './data.js'

describe('new account defaults', () => {
  it('starts cash held and rate shock at zero', () => {
    expect(newAccountDefaults).toMatchObject({ cashHeld: 0, rateShock: 0 })
  })
})
