import { GoogleGenAI } from '@google/genai'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { env } from '../shared/env.js'
import { buildPrompt } from './prompt.js'
import { ClassifierOutputSchema, type ClassifierOutput } from './schema.js'

const ai = new GoogleGenAI({ apiKey: env.AI_API_KEY })

export async function classifyMessage(text: string): Promise<ClassifierOutput> {
  const response = await ai.models.generateContent({
    model:    env.AI_MODEL,
    contents: buildPrompt(text),
    config:   {
      responseMimeType: 'application/json',
      responseJsonSchema: zodToJsonSchema(ClassifierOutputSchema),
      temperature: 0,
    },
  })

  // P-2: `??` only catches null/undefined — an empty string from a safety-blocked
  // or quota-exhausted response would reach JSON.parse('') and throw a bare
  // SyntaxError with no diagnostic context.
  const rawText = response.text
  if (!rawText) {
    throw new Error(
      'AI returned empty or null response (possible safety block or quota exhaustion)',
    )
  }
  const rawJson: unknown = JSON.parse(rawText)

  const result = ClassifierOutputSchema.safeParse(rawJson)

  if (!result.success) {
    throw new Error(`AI output schema invalid: ${result.error.message}`)
  }

  return result.data
}
