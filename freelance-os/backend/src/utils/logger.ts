import winston from 'winston'
import { config } from '@/config/env'

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`
    }
    
    return log
  })
)

// Configuration du logger
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: customFormat,
  defaultMeta: {
    service: 'freelance-os-backend'
  },
  transports: [
    // Console (toujours actif en développement)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

// Ajout de fichiers de logs en production
if (config.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  )
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  )
}

// Helper pour logger les requêtes HTTP
export const logRequest = (method: string, url: string, statusCode: number, responseTime: number, userAgent?: string) => {
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    userAgent
  })
}

// Helper pour logger les erreurs avec contexte
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context
  })
}

// Helper pour logger les actions utilisateur importantes
export const logUserAction = (userId: string, action: string, resource: string, details?: Record<string, any>) => {
  logger.info('User Action', {
    userId,
    action,
    resource,
    ...details
  })
}