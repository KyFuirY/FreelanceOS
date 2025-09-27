import { FastifyPluginAsync } from 'fastify'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { AuthService } from '@/services/auth.service'
import { authMiddleware, type AuthenticatedUser } from '@/middleware/auth.middleware'
import { secureLogger, logSecurityEvent } from '@/utils/secure-logger'
import { prisma } from '@/utils/database'
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
  refreshToken: z.string().min(1, 'Refresh token requis').max(500, 'Token trop long')
})

// Interface pour les requêtes authentifiées
interface AuthenticatedRequest extends FastifyRequest {
  currentUser?: AuthenticatedUser
}

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  
  // POST /auth/register - Inscription sécurisée
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validation taille payload (anti-DoS)
      if (!validatePayloadSize(request.body, 5)) {
        logSecurityEvent('SUSPICIOUS_ACTIVITY', {
          reason: 'Payload trop volumineux à l\'inscription',
          ip: request.ip,
          endpoint: request.url,
          severity: 'HIGH'
        })
        return reply.code(413).send({ error: 'Données trop volumineuses' })
      }

      const validatedData = registerSchema.parse(request.body)
      
      // Nettoyage des inputs (anti-injection)
      const cleanData = {
        email: sanitizeInput(validatedData.email).toLowerCase(),
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

      logSecurityEvent('LOGIN_SUCCESS', {
        userId: result.user.id,
        ip: request.ip,
        severity: 'LOW'
      })

      return reply.code(201).send({
        message: 'Compte créé avec succès',
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role
        },
        tokens: result.tokens
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        logSecurityEvent('SUSPICIOUS_ACTIVITY', {
          reason: 'Données invalides à l\'inscription',
          ip: request.ip,
          severity: 'MEDIUM'
        })
        return reply.code(400).send({
          error: 'Données invalides',
          details: error.errors
        })
      }

      secureLogger.error('Erreur lors de l\'inscription', { 
        error: (error as Error).message,
        ip: request.ip
      })
      
      return reply.code(400).send({
        error: (error as Error).message
      })
    }
  })

  // POST /auth/login - Connexion sécurisée
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validation taille payload
      if (!validatePayloadSize(request.body, 2)) {
        logSecurityEvent('SUSPICIOUS_ACTIVITY', {
          reason: 'Payload trop volumineux à la connexion',
          ip: request.ip,
          endpoint: request.url,
          severity: 'HIGH'
        })
        return reply.code(413).send({ error: 'Données trop volumineuses' })
      }

      const validatedData = loginSchema.parse(request.body)
      
      const result = await AuthService.login(
        sanitizeInput(validatedData.email).toLowerCase(),
        validatedData.password
      )

      logSecurityEvent('LOGIN_SUCCESS', {
        userId: result.user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        severity: 'LOW'
      })

      return reply.code(200).send({
        message: 'Connexion réussie',
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role
        },
        tokens: result.tokens
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        logSecurityEvent('LOGIN_FAILED', {
          reason: 'Données invalides à la connexion',
          ip: request.ip,
          severity: 'MEDIUM'
        })
        return reply.code(400).send({
          error: 'Données invalides',
          details: error.errors
        })
      }

      logSecurityEvent('LOGIN_FAILED', {
        reason: (error as Error).message,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        severity: 'HIGH'
      })
      
      return reply.code(401).send({
        error: 'Identifiants invalides'
      })
    }
  })

  // POST /auth/refresh - Rafraîchissement de token sécurisé
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = refreshTokenSchema.parse(request.body)
      
      const tokens = await AuthService.refreshAccessToken(validatedData.refreshToken)

      secureLogger.info('Token rafraîchi avec succès', {
        ip: request.ip
      })

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

      logSecurityEvent('ACCESS_DENIED', {
        reason: 'Échec rafraîchissement token',
        ip: request.ip,
        severity: 'HIGH'
      })
      
      return reply.code(401).send({
        error: 'Token invalide'
      })
    }
  })

  // POST /auth/logout - Déconnexion sécurisée
  fastify.post('/logout', { preHandler: authMiddleware }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (request.currentUser) {
        await AuthService.logout(request.currentUser.userId)
        
        logSecurityEvent('LOGIN_SUCCESS', {
          userId: request.currentUser.userId,
          ip: request.ip,
          severity: 'LOW'
        })
      }

      return reply.code(200).send({
        message: 'Déconnexion réussie'
      })
    } catch (error) {
      secureLogger.error('Erreur lors de la déconnexion', { 
        error: (error as Error).message,
        ip: request.ip
      })
      
      return reply.code(500).send({
        error: 'Erreur lors de la déconnexion'
      })
    }
  })

  // GET /auth/me - Profil utilisateur sécurisé
  fastify.get('/me', { preHandler: authMiddleware }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.currentUser) {
        return reply.code(401).send({
          error: 'Non authentifié'
        })
      }

      // Log accès aux données sensibles
      logSecurityEvent('DATA_ACCESS', {
        userId: request.currentUser.userId,
        endpoint: '/auth/me',
        ip: request.ip,
        severity: 'LOW'
      })

      // Récupérer les informations utilisateur (sans le password)
      const user = await prisma.user.findUnique({
        where: { id: request.currentUser.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          company: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true
        }
      })

      if (!user) {
        return reply.code(404).send({
          error: 'Utilisateur introuvable'
        })
      }

      return reply.code(200).send({
        user
      })

    } catch (error) {
      secureLogger.error('Erreur lors de la récupération du profil', {
        error: (error as Error).message,
        userId: request.currentUser?.userId,
        ip: request.ip
      })

      return reply.code(500).send({
        error: 'Erreur serveur'
      })
    }
  })
}

export default authRoutes