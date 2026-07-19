import type { ReplayCase } from '../schema.js'
import type { ReplayAdapter } from './types.js'

export function createFixtureOutputAdapter(replayCase: ReplayCase): ReplayAdapter {
  return {
    name: 'fixture_output',
    authorityLabel: 'deterministic_fixture',
    async classifyStep(input) {
      const step = replayCase.adapterScript.steps[input.messageIndex]
      if (!step || step.messageKey !== input.message.key) {
        return {
          invalid: true,
        }
      }
      return structuredClone(step)
    },
  }
}
