import type { IRouter } from 'express'
import { env } from '../shared/env.js'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { getActiveDistrict } from './route-helpers.js'

export function registerPipelineRoutes(router: IRouter): void {
  router.get('/pipeline-events', async (req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const limit = parsePipelineLimit(req.query['limit'])

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

  // ── Pipeline event log clear — simulated events only ─────────────────────────
  router.delete('/pipeline-events/simulated', async (_req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.pipelineEvent.deleteMany({
        where: {
          district_id:        district.id,
          telegram_update_id: { lt: 0 },
        },
      })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete simulated pipeline-events failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete simulated pipeline events failed' })
    }
  })

  // ── Pipeline event log clear — all events (requires confirm token) ────────────
  router.delete('/pipeline-events', async (req, res) => {
    if (req.query['confirm'] !== 'CLEAR_PIPELINE_EVENTS') {
      return res.status(400).json({
        statusCode: 400,
        error:      'Bad Request',
        message:    'Missing or wrong confirm param. Pass ?confirm=CLEAR_PIPELINE_EVENTS to proceed.',
      })
    }
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.pipelineEvent.deleteMany({
        where: { district_id: district.id },
      })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete all pipeline-events failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete all pipeline events failed' })
    }
  })

  router.get('/filtering-mode', (_req, res) => {
    return res.json({ filterMode: env.FILTER_MODE })
  })
}

function parsePipelineLimit(value: unknown): number {
  const requestedLimit = Number(value)
  return Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
    : 100
}
