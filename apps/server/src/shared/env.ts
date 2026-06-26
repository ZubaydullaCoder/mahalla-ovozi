import 'dotenv/config'
import { z } from 'zod'

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash'
const DEFAULT_SESSION_SECRET = 'change_this_to_a_random_string_in_production'

const EnvSchema = z.object({
  DATABASE_URL:            z.string().min(1),
  SESSION_SECRET:          z.string().min(1),
  NODE_ENV:                z.enum(['development', 'production', 'test']).default('development'),
  PORT:                    z.coerce.number().int().positive().default(3001),
  BOT_TOKEN:               z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  FILTER_MODE:             z.literal('keyword_gate').default('keyword_gate'),
  AI_PROVIDER:             z.enum(['gemini', 'ollama', 'openai-compatible', 'rule-only']).default('gemini'),
  AI_API_KEY:              optionalTrimmedString(),
  AI_MODEL:                z.string().trim().min(1).default(GEMINI_DEFAULT_MODEL),
  AI_BASE_URL:             optionalTrimmedString(),
  AI_TIMEOUT_MS:           z.coerce.number().int().positive().default(30000),
  CLASSIFIER_BATCH_SIZE:   z.coerce.number().int().positive().default(100),
  OPS_ENABLED:             z.string().optional(),
  OPS_SECRET:              z.string().optional(),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production'
    && (env.SESSION_SECRET.length < 32 || env.SESSION_SECRET === DEFAULT_SESSION_SECRET)) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      path:    ['SESSION_SECRET'],
      message: 'SESSION_SECRET must be a random value with at least 32 characters in production',
    })
  }

  if ((env.AI_PROVIDER === 'gemini' || env.AI_PROVIDER === 'openai-compatible') && !env.AI_API_KEY) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      path:    ['AI_API_KEY'],
      message: `AI_API_KEY is required when AI_PROVIDER=${env.AI_PROVIDER}`,
    })
  }

  if ((env.AI_PROVIDER === 'ollama' || env.AI_PROVIDER === 'openai-compatible')
    && env.AI_MODEL === GEMINI_DEFAULT_MODEL) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      path:    ['AI_MODEL'],
      message: `AI_MODEL must be set to a non-Gemini model when AI_PROVIDER=${env.AI_PROVIDER}`,
    })
  }

  if (env.AI_PROVIDER === 'openai-compatible' && !env.AI_BASE_URL) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      path:    ['AI_BASE_URL'],
      message: 'AI_BASE_URL is required when AI_PROVIDER=openai-compatible',
    })
  }
})

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return EnvSchema.parse(input)
}

export const env = parseEnv(process.env)

function optionalTrimmedString() {
  return z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).optional(),
  )
}
