import type { SummaryAssertion } from './schema.js'

export type AssertionStatus = 'pass' | 'fail' | 'manual_review' | 'not_available'

export interface SummaryAssertionOutcome {
  property: SummaryAssertion['property']
  operator: SummaryAssertion['operator']
  status: AssertionStatus
}

export function evaluateSummaryAssertions(
  summaryText: string | undefined,
  assertions: SummaryAssertion[],
): SummaryAssertionOutcome[] {
  if (!summaryText) {
    return assertions.map(assertion => outcome(assertion, 'not_available'))
  }

  const normalized = normalize(summaryText)
  return assertions.map(assertion => {
    if (assertion.operator === 'manual_review') {
      return outcome(assertion, 'manual_review')
    }
    if (assertion.operator === 'expected_distinct_resident_count') {
      if (assertion.expectedCount === undefined) return outcome(assertion, 'not_available')
      const countPattern = new RegExp(
        `(?<!\\p{N})(?<!\\p{N}[.,])${assertion.expectedCount}(?!\\p{N}|[.,]\\p{N})`,
        'u',
      )
      return outcome(assertion, countPattern.test(normalized) ? 'pass' : 'fail')
    }

    const values = assertion.values
    if (!values || values.length === 0) return outcome(assertion, 'not_available')
    const required = assertion.operator.startsWith('required_')
    const patterns = assertion.operator.endsWith('_patterns')
    const matches = values.map(value => patterns
      ? safePatternTest(value, normalized)
      : normalized.includes(normalize(value)))
    const passed = required ? matches.every(Boolean) : matches.every(match => !match)
    return outcome(assertion, passed ? 'pass' : 'fail')
  })
}

function outcome(
  assertion: SummaryAssertion,
  status: AssertionStatus,
): SummaryAssertionOutcome {
  return {
    property: assertion.property,
    operator: assertion.operator,
    status,
  }
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('uz')
}

function safePatternTest(source: string, value: string): boolean {
  if (!isSafeSummaryPattern(source)) return false
  try {
    return new RegExp(source, 'iu').test(value)
  } catch {
    return false
  }
}

export function isSafeSummaryPattern(source: string): boolean {
  if (source.length === 0 || source.length > 200) return false
  if (/\\[1-9]|\\k<|(\.\*){2}/u.test(source)) return false
  return !/\((?:[^()]|\([^()]*\))*[+*][^)]*\)[+*?{]/u.test(source)
}
