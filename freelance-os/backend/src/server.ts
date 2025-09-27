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
import { XSS_SECURITY_HEADERS } from '@/utils/xss-protection'
import { pathTraversalValidationHook } from '@/utils/path-traversal-protection'
import { SECURE_CORS_CONFIG, corsSecurityMiddleware, CORS_SECURITY_HEADERS } from '@/utils/cors-security'
import { GLOBAL_RATE_LIMIT_CONFIG, advancedRateLimitMiddleware } from '@/utils/advanced-rate-limit'
import { SECURE_JWT_CONFIG, credentialsManager, ENV_SECURITY_CHECKS } from '@/utils/credentials-security'
import { secureErrorHandler, setupGlobalErrorHandlers, ERROR_SECURITY_HEADERS } from '@/utils/secure-error-handler'

// Routes imports
import healthRoutes from '@/routes/health.routes'
import authRoutes from '@/routes/auth.secure'
import { clientRoutes } from '@/routes/clients.routes'
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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })

  await fastify.register(cors, SECURE_CORS_CONFIG)

  await fastify.register(rateLimit, GLOBAL_RATE_LIMIT_CONFIG)

  // JWT Plugin avec configuration sécurisée
  await fastify.register(jwt, {
    secret: SECURE_JWT_CONFIG.secret()
  })

  // Documentation Swagger (développement uniquement avec protection supplémentaire)
  if (config.NODE_ENV === 'development' && process.env.ENABLE_SWAGGER === 'true') {
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
        securityDefinitions: {
          bearerAuth: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Bearer token pour authentification'
          }
        },
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
        docExpansion: 'none', // Sécurisé: pas d'expansion automatique
        deepLinking: false,
        displayRequestDuration: false,
        filter: true
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      uiHooks: {
        onRequest: async (request, reply) => {
          // Protection par IP whitelist en développement
          const allowedIPs = ['127.0.0.1', '::1', 'localhost']
          const clientIP = request.ip
          
          if (!allowedIPs.some(ip => clientIP.includes(ip))) {
            return reply.code(403).send({ error: 'Accès refusé' })
          }
        }
      }
    })
  }

  // Hook global pour ajouter les en-têtes de sécurité
  fastify.addHook('onSend', async (request, reply) => {
    // Ajouter les en-têtes de sécurité XSS
    Object.entries(XSS_SECURITY_HEADERS).forEach(([header, value]) => {
      reply.header(header, value)
    })
    
    // Ajouter les en-têtes de sécurité CORS
    Object.entries(CORS_SECURITY_HEADERS).forEach(([header, value]) => {
      reply.header(header, value)
    })
    
    // Ajouter les en-têtes de sécurité pour les erreurs
    Object.entries(ERROR_SECURITY_HEADERS).forEach(([header, value]) => {
      reply.header(header, value)
    })
  })

  // Hook global pour protection Path Traversal
  fastify.addHook('preHandler', pathTraversalValidationHook())

  // Hook global pour sécurité CORS avancée
  fastify.addHook('preHandler', corsSecurityMiddleware())

  // Hook global pour rate limiting avancé
  fastify.addHook('preHandler', advancedRateLimitMiddleware())

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

  // Gestionnaire d'erreurs sécurisé
  fastify.setErrorHandler(secureErrorHandler)

  // Handler 404 sécurisé
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        type: 'RESOURCE_NOT_FOUND',
        message: 'Ressource introuvable',
        timestamp: new Date().toISOString()
      }
    })
  })

  return fastify
}

async function startServer() {
  try {
    // Configuration des gestionnaires d'erreurs globaux
    setupGlobalErrorHandlers()
    
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