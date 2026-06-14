// apps/server/src/signals/index.ts
import { Router, type IRouter } from 'express'
import { logger } from '../shared/logger.js'
import { getTodayUTC5Range, querySignals } from './query.js'
import { mapSignalRow } from './mapper.js'

export const signalsRouter: IRouter = Router()

const ISO_DATETIME_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function parseDateQueryParam(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  if (!ISO_DATETIME_WITH_TIMEZONE.test(value)) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

signalsRouter.get('/signals', async (req, res) => {
  const districtId = req.session.districtId

  // requireAuth middleware guarantees this is set, but guard for TypeScript
  if (districtId === undefined) {
    return res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  let from: Date
  let to: Date

  const rawFrom = req.query['from']
  const rawTo = req.query['to']

  if (rawFrom !== undefined || rawTo !== undefined) {
    if (rawFrom === undefined || rawTo === undefined) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Both from and to query params are required when using date range',
      })
    }

    const parsedFrom = parseDateQueryParam(rawFrom)
    const parsedTo = parseDateQueryParam(rawTo)

    if (parsedFrom === null || parsedTo === null) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid date format for from or to params; use ISO 8601 datetime with timezone',
      })
    }

    if (parsedFrom.getTime() > parsedTo.getTime()) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'from must be before or equal to to',
      })
    }

    from = parsedFrom
    to = parsedTo
  } else {
    const range = getTodayUTC5Range()
    from = range.from
    to = range.to
  }

  try {
    const rows = await querySignals(districtId, from, to)
    const signals = rows.map(mapSignalRow)
    return res.json(signals)
  } catch (err) {
    logger.error({ err, districtId }, 'Signals query failed')
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to load signals',
    })
  }
})
