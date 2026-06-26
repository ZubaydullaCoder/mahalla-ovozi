import { describe, expect, it } from 'vitest'
import { formatSignalTimestamp, getSignalSenderName } from './signal-display.ts'

describe('signal display helpers', () => {
  it('uses display name before username', () => {
    expect(getSignalSenderName({ senderDisplayName: 'Ali', senderUsername: 'ali' })).toBe('Ali')
  })

  it('falls back to username with @ prefix', () => {
    expect(getSignalSenderName({ senderDisplayName: null, senderUsername: 'ali' })).toBe('@ali')
  })

  it('falls back to resident label', () => {
    expect(getSignalSenderName({ senderDisplayName: null, senderUsername: null })).toBe('Резидент')
  })

  it('formats recent timestamps in minutes', () => {
    expect(formatSignalTimestamp(
      '2026-06-26T07:55:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('5 дақ. олдин')
  })

  it('formats timestamps up to 24 hours in hours', () => {
    expect(formatSignalTimestamp(
      '2026-06-25T08:00:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('24 соат олдин')
  })

  it('formats older timestamps as UTC+5 HH:MM', () => {
    expect(formatSignalTimestamp(
      '2026-06-25T06:30:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('11:30')
  })

  it('formats future timestamps as UTC+5 HH:MM', () => {
    expect(formatSignalTimestamp(
      '2026-06-26T09:15:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('14:15')
  })
})
