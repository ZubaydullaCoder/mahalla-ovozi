import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export type OpsSectionKey = 'simulator' | 'pipeline-log' | 'keyword-registry' | 'signals-browser' | 'health'

const OPS_SECTION_KEYS: OpsSectionKey[] = [
  'simulator',
  'pipeline-log',
  'keyword-registry',
  'signals-browser',
  'health',
]

export function parseOpsSection(value: string | null): OpsSectionKey {
  return OPS_SECTION_KEYS.includes(value as OpsSectionKey)
    ? value as OpsSectionKey
    : 'simulator'
}

export function useOpsSectionState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSectionKey = parseOpsSection(searchParams.get('section'))

  const setActiveSectionKey = useCallback((sectionKey: OpsSectionKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('section', sectionKey)
      return next
    })
  }, [setSearchParams])

  return {
    activeSectionKey,
    setActiveSectionKey,
  }
}
