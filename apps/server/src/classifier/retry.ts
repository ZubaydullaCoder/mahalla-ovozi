import { logger } from '../shared/logger.js'
import { classifyMessage } from './ai-client.js'
import type { ClassifierOutput } from './schema.js'

export async function classifyMessageWithRetry(
  text: string,
  maxAttempts = 3,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<ClassifierOutput> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await classifyMessage(text)
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        logger.warn({ attempt, err }, 'AI classification attempt failed; retrying')
        await sleepFn(100 * 2 ** (attempt - 1))
      }
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
