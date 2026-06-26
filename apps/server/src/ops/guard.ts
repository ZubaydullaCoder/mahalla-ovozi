import type { IRouter } from 'express'
import { env } from '../shared/env.js'

export function registerOpsGuard(router: IRouter): void {
  router.use((req, res, next) => {
    if (env.NODE_ENV === 'production' || env.OPS_ENABLED !== 'true') {
      return res.status(404).json({ error: 'Not found' })
    }

    const isLocalhost =
      req.ip === '127.0.0.1' ||
      req.ip === '::1' ||
      req.ip === '::ffff:127.0.0.1'

    if (env.OPS_SECRET) {
      if (req.header('X-Ops-Secret') !== env.OPS_SECRET) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      return next()
    }

    if (!isLocalhost) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    return next()
  })
}
