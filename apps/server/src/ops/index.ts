import { Router, type IRouter } from 'express'
import { registerBatchRoutes } from './batch-routes.js'
import { registerBrowserRoutes } from './browser-routes.js'
import { registerOpsGuard } from './guard.js'
import { registerHealthRoutes } from './health-routes.js'
import { registerKeywordRoutes } from './keyword-routes.js'
import { registerPipelineRoutes } from './pipeline-routes.js'
import { registerSimulatorRoutes } from './simulator-routes.js'

export const opsRouter: IRouter = Router()

registerOpsGuard(opsRouter)
registerBatchRoutes(opsRouter)
registerHealthRoutes(opsRouter)
registerSimulatorRoutes(opsRouter)
registerPipelineRoutes(opsRouter)
registerKeywordRoutes(opsRouter)
registerBrowserRoutes(opsRouter)
