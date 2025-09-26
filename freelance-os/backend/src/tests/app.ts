import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'

import { config } from '@/config/env'
import healthRoutes from '@/routes/health'
import authRoutes from '@/routes/auth'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false // Désactiver les logs pendant les tests
  })

  // Plugins essentiels
  app.register(cors, {
    origin: true,
    credentials: true
  })

  app.register(helmet, {
    contentSecurityPolicy: false
  })

  app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRES_IN
    }
  })

  // Routes
  app.register(healthRoutes, { prefix: '/api' })
  app.register(authRoutes, { prefix: '/api/v1/auth' })

  return app
}