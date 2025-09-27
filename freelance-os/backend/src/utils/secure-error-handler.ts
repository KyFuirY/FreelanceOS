/**
 * Gestionnaire d'Erreurs Sécurisé
 * Empêche l'exposition de stack traces et d'informations sensibles
 * Conforme aux standards de sécurité 2025
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { secureLogger } from './secure-logger';
const env = {
  NODE_ENV: process.env.NODE_ENV || 'development'
};

/**
 * Types d'erreurs supportés
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT_EXCEEDED',
  INTERNAL = 'INTERNAL_SERVER_ERROR',
  DATABASE = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  SECURITY = 'SECURITY_VIOLATION'
}

/**
 * Niveaux de sévérité
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Interface pour les erreurs sécurisées
 */
export interface SecureError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  statusCode: number;
  timestamp: Date;
  requestId?: string | undefined;
  userId?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Messages d'erreur génériques pour les utilisateurs
 */
const USER_ERROR_MESSAGES = {
  [ErrorType.VALIDATION]: 'Les données fournies ne sont pas valides.',
  [ErrorType.AUTHENTICATION]: 'Authentification requise.',
  [ErrorType.AUTHORIZATION]: 'Accès non autorisé.',
  [ErrorType.RESOURCE_NOT_FOUND]: 'Ressource introuvable.',
  [ErrorType.RATE_LIMIT]: 'Trop de requêtes. Veuillez réessayer plus tard.',
  [ErrorType.INTERNAL]: 'Une erreur interne est survenue.',
  [ErrorType.DATABASE]: 'Erreur de base de données.',
  [ErrorType.EXTERNAL_SERVICE]: 'Service externe indisponible.',
  [ErrorType.SECURITY]: 'Violation de sécurité détectée.'
} as const;

/**
 * Mapping des types d'erreur vers les codes HTTP
 */
const ERROR_STATUS_CODES = {
  [ErrorType.VALIDATION]: 400,
  [ErrorType.AUTHENTICATION]: 401,
  [ErrorType.AUTHORIZATION]: 403,
  [ErrorType.RESOURCE_NOT_FOUND]: 404,
  [ErrorType.RATE_LIMIT]: 429,
  [ErrorType.INTERNAL]: 500,
  [ErrorType.DATABASE]: 500,
  [ErrorType.EXTERNAL_SERVICE]: 503,
  [ErrorType.SECURITY]: 403
} as const;

/**
 * Générateur d'identifiants d'erreur uniques
 */
function generateErrorId(): string {
  return `ERR_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * Détermination automatique du niveau de sévérité
 */
function determineSeverity(type: ErrorType, statusCode: number): ErrorSeverity {
  if (type === ErrorType.SECURITY) return ErrorSeverity.CRITICAL;
  if (statusCode >= 500) return ErrorSeverity.HIGH;
  if (statusCode >= 400) return ErrorSeverity.MEDIUM;
  return ErrorSeverity.LOW;
}

/**
 * Création d'une erreur sécurisée
 */
export function createSecureError(
  type: ErrorType,
  originalError: Error | string,
  options: {
    userMessage?: string;
    statusCode?: number;
    severity?: ErrorSeverity;
    metadata?: Record<string, any>;
    requestId?: string;
    userId?: string;
  } = {}
): SecureError {
  const errorId = generateErrorId();
  const statusCode = options.statusCode || ERROR_STATUS_CODES[type];
  const severity = options.severity || determineSeverity(type, statusCode);
  
  const secureError: SecureError = {
    id: errorId,
    type,
    severity,
    message: originalError instanceof Error ? originalError.message : originalError,
    userMessage: options.userMessage || USER_ERROR_MESSAGES[type],
    statusCode,
    timestamp: new Date(),
    requestId: options.requestId,
    userId: options.userId,
    metadata: options.metadata
  };

  return secureError;
}

/**
 * Sanitisation des stack traces pour le logging
 */
function sanitizeStackTrace(error: Error): string {
  if (!error.stack) return 'No stack trace available';
  
  return error.stack
    .split('\n')
    .map(line => {
      // Masquer les chemins absolus
      return line.replace(/\/[^\/\s]+\/[^\/\s]+\/[^\/\s]+/g, '[PATH_HIDDEN]')
                .replace(/C:\\[^\s]+/g, '[PATH_HIDDEN]')
                .replace(/at\s+[^\/\s]+\/[^\/\s]+/g, 'at [LOCATION_HIDDEN]');
    })
    .join('\n');
}

/**
 * Logging sécurisé des erreurs
 */
function logSecureError(secureError: SecureError, originalError?: Error) {
  const logData = {
    errorId: secureError.id,
    type: secureError.type,
    severity: secureError.severity,
    statusCode: secureError.statusCode,
    requestId: secureError.requestId,
    userId: secureError.userId,
    userMessage: secureError.userMessage,
    timestamp: secureError.timestamp,
    metadata: secureError.metadata
  };

  // Ajout de la stack trace seulement en développement
  if (env.NODE_ENV === 'development' && originalError?.stack) {
    Object.assign(logData, {
      internalMessage: secureError.message,
      stackTrace: sanitizeStackTrace(originalError)
    });
  }

  // Log selon la sévérité
  switch (secureError.severity) {
    case ErrorSeverity.CRITICAL:
      secureLogger.error('ERREUR CRITIQUE', logData);
      break;
    case ErrorSeverity.HIGH:
      secureLogger.error('ERREUR ÉLEVÉE', logData);
      break;
    case ErrorSeverity.MEDIUM:
      secureLogger.warn('ERREUR MOYENNE', logData);
      break;
    case ErrorSeverity.LOW:
      secureLogger.info('ERREUR FAIBLE', logData);
      break;
  }
}

/**
 * Réponse sécurisée à l'utilisateur
 */
export function sendSecureErrorResponse(
  reply: FastifyReply, 
  secureError: SecureError
): void {
  const responseBody = {
    error: {
      id: secureError.id,
      type: secureError.type,
      message: secureError.userMessage,
      timestamp: secureError.timestamp
    }
  };

  // Ajout d'informations détaillées seulement en développement
  if (env.NODE_ENV === 'development') {
    Object.assign(responseBody.error, {
      internalMessage: secureError.message,
      severity: secureError.severity,
      metadata: secureError.metadata
    });
  }

  reply.status(secureError.statusCode).send(responseBody);
}

/**
 * Gestionnaire d'erreurs global pour Fastify
 */
export function secureErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  let secureError: SecureError;

  // Détection du type d'erreur
  if (error.name === 'ValidationError') {
    secureError = createSecureError(ErrorType.VALIDATION, error, {
      requestId: request.id,
      metadata: { url: request.url, method: request.method }
    });
  } else if (error.message.includes('Unauthorized')) {
    secureError = createSecureError(ErrorType.AUTHENTICATION, error, {
      requestId: request.id,
      metadata: { url: request.url, ip: request.ip }
    });
  } else if (error.message.includes('Forbidden')) {
    secureError = createSecureError(ErrorType.AUTHORIZATION, error, {
      requestId: request.id,
      metadata: { url: request.url, ip: request.ip }
    });
  } else if (error.message.includes('rate limit')) {
    secureError = createSecureError(ErrorType.RATE_LIMIT, error, {
      requestId: request.id,
      metadata: { ip: request.ip, userAgent: request.headers['user-agent'] }
    });
  } else if (error.message.includes('database') || error.message.includes('connection')) {
    secureError = createSecureError(ErrorType.DATABASE, error, {
      requestId: request.id
    });
  } else if (error.message.includes('security') || error.message.includes('attack')) {
    secureError = createSecureError(ErrorType.SECURITY, error, {
      requestId: request.id,
      severity: ErrorSeverity.CRITICAL,
      metadata: { 
        ip: request.ip, 
        userAgent: request.headers['user-agent'],
        url: request.url,
        method: request.method
      }
    });
  } else {
    secureError = createSecureError(ErrorType.INTERNAL, error, {
      requestId: request.id
    });
  }

  // Log de l'erreur
  logSecureError(secureError, error);

  // Réponse sécurisée
  sendSecureErrorResponse(reply, secureError);
}

/**
 * Middleware de capture d'erreurs non gérées
 */
export function setupGlobalErrorHandlers(): void {
  // Capture des erreurs non gérées
  process.on('uncaughtException', (error: Error) => {
    const secureError = createSecureError(ErrorType.INTERNAL, error, {
      severity: ErrorSeverity.CRITICAL,
      metadata: { source: 'uncaughtException' }
    });
    
    logSecureError(secureError, error);
    
    // En production, on peut redémarrer le processus après nettoyage
    if (env.NODE_ENV === 'production') {
      setTimeout(() => process.exit(1), 1000);
    }
  });

  // Capture des promesses rejetées
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    
    const secureError = createSecureError(ErrorType.INTERNAL, error, {
      severity: ErrorSeverity.HIGH,
      metadata: { source: 'unhandledRejection', promise: promise.toString() }
    });
    
    logSecureError(secureError, error);
  });
}

/**
 * Utilitaire pour les erreurs métier personnalisées
 */
export class SecureBusinessError extends Error {
  public readonly type: ErrorType;
  public readonly userMessage: string;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, any> | undefined;

  constructor(
    type: ErrorType,
    message: string,
    userMessage?: string,
    statusCode?: number,
    metadata?: Record<string, any> | undefined
  ) {
    super(message);
    this.name = 'SecureBusinessError';
    this.type = type;
    this.userMessage = userMessage || USER_ERROR_MESSAGES[type];
    this.statusCode = statusCode || ERROR_STATUS_CODES[type];
    this.metadata = metadata;
  }
}

/**
 * Configuration des headers de sécurité pour les erreurs
 */
export const ERROR_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache'
} as const;

export default {
  createSecureError,
  sendSecureErrorResponse,
  secureErrorHandler,
  setupGlobalErrorHandlers,
  SecureBusinessError,
  ErrorType,
  ErrorSeverity,
  ERROR_SECURITY_HEADERS
};