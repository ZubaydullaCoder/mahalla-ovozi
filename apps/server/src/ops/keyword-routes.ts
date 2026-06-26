import type { IRouter } from 'express'
import { z } from 'zod'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { getActiveDistrict, isPrismaUniqueConstraintError } from './route-helpers.js'

const AddKeywordBodySchema = z.object({
  phrase: z.string()
    .transform(s => s.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1).max(120)),
})

const PatchKeywordBodySchema = z.object({
  isActive: z.boolean(),
}).strict()

export function registerKeywordRoutes(router: IRouter): void {
  router.get('/keywords', async (_req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const keywords = await prisma.keyword.findMany({
        where:   { district_id: district.id },
        orderBy: [{ is_active: 'desc' }, { phrase: 'asc' }],
      })

      return res.json(keywords.map(k => mapKeyword(k)))
    } catch (err) {
      logger.error({ err }, 'Ops keywords list failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keywords query failed' })
    }
  })

  router.post('/keywords', async (req, res) => {
    const parsed = AddKeywordBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid phrase' })
    }
    const phrase = parsed.data.phrase

    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const existing = await prisma.keyword.findFirst({
        where: {
          district_id: district.id,
          phrase:      { equals: phrase, mode: 'insensitive' },
        },
      })
      if (existing) {
        return conflict(res)
      }

      const keyword = await prisma.keyword.create({
        data: {
          district_id: district.id,
          phrase,
          is_active:   true,
        },
      })

      return res.status(201).json(mapKeyword(keyword))
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        return conflict(res)
      }
      logger.error({ err }, 'Ops keyword create failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keyword create failed' })
    }
  })

  router.patch('/keywords/:id', async (req, res) => {
    const id = Number(req.params['id'])
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid keyword id' })
    }

    const parsed = PatchKeywordBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'PATCH body must only include boolean isActive' })
    }

    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const updateResult = await prisma.keyword.updateMany({
        where: { id, district_id: district.id },
        data:  { is_active: parsed.data.isActive },
      })
      if (updateResult.count === 0) {
        return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Keyword not found' })
      }

      const keyword = await prisma.keyword.findFirst({
        where: { id, district_id: district.id },
      })
      if (!keyword) return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Keyword not found' })

      return res.json(mapKeyword(keyword))
    } catch (err) {
      logger.error({ err }, 'Ops keyword patch failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keyword update failed' })
    }
  })

  router.delete('/keywords/:id', async (req, res) => {
    const id = Number(req.params['id'])
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid keyword id' })
    }

    try {
      const district = await getActiveDistrict()
      if (!district) return res.status(503).json({ error: 'No active district' })

      const deleteResult = await prisma.keyword.deleteMany({
        where: { id, district_id: district.id },
      })
      if (deleteResult.count === 0) {
        return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Keyword not found' })
      }

      return res.json({ deleted: 1 })
    } catch (err) {
      logger.error({ err }, 'Ops keyword delete failed')
      return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keyword delete failed' })
    }
  })
}

function mapKeyword(keyword: { id: number; phrase: string; is_active: boolean; created_at: Date; updated_at: Date }) {
  return {
    id:        keyword.id,
    phrase:    keyword.phrase,
    isActive:  keyword.is_active,
    createdAt: keyword.created_at.toISOString(),
    updatedAt: keyword.updated_at.toISOString(),
  }
}

function conflict(res: Parameters<Parameters<IRouter['post']>[1]>[1]) {
  return res.status(409).json({
    statusCode: 409,
    error:      'Conflict',
    message:    'Keyword phrase already exists for this district',
  })
}
