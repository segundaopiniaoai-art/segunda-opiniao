import { getDateBoundaries } from '@/lib/admin/date-boundaries'

describe('getDateBoundaries', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('startOfToday is midnight São Paulo for a noon-SP moment', () => {
    // 2026-05-15 12:00 UTC == 2026-05-15 09:00 SP (UTC-3)
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const { startOfToday } = getDateBoundaries()
    // 00:00 SP on 2026-05-15 == 03:00 UTC the same date
    expect(startOfToday).toBe('2026-05-15T03:00:00.000Z')
  })

  it('startOfToday uses SP calendar date when UTC and SP are on different days', () => {
    // 2026-05-15 02:00 UTC == 2026-05-14 23:00 SP — still "today" = 2026-05-14 in SP
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T02:00:00Z'))

    const { startOfToday } = getDateBoundaries()
    expect(startOfToday).toBe('2026-05-14T03:00:00.000Z')
  })

  it('sevenDaysAgo is exactly 168h before now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const { sevenDaysAgo } = getDateBoundaries()
    expect(sevenDaysAgo).toBe('2026-05-08T12:00:00.000Z')
  })

  it('thirtyDaysAgo is exactly 720h before now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const { thirtyDaysAgo } = getDateBoundaries()
    expect(thirtyDaysAgo).toBe('2026-04-15T12:00:00.000Z')
  })

  it('handles month-end correctly for "today" in SP', () => {
    // 2026-06-01 02:30 UTC == 2026-05-31 23:30 SP — today is still 31/05 in SP
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T02:30:00Z'))

    const { startOfToday } = getDateBoundaries()
    expect(startOfToday).toBe('2026-05-31T03:00:00.000Z')
  })

  it('handles year-end correctly for "today" in SP', () => {
    // 2027-01-01 02:30 UTC == 2026-12-31 23:30 SP
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T02:30:00Z'))

    const { startOfToday } = getDateBoundaries()
    expect(startOfToday).toBe('2026-12-31T03:00:00.000Z')
  })
})
