// @vitest-environment jsdom
// apps/web/src/components/signal-card/signal-card.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { SignalCard } from './signal-card.tsx'
import type { Signal } from '../../api/signals.ts'

const baseSignal: Signal = {
  id: 1,
  telegramUpdateId: 100,
  telegramMessageId: 200,
  telegramMessageUrl: null,
  districtId: 1,
  mahallaId: 2,
  mahallaName: 'Навбаҳор маҳалласи',
  senderDisplayName: 'Alisher',
  senderUsername: null,
  telegramTimestamp: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
  rawText: 'Газ йўқ, уй совуқ',
  textSource: 'text',
  category: 'gas',
  hokimRelated: false,
  keywordMatched: true,
  matchedKeyword: 'gaz',
  shortLabel: null,
  classifiedAt: new Date().toISOString(),
}

const renderCard = (props: Partial<Parameters<typeof SignalCard>[0]> = {}) => {
  const onClick = vi.fn()
  render(
    <ConfigProvider>
      <SignalCard
        signal={baseSignal}
        isActive={false}
        categoryColor="#1A7060"
        onClick={onClick}
        {...props}
      />
    </ConfigProvider>,
  )
  return { onClick }
}

// Helper: get the signal-card element from potentially multiple articles
function getSignalCard(): HTMLElement {
  const articles = screen.getAllByRole('article')
  const card = articles.find((el) => el.classList.contains('signal-card'))
  if (!card) throw new Error('signal-card not found')
  return card
}

describe('SignalCard', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })
  it('renders sender display name, mahalla, and raw text', () => {
    renderCard()
    expect(screen.getByText('Alisher')).toBeTruthy()
    expect(screen.getByText('Навбаҳор маҳалласи')).toBeTruthy()
    expect(screen.getByText('Газ йўқ, уй совуқ')).toBeTruthy()
  })

  it('sender fallback: no displayName → shows @username', () => {
    renderCard({ signal: { ...baseSignal, senderDisplayName: null, senderUsername: 'alisher' } })
    expect(screen.getByText('@alisher')).toBeTruthy()
  })

  it('sender fallback: no displayName and no username → shows Резидент', () => {
    renderCard({ signal: { ...baseSignal, senderDisplayName: null, senderUsername: null } })
    expect(screen.getByText('Резидент')).toBeTruthy()
  })

  it('timestamp is relative (дақ. олдин) for signals ≤24h', () => {
    // baseSignal is 5 min ago
    renderCard()
    // getAllByText because timestamp also appears in aria-label
    expect(screen.getAllByText(/дақ\. олдин/).length).toBeGreaterThan(0)
  })

  it('timestamp shows yesterday label at exactly 24h old', () => {
    const now = new Date('2026-06-14T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    renderCard({
      signal: {
        ...baseSignal,
        telegramTimestamp: new Date(now.getTime() - 24 * 3600000).toISOString(),
      },
    })

    expect(screen.getAllByText('Кеча 17:00').length).toBeGreaterThan(0)
  })

  it('timestamp includes compact month-name date and time for signals older than yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T12:00:00.000Z'))

    renderCard({ signal: { ...baseSignal, telegramTimestamp: '2026-06-12T06:30:00.000Z' } })
    // getAllByText because timestamp also appears in aria-label
    const matches = screen.getAllByText('12 июн 11:30')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('CaptionBadge 📷 shown when textSource === caption', () => {
    renderCard({ signal: { ...baseSignal, textSource: 'caption' } })
    const badge = screen.getByRole('img', { name: 'Расм тавсифи' })
    expect(badge).toBeTruthy()
  })

  it('CaptionBadge NOT shown when textSource === text', () => {
    renderCard()
    // query specifically by exact aria-label to avoid AntD internal icons
    expect(
      screen.queryByRole('img', { name: 'Расм тавсифи' }),
    ).toBeNull()
  })

  it('HokimStar ★ shown when hokimRelated === true', () => {
    renderCard({ signal: { ...baseSignal, hokimRelated: true } })
    expect(screen.getByText('★')).toBeTruthy()
  })

  it('HokimStar NOT shown when hokimRelated === false', () => {
    renderCard()
    // HokimStar is aria-hidden, query by text content within signal-card
    const card = getSignalCard()
    expect(card.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('onClick fires on click', async () => {
    const user = userEvent.setup()
    const { onClick } = renderCard()
    const card = getSignalCard()
    await user.click(card)
    expect(onClick).toHaveBeenCalledWith(baseSignal)
  })

  it('onClick fires on Enter keydown', async () => {
    const user = userEvent.setup()
    const { onClick } = renderCard()
    const card = getSignalCard()
    card.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledWith(baseSignal)
  })

  it('onClick fires on Space keydown', async () => {
    const user = userEvent.setup()
    const { onClick } = renderCard()
    const card = getSignalCard()
    card.focus()
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledWith(baseSignal)
  })

  it('renders the category color as the full border when active', () => {
    renderCard({ isActive: true })
    const card = getSignalCard()
    expect(card).toHaveStyle({
      border: '1.5px solid #1A7060',
    })
  })

  it('renders a light gray border when inactive', () => {
    renderCard()
    const card = getSignalCard()
    expect(card).toHaveStyle({
      border: '1.5px solid #E2E8F0',
    })
  })

  it('has role=article and tabIndex=0', () => {
    renderCard()
    // Use getAllByRole to handle any duplicates from AntD internals
    const articles = screen.getAllByRole('article')
    // Find the signal-card element
    const card = articles.find((el) => el.classList.contains('signal-card'))
    expect(card).toBeDefined()
    expect(card!.getAttribute('tabindex')).toBe('0')
  })
})
