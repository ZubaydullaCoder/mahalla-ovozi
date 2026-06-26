import type { IRouter } from 'express'
import { z } from 'zod'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { injectSimulatedMessage, simulateWebhook } from './simulator.js'
import { getActiveDistrict } from './route-helpers.js'

const SimulateWebhookBodySchema = z.object({
  mahallaId:          z.number().int().positive(),
  senderDisplayName:  z.string().optional(),
  text:               z.string().min(1),
  textSource:         z.enum(['text', 'caption']).optional(),
  simulatedTimestamp: z.string().datetime().optional(),
})

const SimulateMessageBodySchema = z.object({
  mahallaId:          z.number().int().positive(),
  senderDisplayName:  z.string().optional(),
  senderUsername:     z.string().optional(),
  text:               z.string().min(1),
  textSource:         z.enum(['text', 'caption']).optional(),
  simulatedTimestamp: z.string().datetime().optional(),
})

export function registerSimulatorRoutes(router: IRouter): void {
  router.get('/mahallas', async (_req, res) => {
    try {
      const district = await getActiveDistrict()
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

  router.post('/simulate-webhook', async (req, res) => {
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

  router.post('/simulate-message', async (req, res) => {
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
}
