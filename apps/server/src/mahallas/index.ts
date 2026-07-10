// apps/server/src/mahallas/index.ts
import { Router, type IRouter } from 'express'
import { logger } from '../shared/logger.js'
import { queryMahallasForDistrict } from './query.js'
import { mapMahallaRow } from './mapper.js'

export const mahallasRouter: IRouter = Router()

mahallasRouter.get('/mahallas', async (req, res) => {
  const districtId = req.session.districtId

  if (districtId === undefined) {
    return res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  try {
    const rows = await queryMahallasForDistrict(districtId)
    const mahallas = rows.map(mapMahallaRow)
    return res.json(mahallas)
  } catch (err) {
    logger.error({ err, districtId }, 'Mahallas query failed')
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to load mahallas',
    })
  }
})
