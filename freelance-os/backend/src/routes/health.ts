import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/utils/database'
import { redis } from '@/utils/redis'
import { logger } from '@/utils/logger'

export default async function healthRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Test de la connexion à la base de données
      await prisma.$queryRaw`SELECT 1`
      
      // Test de la connexion Redis
      await redis.ping()
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        services: {
          database: 'connected',
          redis: 'connected'
        }
      }
    } catch (error) {
      logger.error('Health check failed', error)
      return reply.code(503).send({ 
        status: 'error',
        error: 'Service indisponible',
        timestamp: new Date().toISOString()
      })
    }
  })
}