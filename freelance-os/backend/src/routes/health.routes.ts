import { FastifyInstance } from 'fastify'
import { config } from '@/config/env'
import { logger } from '@/utils/logger'
import { prisma } from '@/utils/database'

export default async function healthRoutes(fastify: FastifyInstance) {
  // Health check simple
  fastify.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Vérification de santé du serveur',
      description: 'Endpoint pour vérifier que le serveur fonctionne',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            environment: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.NODE_ENV
    }
  })

  // Health check avec base de données
  fastify.get('/health/db', {
    schema: {
      tags: ['health'],
      summary: 'Vérification de santé avec base de données',
      description: 'Endpoint pour vérifier la connexion à la base de données',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            database: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Test simple de connexion DB
      await prisma.$queryRaw`SELECT 1`
      
      return {
        status: 'OK',
        database: 'connected',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Erreur health check DB', { error: (error as Error).message })
      
      reply.status(503)
      return {
        status: 'ERROR',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      }
    }
  })
}