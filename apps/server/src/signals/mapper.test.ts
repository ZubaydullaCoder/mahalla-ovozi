// apps/server/src/signals/mapper.test.ts
import { describe, it, expect } from 'vitest'
import { buildTelegramMessageUrl, mapSignalRow } from './mapper.js'
import type { SignalMessageWithMahalla } from './mapper.js'

// A valid, complete mock row that satisfies SignalMessageWithMahalla.
// We use `as unknown as SignalMessageWithMahalla` so we can construct a
// plain object without pulling in Prisma type machinery in tests.
const BASE_ROW = {
  id:                   1,
  telegram_update_id:   100,
  telegram_message_id:  200,
  district_id:          1,
  mahalla_id:           2,
  sender_display_name:  'Alisher',
  sender_username:      'alisher',
  telegram_timestamp:   new Date('2026-06-14T10:00:00.000Z'),
  raw_text:             "Gaz yo'q",
  text_source:          'text',
  category:             'gas',
  hokim_related:        false,
  keyword_matched:      true,
  matched_keyword:      'gaz',
  short_label:          null,
  classified_at:        new Date('2026-06-14T10:20:00.000Z'),
  mahalla: {
    name:             'Navbahor',
    telegram_chat_id: -1009876543210n,
  },
} as unknown as SignalMessageWithMahalla

// ─── buildTelegramMessageUrl ──────────────────────────────────────────────────

describe('buildTelegramMessageUrl', () => {
  it('returns correct URL for a valid supergroup chatId and messageId', () => {
    expect(buildTelegramMessageUrl(-1001234567890n, 42)).toBe(
      'https://t.me/c/1234567890/42',
    )
  })

  it('returns null when chatId is null', () => {
    expect(buildTelegramMessageUrl(null, 42)).toBeNull()
  })

  it('returns null when messageId is null', () => {
    expect(buildTelegramMessageUrl(-1001234567890n, null)).toBeNull()
  })

  it('returns null when chatId does not have -100 prefix (non-supergroup)', () => {
    expect(buildTelegramMessageUrl(1234567890n, 42)).toBeNull()
  })

  it('returns null when chatId is exactly -100 with no internal ID', () => {
    expect(buildTelegramMessageUrl(-100n, 42)).toBeNull()
  })
})

// ─── mapSignalRow ─────────────────────────────────────────────────────────────

describe('mapSignalRow', () => {
  it('maps the full DB row to the exact Signal shape', () => {
    expect(mapSignalRow(BASE_ROW)).toEqual({
      id:                   1,
      telegramUpdateId:     100,
      telegramMessageId:    200,
      telegramMessageUrl:   'https://t.me/c/9876543210/200',
      districtId:           1,
      mahallaId:            2,
      mahallaName:          'Navbahor',
      senderDisplayName:    'Alisher',
      senderUsername:       'alisher',
      telegramTimestamp:    '2026-06-14T10:00:00.000Z',
      rawText:              "Gaz yo'q",
      textSource:           'text',
      category:             'gas',
      hokimRelated:         false,
      keywordMatched:       true,
      matchedKeyword:       'gaz',
      shortLabel:           null,
      classifiedAt:         '2026-06-14T10:20:00.000Z',
    })
  })

  it('normalizes null sender_display_name to null', () => {
    const row = {
      ...BASE_ROW,
      sender_display_name: null,
    } as unknown as SignalMessageWithMahalla
    expect(mapSignalRow(row).senderDisplayName).toBeNull()
  })

  it('normalizes undefined sender_display_name to null', () => {
    const row = {
      ...BASE_ROW,
      sender_display_name: undefined,
    } as unknown as SignalMessageWithMahalla
    expect(mapSignalRow(row).senderDisplayName).toBeNull()
  })

  it('normalizes null sender_username to null', () => {
    const row = {
      ...BASE_ROW,
      sender_username: null,
    } as unknown as SignalMessageWithMahalla
    expect(mapSignalRow(row).senderUsername).toBeNull()
  })

  it('normalizes null matched_keyword to null', () => {
    const row = {
      ...BASE_ROW,
      matched_keyword: null,
    } as unknown as SignalMessageWithMahalla
    expect(mapSignalRow(row).matchedKeyword).toBeNull()
  })

  it('maps a non-null short_label', () => {
    const row = {
      ...BASE_ROW,
      short_label: 'Gas pipeline issue',
    } as unknown as SignalMessageWithMahalla
    expect(mapSignalRow(row).shortLabel).toBe('Gas pipeline issue')
  })

  it('returns null telegramMessageUrl when mahalla has null chatId', () => {
    const row = {
      ...BASE_ROW,
      mahalla: { ...BASE_ROW.mahalla, telegram_chat_id: null },
    } as unknown as SignalMessageWithMahalla
    expect(mapSignalRow(row).telegramMessageUrl).toBeNull()
  })

  it('returns null telegramMessageUrl when chatId is not a supergroup (non -100 prefix)', () => {
    const row = {
      ...BASE_ROW,
      mahalla: { ...BASE_ROW.mahalla, telegram_chat_id: 1234567890n },
    } as unknown as SignalMessageWithMahalla
    expect(mapSignalRow(row).telegramMessageUrl).toBeNull()
  })

  it('throws on invalid text_source DB value', () => {
    // Intentionally bypass TypeScript typing to simulate corrupt DB value
    const row = { ...BASE_ROW, text_source: 'photo' } as unknown as SignalMessageWithMahalla
    expect(() => mapSignalRow(row)).toThrow('Invalid signal text_source')
  })

  it('throws on invalid category DB value', () => {
    const row = { ...BASE_ROW, category: 'road' } as unknown as SignalMessageWithMahalla
    expect(() => mapSignalRow(row)).toThrow('Invalid signal category')
  })

  it('maps all valid textSource values', () => {
    for (const src of ['text', 'caption'] as const) {
      const row = { ...BASE_ROW, text_source: src } as unknown as SignalMessageWithMahalla
      expect(mapSignalRow(row).textSource).toBe(src)
    }
  })

  it('maps all valid category values', () => {
    for (const cat of ['water', 'electricity', 'gas', 'waste'] as const) {
      const row = { ...BASE_ROW, category: cat } as unknown as SignalMessageWithMahalla
      expect(mapSignalRow(row).category).toBe(cat)
    }
  })
})
