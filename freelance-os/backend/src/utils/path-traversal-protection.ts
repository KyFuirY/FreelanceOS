import path from 'path';
import { secureLogger, logSecurityEvent } from './secure-logger';

/**
 * Protection complète contre les attaques Path Traversal (2025)
 * Sécurise les chemins de fichiers et répertoires
 */

// Patterns dangereux pour traversée de chemin
const DANGEROUS_PATH_PATTERNS = [
  /\.\./g,                    // Traversée classique (..)
  /\.\/|\.\\/, /\.{2,}/g,    // Variations de points
  /\/\.\./g, /\\\.\.\\?/g,   // Traversée avec séparateurs
  /\.\.\/|\.\.\\/, /\.\.\//g, // Traversée mixte
  /\/\.{2,}/g, /\\\.{2,}\\?/g, // Points multiples
  /%2e%2e/gi,                // Encodage URL (..)
  /%252e%252e/gi,            // Double encodage URL
  /%c0%ae%c0%ae/gi,          // Encodage UTF-8 overlong
  /%e0%80%ae%e0%80%ae/gi,    // Autre encodage UTF-8
  /\x2e\x2e/g,               // Encodage hexadécimal
  /\.%2e/gi, /%2e\./gi,      // Encodage mixte
  /\.%252e/gi, /%252e\./gi,  // Double encodage mixte
  /\?.*\.\./g,               // Traversée via query string
  /#.*\.\./g,                // Traversée via fragment
  /file:/gi,                 // Protocol file dangereux
  /^\/proc\//gi,             // Accès proc Linux
  /^\/dev\//gi,              // Accès devices Linux
  /^\/sys\//gi,              // Accès sys Linux
  /^C:\\Windows\\/gi,        // Accès système Windows
  /^C:\\Program Files\\/gi,  // Program Files Windows
  /^\/etc\//gi,              // Config système Unix
  /^\/var\//gi,              // Var système Unix
  /^\/root\//gi,             // Home root Unix
  /^\/home\/.*\/\./gi,       // Traversée home dirs
  /\.\.[\\/]/g,              // Traversée avec slash
  /[\\/]\.\.[\\/]/g,         // Traversée encadrée
  /^\.\./g,                  // Début par traversée
  /\.\.$/g,                  // Fin par traversée
];

// Extensions de fichiers dangereuses
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar',
  '.sh', '.ps1', '.py', '.php', '.asp', '.aspx', '.jsp',
  '.dll', '.sys', '.ini', '.cfg', '.conf', '.htaccess',
  '.passwd', '.shadow', '.key', '.pem', '.crt'
];

// Répertoires système interdits (absolus)
const FORBIDDEN_DIRECTORIES = [
  '/etc', '/proc', '/dev', '/sys', '/root', '/boot',
  '/var/log', '/var/lib', '/usr/bin', '/usr/sbin',
  'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
  'C:\\Users\\Default', 'C:\\ProgramData', 'C:\\System Volume Information',
  '/System', '/Library', '/private', '/usr/local/bin'
];

// Noms de fichiers système interdits
const FORBIDDEN_FILENAMES = [
  'passwd', 'shadow', 'hosts', 'fstab', 'sudoers',
  'web.config', '.htaccess', '.htpasswd', '.env',
  'config.php', 'wp-config.php', 'database.yml',
  'secrets.json', 'private.key', 'id_rsa', 'id_dsa'
];

/**
 * Interface pour le résultat de validation
 */
interface PathValidationResult {
  isValid: boolean;
  sanitized?: string;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Nettoie et sécurise un chemin de fichier
 * @param filePath - Chemin à sécuriser
 * @returns Chemin sécurisé ou null si dangereux
 */
export function sanitizeFilePath(filePath: string): PathValidationResult {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { isValid: false, reason: 'Chemin invalide', severity: 'medium' };
    }

    const originalPath = filePath.trim();
    
    // Décodage URL récursif pour éviter les bypasses
    let decodedPath = originalPath;
    let previousPath = '';
    let attempts = 0;
    
    while (decodedPath !== previousPath && attempts < 5) {
      previousPath = decodedPath;
      try {
        decodedPath = decodeURIComponent(decodedPath);
      } catch {
        // Si décodage échoue, on garde la version précédente
        break;
      }
      attempts++;
    }

    // Vérification des patterns dangereux
    for (const pattern of DANGEROUS_PATH_PATTERNS) {
      if (pattern.test(decodedPath)) {
        logSecurityEvent('SUSPICIOUS_ACTIVITY', {
          endpoint: 'path_traversal_attempt',
          reason: `Pattern dangereux détecté: ${pattern.toString()}`,
          severity: 'HIGH',
          ip: 'unknown' // sera rempli par le hook
        });
        return { 
          isValid: false, 
          reason: 'Tentative de traversée détectée', 
          severity: 'high' 
        };
      }
    }

    // Normalisation sécurisée du chemin
    const normalizedPath = path.normalize(decodedPath).replace(/\\/g, '/');
    
    // Vérification d'extension dangereuse
    const ext = path.extname(normalizedPath).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      return { 
        isValid: false, 
        reason: `Extension dangereuse: ${ext}`, 
        severity: 'high' 
      };
    }

    // Vérification des répertoires interdits
    for (const forbiddenDir of FORBIDDEN_DIRECTORIES) {
      if (normalizedPath.toLowerCase().startsWith(forbiddenDir.toLowerCase())) {
        logSecurityEvent('ACCESS_DENIED', {
          endpoint: 'forbidden_directory_access',
          reason: `Tentative d'accès à: ${forbiddenDir}`,
          severity: 'CRITICAL'
        });
        return { 
          isValid: false, 
          reason: `Accès interdit: ${forbiddenDir}`, 
          severity: 'critical' 
        };
      }
    }

    // Vérification des noms de fichiers interdits
    const filename = path.basename(normalizedPath).toLowerCase();
    for (const forbiddenFile of FORBIDDEN_FILENAMES) {
      if (filename === forbiddenFile || filename.startsWith(forbiddenFile + '.')) {
        return { 
          isValid: false, 
          reason: `Fichier système interdit: ${filename}`, 
          severity: 'high' 
        };
      }
    }

    // Vérification de la longueur (DoS prevention)
    if (normalizedPath.length > 255) {
      return { 
        isValid: false, 
        reason: 'Chemin trop long', 
        severity: 'medium' 
      };
    }

    // Vérification des caractères interdits
    const invalidChars = /[<>:"|?*\x00-\x1f\x7f]/g;
    if (invalidChars.test(normalizedPath)) {
      return { 
        isValid: false, 
        reason: 'Caractères interdits dans le chemin', 
        severity: 'medium' 
      };
    }

    return {
      isValid: true,
      sanitized: normalizedPath,
      severity: 'low'
    };

  } catch (error) {
    secureLogger.error('PATH_SANITIZATION_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      originalPath: filePath
    });
    return { 
      isValid: false, 
      reason: 'Erreur de traitement du chemin', 
      severity: 'medium' 
    };
  }
}

/**
 * Valide un chemin pour les uploads de fichiers
 * @param filename - Nom du fichier
 * @param allowedExtensions - Extensions autorisées
 * @returns Résultat de validation
 */
export function validateUploadPath(
  filename: string, 
  allowedExtensions: string[] = ['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.csv']
): PathValidationResult {
  
  const pathResult = sanitizeFilePath(filename);
  if (!pathResult.isValid) {
    return pathResult;
  }

  const ext = path.extname(filename).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return {
      isValid: false,
      reason: `Extension non autorisée: ${ext}`,
      severity: 'medium'
    };
  }

  // Vérification de la taille du nom de fichier
  const baseName = path.basename(filename, ext);
  if (baseName.length > 100) {
    return {
      isValid: false,
      reason: 'Nom de fichier trop long',
      severity: 'medium'
    };
  }

  return pathResult;
}

/**
 * Crée un chemin sécurisé pour les fichiers dans un répertoire de base
 * @param basePath - Répertoire de base sécurisé
 * @param userPath - Chemin fourni par l'utilisateur
 * @returns Chemin sécurisé complet ou null
 */
export function createSecurePath(basePath: string, userPath: string): string | null {
  const validation = sanitizeFilePath(userPath);
  
  if (!validation.isValid || !validation.sanitized) {
    return null;
  }

  const fullPath = path.resolve(basePath, validation.sanitized);
  const normalizedBasePath = path.resolve(basePath);

  // Vérification que le chemin reste dans le répertoire de base
  if (!fullPath.startsWith(normalizedBasePath)) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      endpoint: 'path_escape_attempt',
      reason: `Tentative d'échappement: ${fullPath}`,
      severity: 'CRITICAL'
    });
    return null;
  }

  return fullPath;
}

/**
 * Hook Fastify pour valider les paramètres de chemin
 */
export function pathTraversalValidationHook() {
  return async function (request: any, reply: any) {
    // Vérification des paramètres de route
    if (request.params) {
      for (const [key, value] of Object.entries(request.params)) {
        if (typeof value === 'string') {
          const validation = sanitizeFilePath(value);
          if (!validation.isValid) {
            logSecurityEvent('SUSPICIOUS_ACTIVITY', {
              endpoint: 'path_param_attack',
              reason: `Paramètre dangereux: ${key}=${value}`,
              severity: 'HIGH',
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              userId: request.user?.id
            });
            
            reply.code(400).send({
              error: 'Paramètre de chemin non valide',
              code: 'INVALID_PATH_PARAM'
            });
            return;
          }
        }
      }
    }

    // Vérification des paramètres de query
    if (request.query) {
      const pathParams = ['path', 'file', 'filename', 'dir', 'directory'];
      for (const param of pathParams) {
        if (request.query[param] && typeof request.query[param] === 'string') {
          const validation = sanitizeFilePath(request.query[param]);
          if (!validation.isValid) {
            logSecurityEvent('SUSPICIOUS_ACTIVITY', {
              endpoint: 'path_query_attack',
              reason: `Query param dangereux: ${param}=${request.query[param]}`,
              severity: 'HIGH',
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              userId: request.user?.id
            });
            
            reply.code(400).send({
              error: 'Paramètre de requête non valide',
              code: 'INVALID_QUERY_PARAM'
            });
            return;
          }
        }
      }
    }
  };
}

/**
 * Middleware pour sécuriser les opérations sur fichiers
 */
export const PATH_SECURITY_CONFIG = {
  maxPathLength: 255,
  allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.csv', '.doc', '.docx'],
  forbiddenPatterns: DANGEROUS_PATH_PATTERNS,
  secureDirectories: {
    uploads: './uploads',
    temp: './temp',
    exports: './exports'
  }
};

export default {
  sanitizeFilePath,
  validateUploadPath,
  createSecurePath,
  pathTraversalValidationHook,
  PATH_SECURITY_CONFIG
};