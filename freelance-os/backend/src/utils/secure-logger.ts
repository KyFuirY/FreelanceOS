import { logger } from '@/utils/logger'

/**
 * Utilitaires de sécurité pour les logs - Standard 2025
 * Évite l'exposition de données sensibles dans les logs
 */

// PII (Personally Identifiable Information) à masquer
const PII_PATTERNS = [
  'email',
  'password', 
  'token',
  'secret',
  'key',
  'phone',
  'address',
  'siret',
  'tva',
  'iban',
  'card'
] as const

// Fonction pour masquer les données sensibles
export function sanitizeForLogging(data: any): any {
  if (data === null || data === undefined) return data
  
  if (typeof data === 'string') {
    // Masquer les emails
    if (data.includes('@')) {
      const parts = data.split('@')
      if (parts.length === 2 && parts[0] && parts[1]) {
        const local = parts[0]
        const domain = parts[1]
        return `${local.substring(0, Math.min(2, local.length))}***@${domain}`
      }
    }
    return data
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item))
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      
      // Vérifier si c'est un champ sensible
      if (PII_PATTERNS.some(pattern => lowerKey.includes(pattern))) {
        if (typeof value === 'string') {
          // Masquer selon le type
          if (lowerKey.includes('email')) {
            sanitized[key] = value.includes('@') 
              ? `${value.substring(0, 2)}***@${value.split('@')[1]}`
              : '***'
          } else if (lowerKey.includes('phone')) {
            sanitized[key] = value.length > 4 
              ? `***${value.slice(-4)}`
              : '***'
          } else if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')) {
            sanitized[key] = value.length > 8 
              ? `${value.substring(0, 4)}...${value.slice(-4)}`
              : '***'
          } else {
            sanitized[key] = '***'
          }
        } else {
          sanitized[key] = '***'
        }
      } else {
        sanitized[key] = sanitizeForLogging(value)
      }
    }
    
    return sanitized
  }
  
  return data
}

// Logger sécurisé
export const secureLogger = {
  info: (message: string, data?: any) => {
    logger.info(message, data ? sanitizeForLogging(data) : undefined)
  },
  
  warn: (message: string, data?: any) => {
    logger.warn(message, data ? sanitizeForLogging(data) : undefined)
  },
  
  error: (message: string, data?: any) => {
    logger.error(message, data ? sanitizeForLogging(data) : undefined)
  },
  
  debug: (message: string, data?: any) => {
    logger.debug(message, data ? sanitizeForLogging(data) : undefined)
  }
}

// Fonction pour logger les événements de sécurité
export function logSecurityEvent(
  event: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'ACCESS_DENIED' | 'SUSPICIOUS_ACTIVITY' | 'DATA_ACCESS',
  details: {
    userId?: string
    ip?: string
    userAgent?: string
    endpoint?: string
    reason?: string
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }
) {
  const sanitizedDetails = sanitizeForLogging(details)
  
  logger.info(`SECURITY_EVENT: ${event}`, {
    ...sanitizedDetails,
    timestamp: new Date().toISOString(),
    eventType: 'security'
  })
  
  // En cas d'événement critique, ajouter une alerte
  if (details.severity === 'CRITICAL') {
    logger.error(`CRITICAL_SECURITY_EVENT: ${event}`, sanitizedDetails)
  }
}