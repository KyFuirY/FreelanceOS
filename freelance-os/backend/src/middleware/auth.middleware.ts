import type { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from '@/services/auth.service'
import { logger } from '@/utils/logger'

// Type pour l'utilisateur authentifié
export interface AuthenticatedUser {
  userId: string
  email: string
  role: string
}

// Interface pour les requêtes authentifiées
interface AuthenticatedRequest extends FastifyRequest {
  currentUser?: AuthenticatedUser
}

// Middleware d'authentification
export async function authMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Récupérer le token depuis l'header Authorization
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'Token d\'authentification requis',
        code: 'UNAUTHORIZED'
      })
    }

    const token = authHeader.substring(7) // Supprimer "Bearer "

    // Vérifier et décoder le token
    const decoded = await AuthService.verifyAccessToken(token)

    // Ajouter les informations utilisateur à la requête
    request.currentUser = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    }

    logger.debug('Authentification réussie', {
      userId: decoded.userId,
      endpoint: request.url
    })

  } catch (error) {
    logger.warn('Échec d\'authentification', {
      error: (error as Error).message,
      endpoint: request.url,
      ip: request.ip
    })

    return reply.code(401).send({
      error: 'Token invalide ou expiré',
      code: 'INVALID_TOKEN'
    })
  }
}

// Middleware pour vérifier les rôles (optionnel)
export function requireRole(allowedRoles: string[]) {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    if (!request.currentUser) {
      return reply.code(401).send({
        error: 'Authentification requise',
        code: 'UNAUTHORIZED'
      })
    }

    if (!allowedRoles.includes(request.currentUser.role)) {
      logger.warn('Accès refusé - rôle insuffisant', {
        userId: request.currentUser.userId,
        userRole: request.currentUser.role,
        requiredRoles: allowedRoles,
        endpoint: request.url
      })

      return reply.code(403).send({
        error: 'Permissions insuffisantes',
        code: 'FORBIDDEN'
      })
    }
  }
}