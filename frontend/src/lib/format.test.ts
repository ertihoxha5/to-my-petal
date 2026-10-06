import { describe, expect, it } from 'vitest'
import { daysFromToday, dueLabel, parseDate, todayIso } from './format'

describe('date helpers', () => {
  it('parses calendar dates as local dates (no timezone shift)', () => {
    const d = parseDate('2026-03-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 1])
  })
  it('counts days from today', () => {
    expect(daysFromToday(todayIso())).toBe(0)
    expect(daysFromToday(todayIso(3))).toBe(3)
  })
  it('labels overdue reminders', () => {
    expect(dueLabel(todayIso(-2))).toBe('2 days overdue')
    expect(dueLabel(todayIso(0))).toBe('Today')
  })
})
