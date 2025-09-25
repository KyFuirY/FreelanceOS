import Redis from 'ioredis'
import { config } from '@/config/env'
import { logger } from '@/utils/logger'

// Configuration Redis avec retry automatique
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keyPrefix: 'freelance-os:',
  
  // Configuration pour la production
  ...(config.NODE_ENV === 'production' && {
    connectTimeout: 60000,
    commandTimeout: 5000
  })
})

// Event listeners pour logging
redis.on('connect', () => {
  logger.info('✅ Connexion Redis établie')
})

redis.on('ready', () => {
  logger.info('✅ Redis prêt à recevoir des commandes')
})

redis.on('error', (error) => {
  logger.error('❌ Erreur Redis', error)
})

redis.on('close', () => {
  logger.warn('⚠️ Connexion Redis fermée')
})

redis.on('reconnecting', () => {
  logger.info('🔄 Reconnexion Redis en cours...')
})

// Helpers pour les opérations courantes

/**
 * Cache avec TTL (Time To Live)
 */
export const setCache = async (key: string, value: any, ttl: number = 3600): Promise<void> => {
  try {
    await redis.setex(key, ttl, JSON.stringify(value))
    logger.debug('Cache set', { key, ttl })
  } catch (error) {
    logger.error('Erreur lors du cache', { key, error })
  }
}

/**
 * Récupération du cache
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await redis.get(key)
    if (value) {
      logger.debug('Cache hit', { key })
      return JSON.parse(value) as T
    }
    logger.debug('Cache miss', { key })
    return null
  } catch (error) {
    logger.error('Erreur lors de la récupération du cache', { key, error })
    return null
  }
}

/**
 * Suppression du cache
 */
export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redis.del(key)
    logger.debug('Cache deleted', { key })
  } catch (error) {
    logger.error('Erreur lors de la suppression du cache', { key, error })
  }
}

/**
 * Suppression par pattern (ex: "user:*")
 */
export const deleteCachePattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      logger.debug('Cache pattern deleted', { pattern, count: keys.length })
    }
  } catch (error) {
    logger.error('Erreur lors de la suppression du cache par pattern', { pattern, error })
  }
}

/**
 * Session storage pour l'authentification
 */
export const setSession = async (userId: string, sessionData: any, ttl: number = 86400): Promise<void> => {
  await setCache(`session:${userId}`, sessionData, ttl)
}

export const getSession = async (userId: string): Promise<any> => {
  return await getCache(`session:${userId}`)
}

export const deleteSession = async (userId: string): Promise<void> => {
  await deleteCache(`session:${userId}`)
}

export { redis }