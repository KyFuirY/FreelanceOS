import crypto from 'crypto'
import { config } from '@/config/env'

/**
 * Service de chiffrement AES-256-CTR pour les PII - Standard 2025
 * Chiffrement sécurisé des données personnelles en base de données
 */

// Configuration du chiffrement
const ENCRYPTION_ALGORITHM = 'aes-256-ctr'
const IV_LENGTH = 16 // 16 bytes pour CTR
const KEY_LENGTH = 32 // 32 bytes pour AES-256

// Clé de chiffrement dérivée du JWT_SECRET
function getEncryptionKey(): Buffer {
  return crypto.scryptSync(config.JWT_SECRET, 'freelance-salt-2025', KEY_LENGTH)
}

// Interface pour les données chiffrées
interface EncryptedData {
  encrypted: string
  iv: string
}

/**
 * Chiffre une chaîne de caractères avec AES-256-CTR
 */
export function encryptPII(plaintext: string): string {
  if (!plaintext) return plaintext
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const encryptedData: EncryptedData = {
      encrypted,
      iv: iv.toString('hex')
    }
    
    // Retourne un JSON encodé en base64
    return Buffer.from(JSON.stringify(encryptedData)).toString('base64')
    
  } catch (error) {
    console.error('Erreur de chiffrement:', error)
    throw new Error('Erreur de chiffrement des données sensibles')
  }
}

/**
 * Déchiffre une chaîne chiffrée avec AES-256-CTR
 */
export function decryptPII(encryptedText: string): string {
  if (!encryptedText) return encryptedText
  
  try {
    // Décoder le JSON depuis base64
    const encryptedData: EncryptedData = JSON.parse(
      Buffer.from(encryptedText, 'base64').toString('utf8')
    )
    
    const key = getEncryptionKey()
    const iv = Buffer.from(encryptedData.iv, 'hex')
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
    
  } catch (error) {
    console.error('Erreur de déchiffrement:', error)
    // En cas d'erreur, retourner la valeur originale (pour la migration)
    return encryptedText
  }
}

/**
 * Vérifie si une chaîne est déjà chiffrée
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false
  
  try {
    const decoded = Buffer.from(data, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded)
    return typeof parsed === 'object' && 'encrypted' in parsed && 'iv' in parsed
  } catch {
    return false
  }
}

/**
 * Chiffre un objet avec des champs spécifiés
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T, 
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj }
  
  for (const field of fieldsToEncrypt) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encryptPII(encrypted[field] as string) as T[keyof T]
    }
  }
  
  return encrypted
}

/**
 * Déchiffre un objet avec des champs spécifiés
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T, 
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj }
  
  for (const field of fieldsToDecrypt) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      decrypted[field] = decryptPII(decrypted[field] as string) as T[keyof T]
    }
  }
  
  return decrypted
}

// Liste des champs PII à chiffrer automatiquement
export const PII_FIELDS = [
  'email',
  'phone', 
  'address',
  'city',
  'siret',
  'tvaNumber',
  'notes'
] as const

/**
 * Extension Prisma pour chiffrement automatique
 */
export const encryptedPrisma = {
  // Extension pour les utilisateurs
  user: {
    create: (data: any) => encryptFields(data, ['email', 'phone', 'address', 'city', 'siret', 'tvaNumber']),
    update: (data: any) => encryptFields(data, ['email', 'phone', 'address', 'city', 'siret', 'tvaNumber']),
    decrypt: (user: any) => decryptFields(user, ['email', 'phone', 'address', 'city', 'siret', 'tvaNumber'])
  },
  
  // Extension pour les clients
  client: {
    create: (data: any) => encryptFields(data, ['email', 'phone', 'address', 'city', 'siret', 'tvaNumber', 'notes']),
    update: (data: any) => encryptFields(data, ['email', 'phone', 'address', 'city', 'siret', 'tvaNumber', 'notes']),
    decrypt: (client: any) => decryptFields(client, ['email', 'phone', 'address', 'city', 'siret', 'tvaNumber', 'notes'])
  }
}