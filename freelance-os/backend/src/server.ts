import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { config } from '@/config/env'
import { logger } from '@/utils/logger'
import { prisma } from '@/utils/database'
import { redis } from '@/utils/redis'

// Routes imports
import healthRoutes from '@/routes/health'
import authRoutes from '@/routes/auth'
import clientRoutes from '@/routes/clients'
import invoiceRoutes from '@/routes/invoices'
import dashboardRoutes from '@/routes/dashboard'
import prospectRoutes from '@/routes/prospects'

async function buildServer() {
  const fastify = Fastify({
    logger: false, // Nous utilisons Winston
    trustProxy: true
  })

  // Enregistrement des plugins de sécurité
  await fastify.register(helmet, {
    contentSecurityPolicy: false
  })

  await fastify.register(cors, {
    origin: config.NODE_ENV === 'production' ? config.FRONTEND_URL : true,
    credentials: true
  })

  await fastify.register(rateLimit, {
    max: config.NODE_ENV === 'production' ? 100 : 1000,
    timeWindow: '1 minute',
    redis: redis
  })

  // JWT Plugin
  await fastify.register(jwt, {
    secret: config.JWT_SECRET
  })

  // Documentation Swagger (développement uniquement)
  if (config.NODE_ENV === 'development') {
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: 'FreelanceOS API',
          description: 'API REST pour FreelanceOS - Gestion freelance complète',
          version: '1.0.0'
        },
        host: `localhost:${config.PORT}`,
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'auth', description: 'Authentification' },
          { name: 'clients', description: 'Gestion clients' },
          { name: 'invoices', description: 'Gestion factures' },
          { name: 'dashboard', description: 'Tableau de bord' },
          { name: 'prospects', description: 'Gestion prospects' }
        ]
      }
    })

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      }
    })
  }

  // Enregistrement des routes API
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' })
  await fastify.register(clientRoutes, { prefix: '/api/v1/clients' })
  await fastify.register(invoiceRoutes, { prefix: '/api/v1/invoices' })
  await fastify.register(dashboardRoutes, { prefix: '/api/v1/dashboard' })
  await fastify.register(prospectRoutes, { prefix: '/api/v1/prospects' })

  // Gestion des erreurs globales
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Erreur serveur', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      ip: request.ip
    })

    if (error.validation) {
      return reply.status(400).send({
        error: 'Données invalides',
        details: error.validation
      })
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.message
      })
    }

    return reply.status(500).send({
      error: 'Erreur interne du serveur'
    })
  })

  // Handler 404
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Route non trouvée',
      path: request.url
    })
  })

  return fastify
}

async function startServer() {
  try {
    const fastify = await buildServer()
    
    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0'
    })

    logger.info(`🚀 Serveur FreelanceOS démarré sur le port ${config.PORT}`)
    if (config.NODE_ENV === 'development') {
      logger.info(`📚 Documentation API: http://localhost:${config.PORT}/docs`)
    }
    
  } catch (error) {
    logger.error('Erreur de démarrage du serveur', error)
    process.exit(1)
  }
}

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
  logger.info('Arrêt du serveur...')
  await prisma.$disconnect()
  await redis.disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('Arrêt du serveur...')
  await prisma.$disconnect()
  await redis.disconnect()
  process.exit(0)
})

if (require.main === module) {
  startServer()
}

export { buildServer }