import { z } from 'zod'

/**
 * Schémas de validation sécurisés - Standard 2025
 * Protection contre les attaques DoS, injections et overflow
 */

// Limites de sécurité strictes
export const SECURITY_LIMITS = {
  // Champs texte courants
  NAME_MIN: 1,
  NAME_MAX: 50,         // Réduit de 100 pour sécurité
  EMAIL_MAX: 100,
  PHONE_MAX: 20,
  
  // Champs longs
  ADDRESS_MAX: 100,     // Réduit de 200
  NOTES_MAX: 500,       // Réduit de 2000 pour éviter DoS
  DESCRIPTION_MAX: 1000,
  
  // Champs sensibles
  SIRET_LENGTH: 14,
  TVA_MAX: 15,
  ZIP_LENGTH: 5,
  COUNTRY_LENGTH: 2,
  
  // Mots de passe
  PASSWORD_MIN: 12,     // Renforcé de 8 à 12
  PASSWORD_MAX: 128,
  
  // Arrays
  TAGS_MAX: 10,
  TAG_LENGTH_MAX: 30
} as const

// Regex de sécurité renforcées
export const SECURITY_PATTERNS = {
  // Validation stricte email (prévient injection)
  EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  
  // Téléphone français strict
  PHONE_FR: /^(?:\+33|0)[1-9](?:[0-9]{8})$/,
  
  // SIRET français (14 chiffres exacts)
  SIRET: /^\d{14}$/,
  
  // TVA française
  TVA_FR: /^FR\d{11}$/,
  
  // Code postal français
  ZIP_FR: /^\d{5}$/,
  
  // Nom sécurisé (pas de caractères dangereux)
  SAFE_NAME: /^[a-zA-ZÀ-ÿ\s\-']{1,50}$/,
  
  // Texte sécurisé (bloque scripts et injections)
  SAFE_TEXT: /^[^<>\"'`;\\{}]*$/,
  
  // Mot de passe fort (2025)
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/
} as const

// Messages d'erreur sécurisés (ne révèlent pas trop d'info)
export const SECURITY_MESSAGES = {
  INVALID_FORMAT: 'Format invalide',
  TOO_LONG: 'Données trop volumineuses',
  TOO_SHORT: 'Données insuffisantes',
  INVALID_CHARS: 'Caractères non autorisés',
  WEAK_PASSWORD: 'Mot de passe trop faible'
} as const

// Validation sécurisée des noms
export const secureNameSchema = z
  .string()
  .min(SECURITY_LIMITS.NAME_MIN, SECURITY_MESSAGES.TOO_SHORT)
  .max(SECURITY_LIMITS.NAME_MAX, SECURITY_MESSAGES.TOO_LONG)
  .regex(SECURITY_PATTERNS.SAFE_NAME, SECURITY_MESSAGES.INVALID_CHARS)

// Validation sécurisée des emails
export const secureEmailSchema = z
  .string()
  .max(SECURITY_LIMITS.EMAIL_MAX, SECURITY_MESSAGES.TOO_LONG)
  .regex(SECURITY_PATTERNS.EMAIL, SECURITY_MESSAGES.INVALID_FORMAT)

// Validation sécurisée des mots de passe
export const securePasswordSchema = z
  .string()
  .min(SECURITY_LIMITS.PASSWORD_MIN, `Minimum ${SECURITY_LIMITS.PASSWORD_MIN} caractères`)
  .max(SECURITY_LIMITS.PASSWORD_MAX, SECURITY_MESSAGES.TOO_LONG)
  .regex(SECURITY_PATTERNS.STRONG_PASSWORD, 'Doit contenir: majuscule, minuscule, chiffre et caractère spécial')

// Validation sécurisée du téléphone
export const securePhoneSchema = z
  .string()
  .max(SECURITY_LIMITS.PHONE_MAX, SECURITY_MESSAGES.TOO_LONG)
  .regex(SECURITY_PATTERNS.PHONE_FR, 'Numéro de téléphone français invalide')
  .optional()

// Validation sécurisée des adresses
export const secureAddressSchema = z
  .string()
  .max(SECURITY_LIMITS.ADDRESS_MAX, SECURITY_MESSAGES.TOO_LONG)
  .regex(SECURITY_PATTERNS.SAFE_TEXT, SECURITY_MESSAGES.INVALID_CHARS)
  .optional()

// Validation sécurisée des notes
export const secureNotesSchema = z
  .string()
  .max(SECURITY_LIMITS.NOTES_MAX, SECURITY_MESSAGES.TOO_LONG)
  .regex(SECURITY_PATTERNS.SAFE_TEXT, SECURITY_MESSAGES.INVALID_CHARS)
  .optional()

// Validation sécurisée SIRET
export const secureSiretSchema = z
  .string()
  .regex(SECURITY_PATTERNS.SIRET, 'SIRET invalide (14 chiffres)')
  .optional()

// Validation sécurisée TVA
export const secureTvaSchema = z
  .string()
  .max(SECURITY_LIMITS.TVA_MAX, SECURITY_MESSAGES.TOO_LONG)
  .regex(SECURITY_PATTERNS.TVA_FR, 'Numéro TVA français invalide')
  .optional()

// Validation sécurisée code postal
export const secureZipSchema = z
  .string()
  .regex(SECURITY_PATTERNS.ZIP_FR, 'Code postal français invalide')
  .optional()

// Validation sécurisée pays
export const secureCountrySchema = z
  .string()
  .length(SECURITY_LIMITS.COUNTRY_LENGTH, 'Code pays sur 2 lettres')
  .default('FR')

// Validation sécurisée des tags
export const secureTagsSchema = z
  .array(
    z.string()
      .max(SECURITY_LIMITS.TAG_LENGTH_MAX, SECURITY_MESSAGES.TOO_LONG)
      .regex(SECURITY_PATTERNS.SAFE_TEXT, SECURITY_MESSAGES.INVALID_CHARS)
  )
  .max(SECURITY_LIMITS.TAGS_MAX, `Maximum ${SECURITY_LIMITS.TAGS_MAX} tags`)
  .default([])

// Fonction pour valider et nettoyer les inputs
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return ''
  
  return input
    .trim()
    .replace(/\0/g, '') // Supprime null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Supprime caractères de contrôle
}

// Validation taille de payload pour éviter DoS
export function validatePayloadSize(payload: any, maxSizeKB: number = 10): boolean {
  const payloadSize = JSON.stringify(payload).length
  const maxSizeBytes = maxSizeKB * 1024
  
  return payloadSize <= maxSizeBytes
}