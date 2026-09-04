import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTRACTOR_TAGS, createCustomContractorTag, filterContractors, normalizeContractor,
  normalizeContractorTags, sortContractors,
} from './contractors.js'

const properties = [
  { id: 'btl-1', name: 'BTL1' },
  { id: 'btl-2', name: 'BTL2' },
]

describe('contractor domain model', () => {
  it('always exposes the seeded compliance and work tags without duplicating custom tags', () => {
    const tags = normalizeContractorTags([
      { id: 'custom-1', label: 'Boiler', iconKey: 'flame' },
      { id: 'duplicate-gas', label: 'GAS', iconKey: 'wrench' },
    ])
    expect(tags.slice(0, DEFAULT_CONTRACTOR_TAGS.length).map((tag) => tag.label)).toEqual(['GAS', 'EICR', 'PAT', 'Legionella', 'Repair', 'Install'])
    expect(tags.filter((tag) => tag.label === 'GAS')).toHaveLength(1)
    expect(tags.some((tag) => tag.label === 'Boiler' && tag.iconKey === 'flame')).toBe(true)
  })

  it('creates reusable custom tags with a safe supported icon', () => {
    const tag = createCustomContractorTag('  Emergency  ', 'not-an-icon')
    expect(tag.label).toBe('Emergency')
    expect(tag.iconKey).toBe('wrench')
    expect(tag.system).toBe(false)
  })

  it('normalizes BTL and tag relationships without retaining inaccessible ids', () => {
    const tags = normalizeContractorTags([{ id: 'boiler', label: 'Boiler', iconKey: 'flame' }])
    const contractor = normalizeContractor({
      id: 'c1', firstName: ' Sam ', lastName: ' Smith ', phone: ' 01234 ', trade: 'Gas Engineer',
      propertyIds: ['btl-1', 'missing', 'btl-1'], tagIds: ['gas', 'boiler', 'missing'],
      lastJobMonth: 15, lastJobYear: 2026,
    }, properties, tags)
    expect(contractor).toMatchObject({ firstName: 'Sam', lastName: 'Smith', phone: '01234', propertyIds: ['btl-1'], tagIds: ['gas', 'boiler'], lastJobMonth: 12, lastJobYear: 2026 })
  })

  it('sorts newest last job first by default and always leaves undated contacts at the bottom', () => {
    const contractors = [
      { firstName: 'No', lastName: 'Date', lastJobMonth: 0, lastJobYear: 0 },
      { firstName: 'Older', lastName: 'Job', lastJobMonth: 12, lastJobYear: 2025 },
      { firstName: 'Newest', lastName: 'Job', lastJobMonth: 2, lastJobYear: 2026 },
    ]
    expect(sortContractors(contractors).map((item) => item.firstName)).toEqual(['Newest', 'Older', 'No'])
    expect(sortContractors(contractors, 'last-asc').map((item) => item.firstName)).toEqual(['Older', 'Newest', 'No'])
  })

  it('combines BTL and trade filters before sorting', () => {
    const contractors = [
      { id: '1', firstName: 'A', lastName: 'One', trade: 'Gas Engineer', propertyIds: ['btl-1'], lastJobMonth: 1, lastJobYear: 2026 },
      { id: '2', firstName: 'B', lastName: 'Two', trade: 'Electrician', propertyIds: ['btl-1'], lastJobMonth: 3, lastJobYear: 2026 },
      { id: '3', firstName: 'C', lastName: 'Three', trade: 'Gas Engineer', propertyIds: ['btl-2'], lastJobMonth: 4, lastJobYear: 2026 },
    ]
    expect(filterContractors(contractors, { propertyId: 'btl-1', trade: 'Gas Engineer' }).map((item) => item.id)).toEqual(['1'])
    expect(filterContractors(contractors, { propertyId: 'btl-1', trade: 'all' }).map((item) => item.id)).toEqual(['2', '1'])
  })
})
