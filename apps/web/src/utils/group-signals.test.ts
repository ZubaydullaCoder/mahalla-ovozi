// apps/web/src/utils/group-signals.test.ts
import { describe, it, expect } from 'vitest'
import { groupSignals } from './group-signals.ts'
import type { Signal } from '../api/signals.ts'

const mockSignal = (id: number, category: Signal['category'], hokimRelated = false): Signal => ({
  id,
  telegramUpdateId: id * 10,
  telegramMessageId: id * 100,
  telegramMessageUrl: null,
  districtId: 1,
  mahallaId: 2,
  mahallaName: 'Test Mahalla',
  senderDisplayName: 'Sender',
  senderUsername: 'sender',
  telegramTimestamp: '2026-07-10T12:00:00Z',
  rawText: 'Test text',
  textSource: 'text',
  category,
  hokimRelated,
  keywordMatched: false,
  matchedKeyword: null,
  shortLabel: null,
  aiSummary: null,
  classifiedAt: '2026-07-10T12:05:00Z',
})

describe('groupSignals', () => {
  it('should return empty lanes for empty inputs', () => {
    const result = groupSignals([])
    expect(result).toEqual({
      hokim: [],
      water: [],
      electricity: [],
      gas: [],
      waste: [],
    })
  })

  it('should distribute service categories to their respective lanes', () => {
    const s1 = mockSignal(1, 'water')
    const s2 = mockSignal(2, 'electricity')
    const s3 = mockSignal(3, 'gas')
    const s4 = mockSignal(4, 'waste')
    const result = groupSignals([s1, s2, s3, s4])

    expect(result.water).toEqual([s1])
    expect(result.electricity).toEqual([s2])
    expect(result.gas).toEqual([s3])
    expect(result.waste).toEqual([s4])
    expect(result.hokim).toEqual([])
  })

  it('should duplicate hokimRelated signals into the hokim lane and preserve object identity', () => {
    const s1 = mockSignal(1, 'water', true)
    const s2 = mockSignal(2, 'gas', false)
    const result = groupSignals([s1, s2])

    expect(result.water).toEqual([s1])
    expect(result.gas).toEqual([s2])
    expect(result.hokim).toEqual([s1])
    expect(result.hokim[0]).toBe(s1)
  })

  it('should exclude non-Hokim signals from Hokim lane', () => {
    const s1 = mockSignal(1, 'water', false)
    const result = groupSignals([s1])
    expect(result.hokim).toEqual([])
  })

  it('should maintain stable order matching the input array', () => {
    const s1 = mockSignal(1, 'water')
    const s2 = mockSignal(2, 'water')
    const s3 = mockSignal(3, 'water')
    const result = groupSignals([s1, s3, s2])

    expect(result.water).toEqual([s1, s3, s2])
  })
})
