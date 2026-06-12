import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL:            z.string().min(1),
  SESSION_SECRET:          z.string().min(1),
  NODE_ENV:                z.enum(['development', 'production', 'test']).default('development'),
  PORT:                    z.coerce.number().int().positive().default(3001),
  BOT_TOKEN:               z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  FILTER_MODE:             z.enum(['ai_full', 'keyword_gate', 'shadow_compare']).default('keyword_gate'),
  AI_API_KEY:              z.string().min(1),
  AI_MODEL:                z.string().min(1).default('gemini-2.5-flash'),
})

export const env = EnvSchema.parse(process.env)
