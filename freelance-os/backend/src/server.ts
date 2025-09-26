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
    logger: false, // Nous utilisons Winston pour les logs
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
  logger.info('🔧 Enregistrement des routes...')
  await fastify.register(healthRoutes, { prefix: '/api' })
  logger.info('✅ Routes health enregistrées')
  
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' })
  logger.info('✅ Routes auth enregistrées')
  
  await fastify.register(clientRoutes, { prefix: '/api/v1/clients' })
  logger.info('✅ Routes clients enregistrées')
  
  await fastify.register(invoiceRoutes, { prefix: '/api/v1/invoices' })
  logger.info('✅ Routes invoices enregistrées')
  
  await fastify.register(dashboardRoutes, { prefix: '/api/v1/dashboard' })
  logger.info('✅ Routes dashboard enregistrées')
  
  await fastify.register(prospectRoutes, { prefix: '/api/v1/prospects' })
  logger.info('✅ Routes prospects enregistrées')

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
    logger.info('🚀 Démarrage du serveur FreelanceOS...')
    
    const fastify = await buildServer()
    fastifyInstance = fastify // Stocker la référence pour l'arrêt propre
    
    logger.info('🔧 Tentative de démarrage sur le port ' + config.PORT)
    
    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0'
    })

    logger.info(`🚀 Serveur FreelanceOS démarré sur le port ${config.PORT}`)
    if (config.NODE_ENV === 'development') {
      logger.info(`📚 Documentation API: http://localhost:${config.PORT}/docs`)
    }
    
    // Keepalive pour empêcher l'arrêt automatique
    const keepAlive = setInterval(() => {
      logger.debug('⚡ Serveur actif')
    }, 30000) // Log toutes les 30 secondes
    
    // Nettoyer l'interval lors de l'arrêt
    process.on('SIGTERM', () => clearInterval(keepAlive))
    process.on('SIGINT', () => clearInterval(keepAlive))
    
  } catch (error) {
    logger.error('❌ Erreur de démarrage du serveur', error)
    process.exit(1)
  }
}

// Gestion propre de l'arrêt
let isShuttingDown = false
let fastifyInstance: any = null

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return
  isShuttingDown = true
  
  logger.info(`🔄 Signal ${signal} reçu - Arrêt propre du serveur...`)
  
  try {
    // Fermer le serveur Fastify
    if (fastifyInstance) {
      await fastifyInstance.close()
    }
    
    // Fermer les connexions aux bases de données
    await prisma.$disconnect()
    await redis.disconnect()
    
    logger.info('✅ Arrêt propre terminé')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Erreur lors de l\'arrêt propre', error)
    process.exit(1)
  }
}

// Écouter uniquement les signaux intentionnels
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Log des arrêts de processus
process.on('exit', (code) => {
  if (!isShuttingDown) {
    logger.warn(`🛑 Processus arrêté de manière inattendue avec le code ${code}`)
  }
})

if (require.main === module) {
  startServer()
}

export { buildServer }