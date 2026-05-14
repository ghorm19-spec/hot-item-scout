import { rootRoute } from './src/routes/__root'
import { indexRoute } from './src/routes/index'
import { scanRoute } from './src/routes/scan'
import { resultRoute } from './src/routes/result.$id'
import { historyRoute } from './src/routes/history'
import { badgesRoute } from './src/routes/badges'
import { loginRoute } from './src/routes/login'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  scanRoute,
  resultRoute,
  historyRoute,
  badgesRoute,
  loginRoute,
])
