// @vitest-environment jsdom
// apps/web/src/components/context-drawer/context-drawer.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { ContextDrawer } from './context-drawer.tsx'
import type { Signal } from '../../api/signals.ts'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Mock useSignalContext ────────────────────────────────────────────────────

const mockUseSignalContext = vi.fn()

vi.mock('../../api/signals.ts', () => ({
  useSignalContext: (signalId: number | null, params?: { from?: string; to?: string }) =>
    mockUseSignalContext(signalId, params),
}))

// ─── Signal fixture ───────────────────────────────────────────────────────────

const MOCK_SIGNAL: Signal = {
  id:                 1,
  telegramUpdateId:   100,
  telegramMessageId:  200,
  telegramMessageUrl: null,
  districtId:         1,
  mahallaId:          10,
  mahallaName:        'Навбаҳор',
  senderDisplayName:  'Test User',
  senderUsername:     null,
  telegramTimestamp:  '2026-06-24T05:42:00.000Z',
  rawText:            'Газ йўқ',
  textSource:         'text',
  category:           'gas',
  hokimRelated:       true,
  keywordMatched:     true,
  matchedKeyword:     'газ',
  shortLabel:         null,
  classifiedAt:       '2026-06-24T05:43:00.000Z',
}

const ANCHOR_CLICKED_AT = new Date('2026-06-24T05:42:00.000Z')

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderDrawer(props?: Partial<React.ComponentProps<typeof ContextDrawer>>) {
  return render(
    <ConfigProvider>
      <ContextDrawer
        anchorSignal={MOCK_SIGNAL}
        anchorClickedAt={ANCHOR_CLICKED_AT}
        isOpen={true}
        onClose={vi.fn()}
        {...props}
      />
    </ConfigProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContextDrawer', () => {
  // AC-3: Loading skeleton renders while data is fetching
  it('renders skeleton when isLoading=true', () => {
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: true })
    renderDrawer()
    // AntD Skeleton renders paragraphs with ant-skeleton class
    const skeleton = document.querySelector('.ant-skeleton')
    expect(skeleton).toBeTruthy()
  })

  // AC-6: Signal list renders when data loaded
  it('renders signal cards when data is loaded', () => {
    mockUseSignalContext.mockReturnValue({ data: [MOCK_SIGNAL], isLoading: false })
    renderDrawer()
    // DrawerSignalCard renders with role="article"
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  // AC-9: Only-anchor empty state — message appears when context has only the anchor
  it('shows only-anchor message when context has only the anchor signal', () => {
    mockUseSignalContext.mockReturnValue({ data: [MOCK_SIGNAL], isLoading: false })
    renderDrawer()
    expect(screen.getByText('Бу маҳаллада бошқа сигналлар топилмади')).toBeInTheDocument()
  })

  // AC-9: Only-anchor message NOT shown when there are other signals
  it('does NOT show only-anchor message when multiple signals are returned', () => {
    const SECOND_SIGNAL: Signal = { ...MOCK_SIGNAL, id: 2, rawText: 'Иккинчи сигнал' }
    mockUseSignalContext.mockReturnValue({ data: [MOCK_SIGNAL, SECOND_SIGNAL], isLoading: false })
    renderDrawer()
    expect(screen.queryByText('Бу маҳаллада бошқа сигналлар топилмади')).not.toBeInTheDocument()
  })

  // AC-2: Breadcrumb uses service category for hokim-lane signal (NOT 'Ҳокимга тегишли')
  it('breadcrumb uses service category for hokim-lane signal (gas, hokimRelated=true)', () => {
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: false })
    renderDrawer()
    // AntD Drawer renders title in .ant-drawer-title
    const titleEl = document.querySelector('.ant-drawer-title')
    expect(titleEl).toBeTruthy()
    // Should contain 'Газ' (service category)
    expect(titleEl?.textContent).toContain('Газ')
    // Must NOT say 'Ҳокимга тегишли' (hokim lane label)
    expect(titleEl?.textContent).not.toContain('Ҳокимга тегишли')
    // Should also contain mahalla name
    expect(titleEl?.textContent).toContain('Навбаҳор')
  })

  // AC-11: useSignalContext called with anchor id and contextParams
  it('passes anchor id and contextParams to useSignalContext', () => {
    const contextParams = { from: '2026-06-23T19:00:00.000Z', to: '2026-06-24T18:59:59.999Z' }
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: false })
    renderDrawer({ contextParams })
    expect(mockUseSignalContext).toHaveBeenCalledWith(MOCK_SIGNAL.id, contextParams)
  })

  // AC-11: useSignalContext called with undefined contextParams when not provided
  it('passes undefined contextParams when not provided (client-side preset)', () => {
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: false })
    renderDrawer({ contextParams: undefined })
    expect(mockUseSignalContext).toHaveBeenCalledWith(MOCK_SIGNAL.id, undefined)
  })

  // AC-7: Drawer renders closed when isOpen=false
  it('drawer body is not visible when isOpen=false', () => {
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: false })
    renderDrawer({ isOpen: false })
    // When closed, drawer body should not be in the document
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
