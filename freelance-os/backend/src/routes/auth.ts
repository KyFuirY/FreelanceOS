import { FastifyPluginAsync } from 'fastify'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { AuthService } from '@/services/auth.service'
import { authMiddleware, type AuthenticatedUser } from '@/middleware/auth.middleware'
import { secureLogger, logSecurityEvent } from '@/utils/secure-logger'
import { logger } from '@/utils/logger'
import { 
  secureNameSchema, 
  secureEmailSchema, 
  securePasswordSchema, 
  validatePayloadSize,
  sanitizeInput
} from '@/utils/security-validation'

// Schémas de validation Zod sécurisés
const registerSchema = z.object({
  email: secureEmailSchema,
  password: securePasswordSchema,
  firstName: secureNameSchema,
  lastName: secureNameSchema
})

const loginSchema = z.object({
  email: secureEmailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(128, 'Mot de passe trop long')
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis')
})

// Interface pour les requêtes authentifiées
interface AuthenticatedRequest extends FastifyRequest {
  currentUser?: AuthenticatedUser
}

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  
  // POST /auth/register - Inscription
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validation taille payload (anti-DoS)
      if (!validatePayloadSize(request.body, 5)) {
        logSecurityEvent('SUSPICIOUS_ACTIVITY', {
          reason: 'Payload trop volumineux',
          ip: request.ip,
          endpoint: request.url,
          severity: 'HIGH'
        })
        return reply.code(413).send({ error: 'Payload trop volumineux' })
      }

      const validatedData = registerSchema.parse(request.body)
      
      // Nettoyage des inputs
      const cleanData = {
        email: sanitizeInput(validatedData.email),
        password: validatedData.password, // Pas de sanitize sur le password
        firstName: sanitizeInput(validatedData.firstName),
        lastName: sanitizeInput(validatedData.lastName)
      }
      
      const result = await AuthService.register(
        cleanData.email,
        cleanData.password,
        cleanData.firstName,
        cleanData.lastName
      )

      secureLogger.info('Inscription réussie', { 
        userId: result.user.id
        // Email supprimé pour sécurité
      })

      return reply.code(201).send({
        message: 'Compte créé avec succès',
        user: result.user,
        tokens: result.tokens
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Données invalides',
          details: error.errors
        })
      }

      logger.error('Erreur lors de l\'inscription', { error: (error as Error).message })
      
      return reply.code(400).send({
        error: (error as Error).message
      })
    }
  })

  // POST /auth/login - Connexion
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = loginSchema.parse(request.body)
      
      const result = await AuthService.login(
        validatedData.email,
        validatedData.password
      )

      logger.info('Connexion réussie', { 
        userId: result.user.id,
        email: result.user.email 
      })

      return reply.code(200).send({
        message: 'Connexion réussie',
        user: result.user,
        tokens: result.tokens
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Données invalides',
          details: error.errors
        })
      }

      logger.error('Erreur lors de la connexion', { error: (error as Error).message })
      
      return reply.code(401).send({
        error: (error as Error).message
      })
    }
  })

  // POST /auth/refresh - Rafraîchissement du token
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = refreshTokenSchema.parse(request.body)
      
      const tokens = await AuthService.refreshAccessToken(validatedData.refreshToken)

      logger.info('Token rafraîchi avec succès')

      return reply.code(200).send({
        message: 'Token rafraîchi avec succès',
        tokens
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Données invalides',
          details: error.errors
        })
      }

      logger.error('Erreur lors du rafraîchissement', { error: (error as Error).message })
      
      return reply.code(401).send({
        error: (error as Error).message
      })
    }
  })

  // POST /auth/logout - Déconnexion (requiert authentification)
  fastify.post('/logout', 
    { preHandler: [authMiddleware] },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        if (!request.currentUser) {
          return reply.code(401).send({ error: 'Non authentifié' })
        }

        await AuthService.logout(request.currentUser.userId)

        logger.info('Déconnexion réussie', { 
          userId: request.currentUser.userId 
        })

        return reply.code(200).send({
          message: 'Déconnexion réussie'
        })

      } catch (error) {
        logger.error('Erreur lors de la déconnexion', { error: (error as Error).message })
        
        return reply.code(500).send({
          error: 'Erreur lors de la déconnexion'
        })
      }
    }
  )

  // GET /auth/me - Informations utilisateur actuel (requiert authentification)
  fastify.get('/me', 
    { preHandler: [authMiddleware] },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        if (!request.currentUser) {
          return reply.code(401).send({ error: 'Non authentifié' })
        }

        // Récupérer les informations complètes de l'utilisateur
        const { prisma } = await import('@/utils/database')
        const user = await prisma.user.findUnique({
          where: { id: request.currentUser.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            company: true,
            role: true,
            createdAt: true,
            lastLogin: true
          }
        })

        if (!user) {
          return reply.code(404).send({ error: 'Utilisateur introuvable' })
        }

        return reply.code(200).send({
          user
        })

      } catch (error) {
        logger.error('Erreur lors de la récupération du profil', { 
          error: (error as Error).message,
          userId: request.currentUser?.userId 
        })
        
        return reply.code(500).send({
          error: 'Erreur lors de la récupération du profil'
        })
      }
    }
  )
}

export default authRoutes