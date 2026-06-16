// @vitest-environment jsdom
// apps/web/src/components/filter-bar/time-range-chips.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { TimeRangeChips } from './time-range-chips.tsx'
import type { TimeRangePreset } from '../../hooks/use-filters.ts'

afterEach(() => {
  cleanup()
})

function renderChips(
  activePreset: TimeRangePreset = 'today',
  onSelect: (p: TimeRangePreset) => void = vi.fn()
) {
  render(
    <ConfigProvider>
      <TimeRangeChips activePreset={activePreset} onSelect={onSelect} />
    </ConfigProvider>
  )
}

describe('TimeRangeChips', () => {
  describe('labels render', () => {
    it('renders all 6 Uzbek Cyrillic chip labels', () => {
      renderChips()
      expect(screen.getByRole('button', { name: '1 соат' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '3 соат' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '6 соат' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Бугун' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Кеча' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '7 кун' })).toBeInTheDocument()
    })

    it('renders exactly 6 chip buttons', () => {
      renderChips()
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(6)
    })
  })

  describe('active chip styling', () => {
    it('active chip has #EEF0FD background', () => {
      renderChips('today')
      const activeButton = screen.getByRole('button', { name: 'Бугун' })
      expect(activeButton).toHaveStyle({ background: '#EEF0FD' })
    })

    it('non-active chips do not have #EEF0FD background', () => {
      renderChips('today')
      const inactiveButton = screen.getByRole('button', { name: '1 соат' })
      expect(inactiveButton).not.toHaveStyle({ background: '#EEF0FD' })
    })

    it('switches active styling when a different preset is active', () => {
      renderChips('1h')
      const activeButton = screen.getByRole('button', { name: '1 соат' })
      const inactiveButton = screen.getByRole('button', { name: 'Бугун' })
      expect(activeButton).toHaveStyle({ background: '#EEF0FD' })
      expect(inactiveButton).not.toHaveStyle({ background: '#EEF0FD' })
    })
  })

  describe('click interaction', () => {
    it('calls onSelect with the correct preset key when a chip is clicked', async () => {
      const onSelect = vi.fn()
      renderChips('today', onSelect)

      await userEvent.click(screen.getByRole('button', { name: '1 соат' }))
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith('1h')
    })

    it('calls onSelect with "yesterday" when Кеча chip is clicked', async () => {
      const onSelect = vi.fn()
      renderChips('today', onSelect)

      await userEvent.click(screen.getByRole('button', { name: 'Кеча' }))
      expect(onSelect).toHaveBeenCalledWith('yesterday')
    })

    it('calls onSelect with "7d" when 7 кун chip is clicked', async () => {
      const onSelect = vi.fn()
      renderChips('today', onSelect)

      await userEvent.click(screen.getByRole('button', { name: '7 кун' }))
      expect(onSelect).toHaveBeenCalledWith('7d')
    })
  })

  describe('keyboard accessibility', () => {
    it('can tab to chips (they are native buttons)', async () => {
      const onSelect = vi.fn()
      renderChips('today', onSelect)

      // Tab to first chip
      await userEvent.tab()
      // The first tabbable element should be a button
      const focused = document.activeElement
      expect(focused?.tagName).toBe('BUTTON')
    })

    it('triggers onSelect with Enter key on focused chip', async () => {
      const onSelect = vi.fn()
      renderChips('today', onSelect)

      // Tab to the first chip and press Enter
      await userEvent.tab()
      await userEvent.keyboard('{Enter}')
      expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('triggers onSelect with Space key on focused chip', async () => {
      const onSelect = vi.fn()
      renderChips('today', onSelect)

      // Tab to the first chip and press Space
      await userEvent.tab()
      await userEvent.keyboard(' ')
      expect(onSelect).toHaveBeenCalledTimes(1)
    })
  })

  describe('all chip buttons have type="button"', () => {
    it('no chip accidentally submits a form (type must be "button")', () => {
      renderChips()
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })
  })
})
