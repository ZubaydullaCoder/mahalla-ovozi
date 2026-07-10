// eval/run-classifier-eval.ts
import fs from 'fs'
import path from 'path'
import { classifyMessage } from '../apps/server/src/classifier/ai-client.js'
import { env } from '../apps/server/src/shared/env.js'

interface ExpectedOutput {
  decision: 'signal' | 'ignore'
  categories?: string[]
  hokimRelated?: boolean
}

interface EvalCase {
  id: string
  text: string
  expected: ExpectedOutput
}

async function run() {
  const casesPath = path.resolve(process.cwd(), 'eval/classifier-cases.jsonl')
  const examplePath = path.resolve(process.cwd(), 'eval/classifier-cases.example.jsonl')

  const targetPath = fs.existsSync(casesPath) ? casesPath : examplePath

  console.log(`Loading cases from: ${targetPath}`)
  const content = fs.readFileSync(targetPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim() !== '')

  const cases: EvalCase[] = lines.map((l, index) => {
    try {
      return JSON.parse(l) as EvalCase
    } catch (err) {
      console.error(`Error parsing line ${index + 1}: ${l}`)
      throw err
    }
  })

  console.log(`Running evaluation on ${cases.length} cases using provider: ${env.AI_PROVIDER} (${env.AI_MODEL})`)

  let passed = 0
  let failed = 0
  let categoryMatches = 0
  let falsePositives = 0
  let falseNegatives = 0

  const resultsTable: any[] = []

  for (const c of cases) {
    try {
      const actual = await classifyMessage(c.text)

      const actualHokimRelated = !!actual.hokim_related
      const expectedHokimRelated = !!c.expected.hokimRelated

      const actualCategories = (actual.categories || []).sort()
      const expectedCategories = (c.expected.categories || []).sort()

      const decisionPassed = actual.decision === c.expected.decision
      const categoriesPassed = actualCategories.join(',') === expectedCategories.join(',')
      const hokimPassed = actual.decision === 'ignore' || actualHokimRelated === expectedHokimRelated

      const isPassed = decisionPassed && categoriesPassed && hokimPassed

      if (isPassed) {
        passed++
      } else {
        failed++
      }

      if (categoriesPassed) {
        categoryMatches++
      }

      if (c.expected.decision === 'ignore' && actual.decision === 'signal') {
        falsePositives++
      }
      if (c.expected.decision === 'signal' && actual.decision === 'ignore') {
        falseNegatives++
      }

      resultsTable.push({
        id: c.id,
        text: c.text.length > 40 ? c.text.slice(0, 37) + '...' : c.text,
        expectedDecision: c.expected.decision,
        actualDecision: actual.decision,
        expectedCats: expectedCategories.join(','),
        actualCats: actualCategories.join(','),
        expectedHokim: expectedHokimRelated,
        actualHokim: actualHokimRelated,
        status: isPassed ? 'PASS' : 'FAIL',
      })
    } catch (err) {
      console.error(`Failed to evaluate case ${c.id}:`, err)
      failed++
      resultsTable.push({
        id: c.id,
        text: c.text,
        expectedDecision: c.expected.decision,
        actualDecision: 'ERROR',
        expectedCats: '',
        actualCats: '',
        expectedHokim: false,
        actualHokim: false,
        status: 'ERROR',
      })
    }
  }

  console.log('\n--- Evaluation Results Table ---')
  console.table(resultsTable)

  console.log('\n--- Metrics Summary ---')
  console.log(`Total Cases:       ${cases.length}`)
  console.log(`Passed:            ${passed}`)
  console.log(`Failed:            ${failed}`)
  console.log(`Pass Rate:         ${((passed / cases.length) * 100).toFixed(2)}%`)
  console.log(`Category Accuracy: ${((categoryMatches / cases.length) * 100).toFixed(2)}%`)
  console.log(`False Positives:   ${falsePositives}`)
  console.log(`False Negatives:   ${falseNegatives}`)

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Evaluation run aborted with error:', err)
  process.exit(1)
})
