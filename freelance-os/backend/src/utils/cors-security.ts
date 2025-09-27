import { config } from '@/config/env';
import { secureLogger, logSecurityEvent } from './secure-logger';

/**
 * Configuration CORS durcie - Standards 2025
 * Protection contre les attaques CSRF, data exfiltration et cross-origin
 */

// Origins autorisées en production (whitelist stricte)
const PRODUCTION_ALLOWED_ORIGINS = [
  config.FRONTEND_URL,
  'https://freelance-os.com',
  'https://www.freelance-os.com',
  'https://app.freelance-os.com'
].filter(Boolean); // Supprime les valeurs undefined/null

// Ports de développement autorisés (localhost uniquement)
const DEV_ALLOWED_PORTS = [3000, 3001, 5173, 5174, 8080, 8081, 4200];

// Headers autorisés pour les requêtes cross-origin
const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type', 
  'Accept',
  'X-Requested-With',
  'X-Client-Version',
  'X-API-Key'
];

// Headers exposés au client
const EXPOSED_HEADERS = [
  'X-Total-Count',
  'X-Rate-Limit-Remaining', 
  'X-Rate-Limit-Reset',
  'Content-Range'
];

// Méthodes HTTP autorisées (strictement limitées)
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

// Méthodes HTTP interdites (sécurité)
const FORBIDDEN_METHODS = ['TRACE', 'CONNECT', 'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE'];

/**
 * Valide une origine contre la whitelist
 * @param origin - L'origine à valider
 * @param environment - Environnement (development/production)
 * @returns boolean
 */
function isOriginAllowed(origin: string | undefined, environment: string): boolean {
  if (!origin) {
    // Requêtes sans origin (ex: Postman, curl) - autorisées seulement en dev
    return environment === 'development';
  }

  try {
    const url = new URL(origin);
    
    // En production : whitelist stricte uniquement
    if (environment === 'production') {
      const isAllowed = PRODUCTION_ALLOWED_ORIGINS.some(allowed => {
        if (!allowed) return false;
        try {
          const allowedUrl = new URL(allowed);
          return url.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });
      
      if (!isAllowed) {
        logSecurityEvent('ACCESS_DENIED', {
          endpoint: 'cors_origin_blocked',
          reason: `Origin non autorisée: ${origin}`,
          severity: 'HIGH'
        });
      }
      
      return isAllowed;
    }

    // En développement : validation stricte pour localhost
    if (environment === 'development') {
      // Vérification stricte du hostname
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '::1') {
        // Vérifier si c'est dans la whitelist de production (pour tests)
        const isProductionOrigin = PRODUCTION_ALLOWED_ORIGINS.some(allowed => {
          if (!allowed) return false;
          try {
            return new URL(allowed).origin === url.origin;
          } catch {
            return false;
          }
        });
        
        if (!isProductionOrigin) {
          logSecurityEvent('SUSPICIOUS_ACTIVITY', {
            endpoint: 'cors_suspicious_origin',
            reason: `Origin suspect en dev: ${origin}`,
            severity: 'MEDIUM'
          });
          return false;
        }
      }

      // Si c'est localhost, vérifier le port
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
        const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
        const portAllowed = DEV_ALLOWED_PORTS.includes(port);
        
        if (!portAllowed) {
          logSecurityEvent('SUSPICIOUS_ACTIVITY', {
            endpoint: 'cors_invalid_port',
            reason: `Port non autorisé: ${origin}`,
            severity: 'MEDIUM'
          });
          return false;
        }
      }

      return true;
    }

    return false;
    
  } catch (error) {
    secureLogger.error('CORS_ORIGIN_VALIDATION_ERROR', {
      origin,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Configuration CORS sécurisée avancée
 */
export const SECURE_CORS_CONFIG = {
  // Fonction de validation d'origine dynamique
  origin: (origin: string | undefined, callback: (error: Error | null, origin: boolean | string | RegExp | Array<string | RegExp>) => void) => {
    const allowed = isOriginAllowed(origin, config.NODE_ENV);
    
    if (!allowed && origin) {
      logSecurityEvent('SUSPICIOUS_ACTIVITY', {
        endpoint: 'cors_blocked_origin',
        reason: `Tentative d'accès depuis origin non autorisée: ${origin}`,
        severity: 'MEDIUM'
      });
    }
    
    callback(null, allowed);
  },

  // Credentials : strict en production
  credentials: true,

  // Headers autorisés (whitelist)
  allowedHeaders: ALLOWED_HEADERS,

  // Headers exposés (minimal)
  exposedHeaders: EXPOSED_HEADERS,

  // Méthodes autorisées (minimal)
  methods: ALLOWED_METHODS,

  // Preflight cache (optimisation et sécurité)
  maxAge: config.NODE_ENV === 'production' ? 86400 : 300, // 24h prod, 5min dev

  // Options de sécurité avancées
  optionsSuccessStatus: 200, // Support vieux navigateurs

  // Preflight strictement nécessaire
  preflightContinue: false
};

/**
 * Middleware de validation CORS avancée
 * Ajoute des vérifications supplémentaires au-delà du CORS standard
 */
export function corsSecurityMiddleware() {
  return async function (request: any, reply: any) {
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const userAgent = request.headers['user-agent'];
    const method = request.method.toUpperCase();
    
    // Bloquer les méthodes HTTP interdites
    if (FORBIDDEN_METHODS.includes(method)) {
      logSecurityEvent('SUSPICIOUS_ACTIVITY', {
        endpoint: request.url,
        reason: `Méthode HTTP interdite: ${method}`,
        severity: 'HIGH',
        ip: request.ip,
        userAgent
      });
      
      reply.code(405).send({
        error: 'Méthode non autorisée',
        code: 'METHOD_NOT_ALLOWED'
      });
      return;
    }

    // Vérification supplémentaire du Referer en cas de requête sensible
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
      if (origin && referer) {
        try {
          const originUrl = new URL(origin);
          const refererUrl = new URL(referer);
          
          // Le referer doit correspondre à l'origin
          if (originUrl.origin !== refererUrl.origin) {
            logSecurityEvent('SUSPICIOUS_ACTIVITY', {
              endpoint: request.url,
              reason: `Mismatch Origin/Referer: ${origin} vs ${referer}`,
              severity: 'HIGH',
              ip: request.ip,
              userAgent
            });
            
            reply.code(403).send({
              error: 'Requête cross-origin suspecte',
              code: 'CORS_SECURITY_VIOLATION'
            });
            return;
          }
        } catch (error) {
          // URLs malformées - bloquer par sécurité
          logSecurityEvent('ACCESS_DENIED', {
            endpoint: request.url,
            reason: 'URLs Origin/Referer malformées',
            severity: 'MEDIUM'
          });
          
          reply.code(400).send({
            error: 'Headers malformés',
            code: 'MALFORMED_HEADERS'
          });
          return;
        }
      }
    }

    // Détection de tentatives d'exfiltration de données
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-real-ip', 
      'x-forwarded-for',
      'forwarded'
    ];

    for (const header of suspiciousHeaders) {
      if (request.headers[header] && config.NODE_ENV === 'production') {
        // En production, ces headers ne devraient venir que du reverse proxy
        const headerValue = request.headers[header];
        if (typeof headerValue === 'string' && !headerValue.includes('127.0.0.1')) {
          logSecurityEvent('SUSPICIOUS_ACTIVITY', {
            endpoint: request.url,
            reason: `Header proxy suspect: ${header}=${headerValue}`,
            severity: 'MEDIUM'
          });
        }
      }
    }

    // Protection contre les attaques de timing
    if (request.method === 'OPTIONS') {
      // Ajouter un délai aléatoire léger pour les preflight
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    }
  };
}

/**
 * Headers de sécurité CORS supplémentaires
 */
export const CORS_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site'
};

/**
 * Fonction utilitaire pour tester la configuration CORS
 * @param origin - Origin à tester
 * @returns Résultat du test
 */
export function testCorsOrigin(origin: string): {
  allowed: boolean;
  reason: string;
  environment: string;
} {
  const allowed = isOriginAllowed(origin, config.NODE_ENV);
  
  return {
    allowed,
    reason: allowed 
      ? 'Origin autorisée' 
      : `Origin non autorisée en ${config.NODE_ENV}`,
    environment: config.NODE_ENV
  };
}

export default {
  SECURE_CORS_CONFIG,
  corsSecurityMiddleware,
  CORS_SECURITY_HEADERS,
  testCorsOrigin,
  isOriginAllowed
};