import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Env } from './types/env'
import emojiRoutes from './routes/emoji'
import actionRoutes from './routes/action'
import translationRoutes from './routes/translation'
const app = new Hono<{ Bindings: Env }>()

// CORS middleware
app.use('*', cors({
  origin: ['https://genmojionline.com', 'https://www.genmojionline.com', 'http://localhost:3000', 'http://localhost:4780'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 86400,
  credentials: true,
}))

// Mount routes
app.route('/genmoji', emojiRoutes)
app.route('/action', actionRoutes)
app.route('/translation', translationRoutes)

export default app
