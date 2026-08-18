import { describe, expect, it } from 'vitest'
import {
  createCredential,
  filterCredentials,
  moveCredential,
  normalizeCredentials,
} from './credentials.js'

describe('IDs & Credentials helpers', () => {
  it('creates sensitive active rows by default', () => {
    const item = createCredential({ label: 'Gateway ID', value: '123456' })
    expect(item.id).toBeTruthy()
    expect(item).toMatchObject({
      label: 'Gateway ID',
      value: '123456',
      sensitive: true,
      archived: false,
    })
  })

  it('normalizes missing input to an empty list', () => {
    expect(normalizeCredentials(null)).toEqual([])
  })

  it('reorders rows by id without mutating the original array', () => {
    const items = [
      createCredential({ id: 'a', label: 'A' }),
      createCredential({ id: 'b', label: 'B' }),
      createCredential({ id: 'c', label: 'C' }),
    ]
    const moved = moveCredential(items, 'c', 'a')
    expect(moved.map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('leaves rows unchanged when drag ids are invalid', () => {
    const items = [createCredential({ id: 'a' }), createCredential({ id: 'b' })]
    expect(moveCredential(items, 'missing', 'a')).toBe(items)
    expect(moveCredential(items, 'a', 'a')).toBe(items)
  })

  it('filters active and archived rows independently', () => {
    const items = [
      createCredential({ id: 'active', label: 'Landlord registration', value: 'ABC' }),
      createCredential({ id: 'archived', label: 'Old filing code', value: 'XYZ', archived: true }),
    ]
    expect(filterCredentials(items, '', false).map((item) => item.id)).toEqual(['active'])
    expect(filterCredentials(items, '', true).map((item) => item.id)).toEqual(['archived'])
    expect(filterCredentials(items, 'filing', true).map((item) => item.id)).toEqual(['archived'])
  })

  it('searches label, value and notes', () => {
    const items = [
      createCredential({ id: 'one', label: 'Gateway', value: '123', notes: 'HMRC account' }),
      createCredential({ id: 'two', label: 'Office', value: 'Glasgow', notes: '' }),
    ]
    expect(filterCredentials(items, 'hmrc').map((item) => item.id)).toEqual(['one'])
    expect(filterCredentials(items, 'glasgow').map((item) => item.id)).toEqual(['two'])
  })
})
