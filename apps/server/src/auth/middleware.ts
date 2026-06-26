import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

function rejectSession(req: Request, res: Response): void {
  req.session.destroy((err) => {
    if (err) {
      logger.warn({ err }, 'Failed to destroy invalid session')
    }
  })

  res.status(401).json({
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Authentication required',
  })
}

export async function getAuthenticatedSession(req: Request): Promise<{ userId: number; districtId: number } | null> {
  if (!req.session.userId || !req.session.districtId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where:  { id: req.session.userId },
    select: { id: true, district_id: true, is_active: true },
  })

  if (!user || !user.is_active || user.district_id !== req.session.districtId) {
    return null
  }

  return {
    userId:     user.id,
    districtId: user.district_id,
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId || !req.session.districtId) {
    rejectSession(req, res)
    return
  }

  try {
    const session = await getAuthenticatedSession(req)

    if (!session) {
      rejectSession(req, res)
      return
    }

    req.session.userId = session.userId
    req.session.districtId = session.districtId

    next()
  } catch (err) {
    logger.error({
      err,
      userId: req.session.userId,
      districtId: req.session.districtId,
    }, 'Failed to validate authenticated session')
    res.status(500).json({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'Authentication check failed',
    })
  }
}
