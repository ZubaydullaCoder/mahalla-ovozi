// apps/server/src/ops/index.ts
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { env } from '../shared/env.js'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { isBatchRunning, runClassifyBatchWithLock } from '../classifier/index.js'
import { simulateWebhook, injectSimulatedMessage } from './simulator.js'

export const opsRouter: IRouter = Router()

// ─── Combined ops guard ────────────────────────────────────────────────────────
// Runs at REQUEST time (not module load) so all guard branches are testable
// without module re-isolation.
opsRouter.use((req, res, next) => {
  // Gate 1: disabled in production or when OPS_ENABLED !== 'true'
  if (env.NODE_ENV === 'production' || env.OPS_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' })
  }

  // Gate 2: secret check or localhost-only
  const isLocalhost =
    req.ip === '127.0.0.1' ||
    req.ip === '::1' ||
    req.ip === '::ffff:127.0.0.1'

  if (env.OPS_SECRET) {
    // Secret configured — require it regardless of origin
    if (req.header('X-Ops-Secret') !== env.OPS_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    return next()
  }

  // No secret configured — localhost only
  if (!isLocalhost) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  return next()
})

// ─── GET /api/ops/batch-status ────────────────────────────────────────────────
opsRouter.get('/batch-status', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) {
      return res.status(503).json({ error: 'No active district' })
    }

    const [latestBatch, recentErrorBatches, queueDepth] = await Promise.all([
      prisma.batchHealth.findFirst({
        where: { district_id: district.id, completed_at: { not: null } },
        orderBy: { completed_at: 'desc' },
        select: {
          completed_at:               true,
          started_at:                 true,
          filter_mode:                true,
          messages_fetched:           true,
          signals_written:            true,
          ignored_count:              true,
          pre_filter_discards:        true,
          keyword_matched_count:      true,
          keyword_skipped_count:      true,
          keyword_ai_signal_count:    true,
          keyword_ai_ignore_count:    true,
          no_keyword_ai_signal_count: true,
          no_keyword_ai_ignore_count: true,
          error_message:              true,
        },
      }),
      prisma.batchHealth.findMany({
        where: {
          district_id:   district.id,
          completed_at:  { not: null },
          error_message: { not: null },
        },
        orderBy: { completed_at: 'desc' },
        take:    10,
        select:  { error_message: true, completed_at: true },
      }),
      prisma.rawMessage.count({
        where: { district_id: district.id },
      }),
    ])

    const lastBatchAt = latestBatch?.completed_at?.toISOString() ?? null
    const lastBatchDuration =
      latestBatch?.completed_at != null && latestBatch?.started_at != null
        ? latestBatch.completed_at.getTime() - latestBatch.started_at.getTime()
        : null

    const lastBatchResult = latestBatch
      ? {
          filterMode:               latestBatch.filter_mode,
          messagesFetched:          latestBatch.messages_fetched,
          signalsWritten:           latestBatch.signals_written,
          ignoredCount:             latestBatch.ignored_count,
          preFilterDiscards:        latestBatch.pre_filter_discards,
          keywordMatchedCount:      latestBatch.keyword_matched_count,
          keywordSkippedCount:      latestBatch.keyword_skipped_count,
          keywordAiSignalCount:     latestBatch.keyword_ai_signal_count,
          keywordAiIgnoreCount:     latestBatch.keyword_ai_ignore_count,
          noKeywordAiSignalCount:   latestBatch.no_keyword_ai_signal_count,
          noKeywordAiIgnoreCount:   latestBatch.no_keyword_ai_ignore_count,
          errors:                   latestBatch.error_message ?? null,
        }
      : null

    const recentErrors = recentErrorBatches.flatMap(batch => {
      if (batch.completed_at === null) return []
      return [{
        message:    batch.error_message ?? 'Unknown error',
        occurredAt: batch.completed_at.toISOString(),
      }]
    })

    return res.json({
      schedulerStatus:  isBatchRunning() ? 'running' : 'idle',
      lastBatchAt,
      lastBatchDuration,
      queueDepth,
      lastBatchResult,
      recentErrors,
    })
  } catch (err) {
    logger.error({ err }, 'Ops batch-status query failed')
    return res.status(500).json({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'Batch status query failed',
    })
  }
})

// ─── GET /api/ops/system-health ───────────────────────────────────────────────
opsRouter.get('/system-health', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) {
      return res.status(503).json({ error: 'No active district' })
    }

    // DB check with timing
    const dbStart = Date.now()
    let dbStatus: 'ok' | 'error' = 'ok'
    let dbLatencyMs: number | null = null
    try {
      await prisma.$queryRaw`SELECT 1`
      dbLatencyMs = Date.now() - dbStart
    } catch {
      dbStatus = 'error'
    }

    // Bot connectivity from mahallas
    const mahallas = await prisma.mahalla.findMany({
      where:  { district_id: district.id },
      select: { id: true, name: true, bot_status: true, bot_last_seen_at: true },
    })

    const botConnectivity = mahallas.map(m => ({
      mahallaId:     m.id,
      mahallaName:   m.name,
      botStatus:     m.bot_status as 'active' | 'removed' | 'unknown',
      botLastSeenAt: m.bot_last_seen_at?.toISOString() ?? null,
    }))

    // Overall bot status: 'ok' if any mahalla active, 'error' if none active
    const hasActive = mahallas.some(m => m.bot_status === 'active')
    const botStatus: 'ok' | 'error' = hasActive ? 'ok' : 'error'

    return res.json({
      database:  { status: dbStatus, latencyMs: dbLatencyMs },
      scheduler: {
        status:           isBatchRunning() ? 'running' : 'stopped',
        nextRunInSeconds: null, // node-cron v4 does not expose next-run time; Phase 1 acceptable
      },
      aiApi: {
        status:        'unknown', // on-demand only; auto-call would burn API quota
        lastCheckedAt: null,
      },
      bot:             { status: botStatus },
      botConnectivity,
    })
  } catch (err) {
    logger.error({ err }, 'Ops system-health query failed')
    return res.status(500).json({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'System health query failed',
    })
  }
})

// ─── GET /api/ops/mahallas ────────────────────────────────────────────────────
opsRouter.get('/mahallas', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const mahallas = await prisma.mahalla.findMany({
      where:   { district_id: district.id },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return res.json(mahallas)
  } catch (err) {
    logger.error({ err }, 'Ops mahallas query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Mahallas query failed' })
  }
})

// ─── POST /api/ops/simulate-webhook ──────────────────────────────────────────
const SimulateWebhookBodySchema = z.object({
  mahallaId:          z.number().int().positive(),
  senderDisplayName:  z.string().optional(),
  text:               z.string().min(1),
  textSource:         z.enum(['text', 'caption']).optional(),
  simulatedTimestamp: z.string().datetime().optional(),
})

opsRouter.post('/simulate-webhook', async (req, res) => {
  const parsed = SimulateWebhookBodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request', details: parsed.error.issues })
  try {
    const result = await simulateWebhook(parsed.data)
    return res.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'No active district') {
      return res.status(503).json({ error: 'No active district' })
    }
    if (err instanceof Error && err.message === 'Mahalla not found in active district') {
      return res.status(404).json({ error: 'Mahalla not found' })
    }
    logger.error({ err }, 'Ops simulate-webhook failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Simulate webhook failed' })
  }
})

// ─── POST /api/ops/simulate-message ──────────────────────────────────────────
const SimulateMessageBodySchema = z.object({
  mahallaId:          z.number().int().positive(),
  senderDisplayName:  z.string().optional(),
  senderUsername:     z.string().optional(),
  text:               z.string().min(1),
  textSource:         z.enum(['text', 'caption']).optional(),
  simulatedTimestamp: z.string().datetime().optional(),
})

opsRouter.post('/simulate-message', async (req, res) => {
  const parsed = SimulateMessageBodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request', details: parsed.error.issues })
  try {
    const rawMessageId = await injectSimulatedMessage(parsed.data)
    return res.json({ rawMessageId })
  } catch (err) {
    if (err instanceof Error && err.message === 'No active district') {
      return res.status(503).json({ error: 'No active district' })
    }
    if (err instanceof Error && err.message === 'Mahalla not found in active district') {
      return res.status(404).json({ error: 'Mahalla not found' })
    }
    logger.error({ err }, 'Ops simulate-message failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Simulate message failed' })
  }
})

// ─── GET /api/ops/pipeline-events ─────────────────────────────────────────────
opsRouter.get('/pipeline-events', async (req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const requestedLimit = Number(req.query['limit'])
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
      : 100

    const events = await prisma.pipelineEvent.findMany({
      where:   { district_id: district.id },
      orderBy: { created_at: 'desc' },
      take:    limit,
    })

    return res.json(events.map(e => ({
      id:               e.id,
      eventType:        e.event_type,
      districtId:       e.district_id,
      mahallaId:        e.mahalla_id,
      telegramUpdateId: e.telegram_update_id,
      rawMessageId:     e.raw_message_id,
      signalId:         e.signal_id,
      detail:           e.detail,
      createdAt:        e.created_at.toISOString(),
    })))
  } catch (err) {
    logger.error({ err }, 'Ops pipeline-events query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Pipeline events query failed' })
  }
})

// ─── POST /api/ops/trigger-batch ──────────────────────────────────────────────
opsRouter.post('/trigger-batch', (_req, res) => {
  if (isBatchRunning()) {
    return res.json({ status: 'locked' })
  }
  // Fire-and-forget — SPA polls /batch-status for completion
  runClassifyBatchWithLock('manual').catch((err: unknown) =>
    logger.error({ err }, 'Manual batch trigger failed')
  )
  return res.json({ triggered: true })
})
