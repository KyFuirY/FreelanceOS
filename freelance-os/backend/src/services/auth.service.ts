import bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import { config } from '@/config/env'
import { prisma } from '@/utils/database'
import { redis } from '@/utils/redis'
import { logger } from '@/utils/logger'
import type { User } from '@prisma/client'

// Types pour l'authentification
export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export class AuthService {
  // Hash du mot de passe avec bcrypt (12 rounds selon AGENTS.md)
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.BCRYPT_ROUNDS)
  }

  // Vérification du mot de passe
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  // Génération des tokens JWT
  static async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    }

    // Access token (15min selon config)
    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN
    } as jwt.SignOptions)

    // Refresh token (7 jours selon config)  
    const refreshToken = jwt.sign(
      { userId: user.id },
      config.JWT_SECRET,
      {
        expiresIn: config.REFRESH_TOKEN_EXPIRES_IN
      } as jwt.SignOptions
    )

    // Stocker le refresh token dans Redis avec expiration
    const refreshTokenKey = `refresh_token:${user.id}`
    await redis.setex(refreshTokenKey, 7 * 24 * 60 * 60, refreshToken) // 7 jours

    // Calculer l'expiration en secondes
    const expiresIn = 15 * 60 // 15 minutes

    logger.info('Tokens générés avec succès', { 
      userId: user.id, 
      email: user.email 
    })

    return {
      accessToken,
      refreshToken,
      expiresIn
    }
  }

  // Vérification et décodage du JWT
  static async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload
      return decoded
    } catch (error) {
      logger.warn('Token d\'accès invalide', { error: (error as Error).message })
      throw new Error('Token d\'accès invalide')
    }
  }

  // Rafraîchissement du token
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Vérifier le refresh token
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as { userId: string }

      // Vérifier que le token existe dans Redis
      const storedToken = await redis.get(`refresh_token:${decoded.userId}`)
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Refresh token invalide ou expiré')
      }

      // Récupérer l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      })

      if (!user) {
        throw new Error('Utilisateur introuvable')
      }

      // Supprimer l'ancien refresh token
      await redis.del(`refresh_token:${decoded.userId}`)

      // Générer de nouveaux tokens
      return this.generateTokens(user)
    } catch (error) {
      logger.warn('Erreur lors du rafraîchissement du token', { 
        error: (error as Error).message 
      })
      throw new Error('Refresh token invalide')
    }
  }

  // Déconnexion (blacklist du refresh token)
  static async logout(userId: string): Promise<void> {
    await redis.del(`refresh_token:${userId}`)
    logger.info('Utilisateur déconnecté', { userId })
  }

  // Inscription d'un nouvel utilisateur
  static async register(email: string, password: string, firstName: string, lastName: string) {
    try {
      // Vérifier si l'email existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        throw new Error('Un compte avec cet email existe déjà')
      }

      // Hash du mot de passe
      const hashedPassword = await this.hashPassword(password)

      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'FREELANCE', // Rôle par défaut selon le schéma Prisma
          isActive: true
        }
      })

      logger.info('Nouvel utilisateur créé', { 
        userId: user.id, 
        email: user.email 
      })

      // Générer les tokens
      const tokens = await this.generateTokens(user)

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        tokens
      }
    } catch (error) {
      logger.error('Erreur lors de l\'inscription', { 
        error: (error as Error).message,
        email 
      })
      throw error
    }
  }

  // Connexion utilisateur
  static async login(email: string, password: string) {
    try {
      // Récupérer l'utilisateur
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user || !user.isActive) {
        throw new Error('Email ou mot de passe incorrect')
      }

      // Vérifier le mot de passe
      const isValidPassword = await this.verifyPassword(password, user.password)
      if (!isValidPassword) {
        throw new Error('Email ou mot de passe incorrect')
      }

      // Mettre à jour la dernière connexion
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      })

      logger.info('Connexion réussie', { 
        userId: user.id, 
        email: user.email 
      })

      // Générer les tokens
      const tokens = await this.generateTokens(user)

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        tokens
      }
    } catch (error) {
      logger.error('Erreur lors de la connexion', { 
        error: (error as Error).message,
        email 
      })
      throw error
    }
  }
}