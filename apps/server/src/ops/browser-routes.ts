import type { IRouter } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { mapSignalRow } from '../signals/mapper.js'
import { getActiveDistrict, parsePositiveIntegerQueryParam } from './route-helpers.js'

const VALID_CATEGORIES = ['water', 'electricity', 'gas', 'waste'] as const

export function registerBrowserRoutes(router: IRouter): void {
  router.get('/signals', async (req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const category = VALID_CATEGORIES.includes(req.query['category'] as (typeof VALID_CATEGORIES)[number])
        ? (req.query['category'] as string)
        : undefined

      const mahallaIdRaw = Number(req.query['mahalla_id'])
      const mahallaId = Number.isInteger(mahallaIdRaw) && mahallaIdRaw > 0 ? mahallaIdRaw : undefined

      const hokimRelatedRaw = req.query['hokim_related']
      const hokimRelated = hokimRelatedRaw === 'true' ? true : hokimRelatedRaw === 'false' ? false : undefined

      const from = parseDateFilter(req.query['from'])
      const to   = parseDateFilter(req.query['to'])

      const page  = parsePositiveIntegerQueryParam(req.query['page'], 1)
      const limit = parsePositiveIntegerQueryParam(req.query['limit'], 50, 100)
      const skip  = (page - 1) * limit

      const where = {
        district_id:     district.id,
        ...(category !== undefined && { category }),
        ...(mahallaId !== undefined && { mahalla_id: mahallaId }),
        ...(hokimRelated !== undefined && { hokim_related: hokimRelated }),
        ...(from !== undefined || to !== undefined
          ? { telegram_timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) } }
          : {}),
      }

      const [rows, total] = await Promise.all([
        prisma.signalMessage.findMany({
          where,
          include: { mahalla: { select: { name: true, telegram_chat_id: true } } },
          orderBy: { telegram_timestamp: 'desc' },
          skip,
          take:    limit,
        }),
        prisma.signalMessage.count({ where }),
      ])

      return res.json({
        items: rows.map(mapSignalRow),
        total,
      })
    } catch (err) {
      logger.error({ err }, 'Ops signals query failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Signals query failed' })
    }
  })

  router.get('/raw-messages', async (req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const page  = parsePositiveIntegerQueryParam(req.query['page'], 1)
      const limit = parsePositiveIntegerQueryParam(req.query['limit'], 50, 100)
      const skip  = (page - 1) * limit

      const where = { district_id: district.id }

      const [rows, total] = await Promise.all([
        prisma.rawMessage.findMany({
          where,
          include: { mahalla: { select: { name: true } } },
          orderBy: { telegram_timestamp: 'desc' },
          skip,
          take:    limit,
        }),
        prisma.rawMessage.count({ where }),
      ])

      return res.json({
        items: rows.map(r => ({
          id:                r.id,
          mahallaId:         r.mahalla_id,
          mahallaName:       r.mahalla.name,
          text:              r.text,
          textSource:        r.text_source as 'text' | 'caption',
          keywordMatched:    r.keyword_matched,
          matchedKeyword:    r.matched_keyword,
          telegramTimestamp: r.telegram_timestamp.toISOString(),
          isSimulated:       r.telegram_update_id < 0,
        })),
        total,
      })
    } catch (err) {
      logger.error({ err }, 'Ops raw-messages query failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Raw messages query failed' })
    }
  })

  // ── Signal deletes — static routes BEFORE parameterised /:id ─────────────────

  router.delete('/signals/simulated', async (_req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.signalMessage.deleteMany({
        where: {
          district_id:        district.id,
          telegram_update_id: { lt: 0 },
        },
      })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete simulated signals failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete simulated signals failed' })
    }
  })

  router.delete('/signals', async (req, res) => {
    if (req.query['confirm'] !== 'DELETE_ALL_SIGNALS') {
      return res.status(400).json({
        statusCode: 400,
        error:      'Bad Request',
        message:    'Missing or wrong confirm param. Pass ?confirm=DELETE_ALL_SIGNALS to proceed.',
      })
    }
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.signalMessage.deleteMany({
        where: { district_id: district.id },
      })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete all signals failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete all signals failed' })
    }
  })

  router.delete('/signals/:id', async (req, res) => {
    const id = parsePositiveIntegerPathParam(req.params['id'])
    if (id === null) {
      return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid signal id' })
    }
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.signalMessage.deleteMany({
        where: { id, district_id: district.id },
      })
      if (result.count === 0) return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Signal not found or not in active district' })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete signal by id failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete signal failed' })
    }
  })

  // ── Raw-message deletes — static routes BEFORE parameterised /:id ─────────────

  router.delete('/raw-messages/simulated', async (_req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.rawMessage.deleteMany({
        where: {
          district_id:        district.id,
          telegram_update_id: { lt: 0 },
        },
      })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete simulated raw-messages failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete simulated raw messages failed' })
    }
  })

  router.delete('/raw-messages', async (req, res) => {
    if (req.query['confirm'] !== 'DELETE_ALL_RAW') {
      return res.status(400).json({
        statusCode: 400,
        error:      'Bad Request',
        message:    'Missing or wrong confirm param. Pass ?confirm=DELETE_ALL_RAW to proceed.',
      })
    }
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.rawMessage.deleteMany({
        where: { district_id: district.id },
      })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete all raw-messages failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete all raw messages failed' })
    }
  })

  router.delete('/raw-messages/:id', async (req, res) => {
    const id = parsePositiveIntegerPathParam(req.params['id'])
    if (id === null) {
      return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid raw-message id' })
    }
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const result = await prisma.rawMessage.deleteMany({
        where: { id, district_id: district.id },
      })
      if (result.count === 0) return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Raw message not found or not in active district' })
      return res.json({ deleted: result.count })
    } catch (err) {
      logger.error({ err }, 'Ops delete raw-message by id failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete raw message failed' })
    }
  })
}

function parseDateFilter(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate
}

function parsePositiveIntegerPathParam(value: string | undefined): number | null {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}
