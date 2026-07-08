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

  it('formats today timestamps in hours', () => {
    expect(formatSignalTimestamp(
      '2026-06-26T06:00:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('2 соат олдин')
  })

  it('formats yesterday timestamps with a clear day label and UTC+5 time', () => {
    expect(formatSignalTimestamp(
      '2026-06-25T06:30:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('Кеча 11:30')
  })

  it('formats exactly 24-hour-old timestamps by UTC+5 calendar day', () => {
    expect(formatSignalTimestamp(
      '2026-06-25T08:00:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('Кеча 13:00')
  })

  it('uses UTC+5 boundaries when deciding whether a timestamp is yesterday', () => {
    expect(formatSignalTimestamp(
      '2026-06-25T18:59:00.000Z',
      new Date('2026-06-25T19:01:00.000Z'),
    )).toBe('Кеча 23:59')
  })

  it('formats older timestamps as compact UTC+5 date with month name and time', () => {
    expect(formatSignalTimestamp(
      '2026-06-24T06:30:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('24 июн 11:30')
  })

  it('formats same-day future timestamps as UTC+5 HH:MM', () => {
    expect(formatSignalTimestamp(
      '2026-06-26T09:15:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('14:15')
  })

  it('formats future timestamps outside today with compact UTC+5 date with month name and time', () => {
    expect(formatSignalTimestamp(
      '2026-06-27T09:15:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('27 июн 14:15')
  })

  it('includes the year when the timestamp is outside the current UTC+5 year', () => {
    expect(formatSignalTimestamp(
      '2025-12-30T20:30:00.000Z',
      new Date('2026-06-26T08:00:00.000Z'),
    )).toBe('31 дек 2025 01:30')
  })
})
