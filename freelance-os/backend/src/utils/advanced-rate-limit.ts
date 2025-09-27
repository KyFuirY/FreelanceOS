import { config } from '@/config/env';
import { redis } from '@/utils/redis';
import { secureLogger, logSecurityEvent } from './secure-logger';

/**
 * Rate Limiting Avancé - Standards 2025
 * Protection DDoS, brute force, spam avec détection comportementale
 */

// Configuration des limites par type d'endpoint
interface RateLimitConfig {
  windowMs: number;        // Fenêtre de temps en millisecondes
  maxRequests: number;     // Nombre max de requêtes
  skipSuccessfulRequests: boolean; // Ignorer les requêtes réussies
  skipFailedRequests: boolean;     // Ignorer les requêtes échouées
  blockDuration?: number;  // Durée de blocage en secondes
}

// Limites par catégorie d'endpoint
const RATE_LIMITS = {
  // Authentification - très strict (brute force protection)
  auth: {
    windowMs: 15 * 60 * 1000,    // 15 minutes
    maxRequests: 5,              // 5 tentatives max
    skipSuccessfulRequests: true, // Ne compter que les échecs
    skipFailedRequests: false,   // Compter tous les essais d'auth
    blockDuration: 30 * 60       // Blocage 30 min après dépassement
  } as RateLimitConfig,

  // Création de ressources - modéré
  create: {
    windowMs: 60 * 1000,         // 1 minute  
    maxRequests: 10,             // 10 créations max
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    blockDuration: 5 * 60        // Blocage 5 min
  } as RateLimitConfig,

  // Lecture de données - permissif (ajusté pour tests)
  read: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: config.NODE_ENV === 'development' ? 15 : 60, // Limite plus basse en dev pour tests
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    blockDuration: 2 * 60        // Blocage 2 min
  } as RateLimitConfig,

  // Mise à jour - normal
  update: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 30,             // 30 updates max
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    blockDuration: 3 * 60        // Blocage 3 min
  } as RateLimitConfig,

  // Suppression - strict
  delete: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 5,              // 5 suppressions max
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    blockDuration: 10 * 60       // Blocage 10 min
  } as RateLimitConfig,

  // Général (fallback)
  general: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: config.NODE_ENV === 'production' ? 100 : 20, // Limite plus basse en dev pour tests
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    blockDuration: 5 * 60        // Blocage 5 min
  } as RateLimitConfig
};

// Endpoints sensibles avec rate limiting strict
const SENSITIVE_ENDPOINTS = [
  '/auth/login',
  '/auth/register', 
  '/auth/reset-password',
  '/auth/verify-email'
];

// IPs en whitelist (développement, monitoring)
const WHITELISTED_IPS = [
  '127.0.0.1',
  '::1',
  'localhost'
];

/**
 * Détermine le type de rate limit selon l'endpoint
 */
function getRateLimitType(method: string, url: string): keyof typeof RATE_LIMITS {
  // Authentification
  if (url.includes('/auth/')) {
    return 'auth';
  }

  // Par méthode HTTP
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'GET':
      return 'read';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'general';
  }
}

/**
 * Génère une clé Redis pour le rate limiting
 */
function generateRateLimitKey(ip: string, endpoint: string, userId?: string): string {
  const base = `ratelimit:${ip}:${endpoint}`;
  return userId ? `${base}:user:${userId}` : base;
}

/**
 * Génère une clé pour les IPs bloquées
 */
function generateBlockKey(ip: string): string {
  return `blocked:${ip}`;
}

/**
 * Vérifie si une IP est temporairement bloquée
 */
async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const blockKey = generateBlockKey(ip);
    const blocked = await redis.exists(blockKey);
    return blocked === 1;
  } catch (error) {
    secureLogger.error('RATE_LIMIT_BLOCK_CHECK_ERROR', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false; // En cas d'erreur, on n'bloque pas (fail open)
  }
}

/**
 * Bloque une IP temporairement
 */
async function blockIP(ip: string, durationSeconds: number, reason: string): Promise<void> {
  try {
    const blockKey = generateBlockKey(ip);
    await redis.setex(blockKey, durationSeconds, JSON.stringify({
      blockedAt: new Date().toISOString(),
      reason,
      duration: durationSeconds
    }));

    logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      endpoint: 'rate_limit_block',
      reason: `IP bloquée: ${reason}`,
      severity: 'HIGH',
      ip
    });

    secureLogger.warn('IP_BLOCKED_RATE_LIMIT', {
      ip,
      reason,
      duration: durationSeconds
    });
  } catch (error) {
    secureLogger.error('RATE_LIMIT_BLOCK_ERROR', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Middleware de rate limiting avancé
 */
export function advancedRateLimitMiddleware() {
  return async function (request: any, reply: any) {
    const ip = request.ip;
    const method = request.method;
    const url = request.url;
    const userId = request.user?.id;
    
    // Whitelist des IPs de développement (désactivée pour tests)
    if (config.NODE_ENV === 'development' && false && WHITELISTED_IPS.includes(ip)) {
      return; // Pas de rate limiting en dev pour les IPs whitelistées
    }

    // Vérifier si l'IP est bloquée
    const isBlocked = await isIPBlocked(ip);
    if (isBlocked) {
      logSecurityEvent('ACCESS_DENIED', {
        endpoint: url,
        reason: 'IP temporairement bloquée par rate limiting',
        severity: 'MEDIUM',
        ip,
        userId
      });

      reply.code(429).send({
        error: 'Trop de requêtes - IP temporairement bloquée',
        code: 'IP_TEMPORARILY_BLOCKED',
        retryAfter: 300 // 5 minutes par défaut
      });
      return;
    }

    // Déterminer le type de rate limit
    const limitType = getRateLimitType(method, url);
    const limits = RATE_LIMITS[limitType];
    
    // Générer la clé Redis
    const rateLimitKey = generateRateLimitKey(ip, url, userId);
    
    try {
      // Sliding window avec Redis
      const now = Date.now();
      const windowStart = now - limits.windowMs;

      // Supprimer les entrées expirées
      await redis.zremrangebyscore(rateLimitKey, '-inf', windowStart);
      
      // Compter les requêtes dans la fenêtre
      const currentCount = await redis.zcard(rateLimitKey);
      
      // Vérifier la limite
      if (currentCount >= limits.maxRequests) {
        // Dépassement de limite - bloquer l'IP si configuré
        if (limits.blockDuration) {
          await blockIP(ip, limits.blockDuration, `Dépassement rate limit ${limitType}: ${currentCount}/${limits.maxRequests}`);
        }

        logSecurityEvent('SUSPICIOUS_ACTIVITY', {
          endpoint: url,
          reason: `Rate limit dépassé: ${currentCount}/${limits.maxRequests} (${limitType})`,
          severity: 'HIGH',
          ip,
          userId
        });

        const retryAfter = Math.ceil(limits.windowMs / 1000);
        
        reply.code(429).send({
          error: 'Trop de requêtes',
          code: 'RATE_LIMIT_EXCEEDED',
          limit: limits.maxRequests,
          window: limits.windowMs / 1000,
          retryAfter
        });
        return;
      }

      // Ajouter la requête actuelle
      await redis.zadd(rateLimitKey, now, `${now}-${Math.random()}`);
      await redis.expire(rateLimitKey, Math.ceil(limits.windowMs / 1000));

      // Ajouter les headers informatifs
      reply.header('X-RateLimit-Limit', limits.maxRequests.toString());
      reply.header('X-RateLimit-Remaining', (limits.maxRequests - currentCount - 1).toString());
      reply.header('X-RateLimit-Reset', new Date(now + limits.windowMs).toISOString());
      reply.header('X-RateLimit-Window', (limits.windowMs / 1000).toString());

    } catch (error) {
      secureLogger.error('RATE_LIMIT_MIDDLEWARE_ERROR', {
        ip,
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // En cas d'erreur Redis, on laisse passer (fail open)
    }
  };
}

/**
 * Configuration Fastify Rate Limit (global)
 */
export const GLOBAL_RATE_LIMIT_CONFIG = {
  max: config.NODE_ENV === 'production' ? 200 : 50, // Limite plus basse en dev pour tests
  timeWindow: '1 minute',
  redis: redis,
  allowList: config.NODE_ENV === 'production' ? WHITELISTED_IPS : [], // Pas de whitelist en dev pour tests
  errorResponseBuilder: (request: any, context: any) => {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      endpoint: request.url,
      reason: `Rate limit global dépassé: ${context.totalHits}/${context.max}`,
      severity: 'MEDIUM',
      ip: request.ip
    });

    return {
      code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
      error: 'Limite globale de requêtes dépassée',
      limit: context.max,
      reset: new Date(Date.now() + context.ttl),
      retryAfter: Math.round(context.ttl / 1000)
    };
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true
  }
};

/**
 * Utilitaire pour débloquer une IP manuellement (admin)
 */
export async function unblockIP(ip: string): Promise<boolean> {
  try {
    const blockKey = generateBlockKey(ip);
    const result = await redis.del(blockKey);
    
    if (result > 0) {
      secureLogger.info('IP_UNBLOCKED', { ip });
      return true;
    }
    return false;
  } catch (error) {
    secureLogger.error('UNBLOCK_IP_ERROR', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Obtenir les statistiques de rate limiting pour une IP
 */
export async function getRateLimitStats(ip: string): Promise<any> {
  try {
    const stats: any = {
      ip,
      blocked: await isIPBlocked(ip),
      limits: {}
    };

    // Vérifier chaque type de limite
    for (const [type, config] of Object.entries(RATE_LIMITS)) {
      const key = generateRateLimitKey(ip, type);
      const count = await redis.zcard(key);
      const ttl = await redis.ttl(key);
      
      stats.limits[type] = {
        current: count,
        max: config.maxRequests,
        windowSeconds: config.windowMs / 1000,
        resetIn: ttl > 0 ? ttl : 0
      };
    }

    return stats;
  } catch (error) {
    secureLogger.error('RATE_LIMIT_STATS_ERROR', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

export default {
  advancedRateLimitMiddleware,
  GLOBAL_RATE_LIMIT_CONFIG,
  unblockIP,
  getRateLimitStats,
  isIPBlocked
};