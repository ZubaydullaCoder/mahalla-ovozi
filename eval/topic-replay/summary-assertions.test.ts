import { describe, expect, it } from 'vitest'

import { evaluateSummaryAssertions } from './summary-assertions.js'

describe('evaluateSummaryAssertions', () => {
  it('normalizes text and evaluates declared operators only', () => {
    const outcomes = evaluateSummaryAssertions('АҲОЛИ сув йўқлигини хабар қилди.', [
      { property: 'attribution', operator: 'required_terms', values: ['аҳоли'] },
      { property: 'identity_omission', operator: 'forbidden_terms', values: ['@resident'] },
    ])

    expect(outcomes.map(outcome => outcome.status)).toEqual(['pass', 'pass'])
  })

  it('reports manual review and unavailable honestly', () => {
    expect(evaluateSummaryAssertions('Матн', [
      { property: 'contradiction', operator: 'manual_review' },
    ])[0]?.status).toBe('manual_review')
    expect(evaluateSummaryAssertions(undefined, [
      { property: 'attribution', operator: 'required_terms', values: ['аҳоли'] },
    ])[0]?.status).toBe('not_available')
  })

  it('supports patterns and distinct-resident counts without an AI judge', () => {
    const outcomes = evaluateSummaryAssertions('2 нафар аҳоли хабар қилди.', [
      { property: 'resident_count', operator: 'expected_distinct_resident_count', expectedCount: 2 },
      { property: 'attribution', operator: 'required_patterns', values: ['аҳоли\\s+хабар'] },
      { property: 'restoration_not_resolution', operator: 'forbidden_patterns', values: ['муаммо ҳал қилинди'] },
    ])

    expect(outcomes.every(outcome => outcome.status === 'pass')).toBe(true)
  })

  it('does not accept a fractional prefix as the expected resident count', () => {
    expect(evaluateSummaryAssertions('2.5 нафар аҳоли хабар қилди.', [{
      property: 'resident_count',
      operator: 'expected_distinct_resident_count',
      expectedCount: 2,
    }])[0]?.status).toBe('fail')
  })

  it('fails closed for an unsafe deterministic regex', () => {
    expect(evaluateSummaryAssertions('aaaaaaaaaaaaaaaa!', [{
      property: 'attribution',
      operator: 'required_patterns',
      values: ['(a+)+$'],
    }])[0]?.status).toBe('fail')
  })
})
