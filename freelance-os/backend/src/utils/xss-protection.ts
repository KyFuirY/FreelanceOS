import DOMPurify from 'isomorphic-dompurify'

/**
 * Protection XSS - Standard 2025
 * Sanitization complète contre les attaques Cross-Site Scripting
 */

// Configuration DOMPurify sécurisée
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [], // Aucune balise HTML autorisée par défaut
  ALLOWED_ATTR: [], // Aucun attribut autorisé par défaut
  KEEP_CONTENT: true, // Garder le contenu texte
  ALLOW_DATA_ATTR: false, // Interdire data-* attributs
  ALLOW_UNKNOWN_PROTOCOLS: false, // Interdire protocoles inconnus
  SANITIZE_DOM: true, // Nettoyer le DOM
  FORBID_CONTENTS: ['script', 'style', 'object', 'embed', 'form'], // Contenu interdit
  FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'textarea', 'select'], // Balises interdites
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'] // Attributs interdits
}

// Patterns XSS dangereux
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Scripts
  /javascript:/gi, // URLs javascript
  /vbscript:/gi, // URLs vbscript
  /on\w+\s*=/gi, // Handlers d'événements
  /expression\s*\(/gi, // CSS expressions (IE)
  /url\s*\(/gi, // CSS url() avec potentiel JS
  /&lt;script/gi, // Scripts encodés
  /&lt;iframe/gi, // iframes encodés
  /data:text\/html/gi, // Data URLs HTML
  /\<\s*meta\s+http-equiv/gi // Meta refresh attacks
]

/**
 * Sanitise une chaîne contre les attaques XSS
 */
export function sanitizeXSS(input: string): string {
  if (!input || typeof input !== 'string') {
    return input
  }

  try {
    // 1. Détection de patterns dangereux
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error(`Contenu XSS détecté: ${pattern.source}`)
      }
    }

    // 2. Nettoyage avec DOMPurify
    let sanitized = DOMPurify.sanitize(input, PURIFY_CONFIG)

    // 3. Décodage des entités HTML doubles
    sanitized = sanitized.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')

    // 4. Re-vérification après décodage
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(sanitized)) {
        throw new Error(`Contenu XSS persistant détecté après sanitization`)
      }
    }

    // 5. Limitation de longueur (anti-DoS)
    if (sanitized.length > 10000) {
      throw new Error('Contenu trop long après sanitization')
    }

    return sanitized

  } catch (error) {
    console.error('Erreur sanitization XSS:', error)
    throw new Error('Contenu non autorisé détecté')
  }
}

/**
 * Sanitise récursivement un objet contre XSS
 */
export function sanitizeObjectXSS<T extends Record<string, any>>(obj: T, fieldsToSanitize: (keyof T)[] = []): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const sanitized: any = { ...obj }

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      // Si aucun champ spécifié, sanitiser tout
      // Sinon, sanitiser seulement les champs spécifiés
      if (fieldsToSanitize.length === 0 || fieldsToSanitize.includes(key)) {
        sanitized[key] = sanitizeXSS(value)
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeXSS(item) : item
      )
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObjectXSS(value as any, fieldsToSanitize)
    }
  }

  return sanitized as T
}

/**
 * Middleware de validation XSS pour Fastify
 */
export function xssValidationHook(fieldsToCheck: string[] = []) {
  return async function(request: any, reply: any) {
    try {
      if (request.body && typeof request.body === 'object') {
        // Vérifier les champs spécifiés ou tous les champs string
        const fieldsToValidate = fieldsToCheck.length > 0 ? fieldsToCheck : 
          Object.keys(request.body).filter(key => typeof request.body[key] === 'string')

        for (const field of fieldsToValidate) {
          if (request.body[field] && typeof request.body[field] === 'string') {
            try {
              request.body[field] = sanitizeXSS(request.body[field])
            } catch (error) {
              return reply.status(400).send({
                error: 'Contenu non autorisé',
                message: `Le champ "${field}" contient du contenu non autorisé`,
                code: 'XSS_DETECTED'
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Erreur hook XSS:', error)
      return reply.status(400).send({
        error: 'Validation échouée',
        message: 'Impossible de valider le contenu de la requête'
      })
    }
  }
}

/**
 * Headers de sécurité XSS
 */
export const XSS_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'"
  ].join('; ')
}

// Champs sensibles à toujours nettoyer
export const SENSITIVE_XSS_FIELDS = [
  'name',
  'email', 
  'company',
  'address',
  'city',
  'notes',
  'description',
  'comment',
  'title',
  'subject',
  'content'
] as const