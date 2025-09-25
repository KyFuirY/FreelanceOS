import { PrismaClient } from '@prisma/client'
import { logger } from '@/utils/logger'

// Extension Prisma avec middleware de logging
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' }
  ]
})

// Middleware de logging des requêtes
prisma.$on('query', (e) => {
  logger.debug('Prisma Query', {
    query: e.query,
    params: e.params,
    duration: `${e.duration}ms`
  })
})

prisma.$on('error', (e) => {
  logger.error('Prisma Error', {
    message: e.message,
    target: e.target
  })
})

// Middleware d'audit pour les actions critiques
prisma.$use(async (params, next) => {
  const before = Date.now()
  
  const result = await next(params)
  
  const after = Date.now()
  const duration = after - before
  
  // Log des opérations critiques (création, modification, suppression)
  if (['create', 'update', 'delete'].includes(params.action)) {
    logger.info('Database Operation', {
      model: params.model,
      action: params.action,
      duration: `${duration}ms`
    })
  }
  
  return result
})

// Vérification de la connexion
prisma.$connect()
  .then(() => {
    logger.info('✅ Connexion à la base de données établie')
  })
  .catch((error) => {
    logger.error('❌ Erreur de connexion à la base de données', error)
    process.exit(1)
  })

export { prisma }