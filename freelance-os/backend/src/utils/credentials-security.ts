import crypto from 'crypto';
import { config } from '@/config/env';
import { secureLogger, logSecurityEvent } from './secure-logger';

/**
 * Sécurisation des Credentials - Standards 2025
 * Gestion sécurisée des secrets, rotation, chiffrement, vault
 */

// Configuration de sécurité pour les secrets
interface SecretConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  rotationInterval: number; // en millisecondes
}

const SECRET_CONFIG: SecretConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16, 
  tagLength: 16,
  rotationInterval: 30 * 24 * 60 * 60 * 1000 // 30 jours
};

// Master key pour chiffrement des secrets (en production, utilisez un HSM/Vault)
const MASTER_KEY = crypto.scryptSync(config.JWT_SECRET, 'secret-salt', SECRET_CONFIG.keyLength);

// Types de secrets gérés
type SecretType = 'jwt' | 'api_key' | 'database' | 'encryption' | 'oauth';

interface SecretMetadata {
  type: SecretType;
  createdAt: Date;
  lastRotatedAt: Date;
  rotationCount: number;
  isActive: boolean;
  version: number;
}

interface EncryptedSecret {
  encryptedValue: string;
  iv: string;
  tag: string;
  metadata: SecretMetadata;
}

/**
 * Classe de gestion sécurisée des secrets
 */
export class SecureCredentialsManager {
  private secrets: Map<string, EncryptedSecret> = new Map();
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeSecrets();
  }

  /**
   * Chiffre un secret avec AES-256-GCM
   */
  private encryptSecret(plaintext: string): { encryptedValue: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(SECRET_CONFIG.ivLength);
    const cipher = crypto.createCipher(SECRET_CONFIG.algorithm, MASTER_KEY) as crypto.CipherGCM;
    
    // Vérifier si GCM est supporté
    if (typeof (cipher as any).setAAD === 'function') {
      (cipher as any).setAAD(Buffer.from('FreelanceOS-Secret'));
    }

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    let tag = '';
    if (typeof (cipher as any).getAuthTag === 'function') {
      tag = (cipher as any).getAuthTag().toString('base64');
    }

    return {
      encryptedValue: encrypted,
      iv: iv.toString('base64'),
      tag
    };
  }

  /**
   * Déchiffre un secret
   */
  private decryptSecret(encryptedValue: string, iv: string, tag: string): string {
    try {
      const decipher = crypto.createDecipher(SECRET_CONFIG.algorithm, MASTER_KEY) as crypto.DecipherGCM;
      
      // Vérifier si GCM est supporté
      if (typeof (decipher as any).setAAD === 'function') {
        (decipher as any).setAAD(Buffer.from('FreelanceOS-Secret'));
      }
      if (typeof (decipher as any).setAuthTag === 'function' && tag) {
        (decipher as any).setAuthTag(Buffer.from(tag, 'base64'));
      }

      let decrypted = decipher.update(encryptedValue, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      secureLogger.error('SECRET_DECRYPTION_ERROR', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Échec du déchiffrement du secret');
    }
  }

  /**
   * Génère un secret fort
   */
  private generateStrongSecret(type: SecretType, length: number = 64): string {
    switch (type) {
      case 'jwt':
        // JWT secret : caractères alphanumériques + symboles
        return crypto.randomBytes(length).toString('base64url');
      
      case 'api_key':
        // API Key : format UUID-like
        return 'fos_' + crypto.randomUUID().replace(/-/g, '') + '_' + crypto.randomBytes(16).toString('hex');
      
      case 'database':
        // Database password : complexe avec symboles
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
          password += chars.charAt(crypto.randomInt(0, chars.length));
        }
        return password;
      
      case 'encryption':
        // Clé de chiffrement : pure entropie
        return crypto.randomBytes(length).toString('hex');
      
      case 'oauth':
        // OAuth secret : URL-safe
        return crypto.randomBytes(length).toString('base64url');
      
      default:
        return crypto.randomBytes(length).toString('base64url');
    }
  }

  /**
   * Stocke un secret de manière sécurisée
   */
  public storeSecret(name: string, value: string, type: SecretType): void {
    const encrypted = this.encryptSecret(value);
    const metadata: SecretMetadata = {
      type,
      createdAt: new Date(),
      lastRotatedAt: new Date(),
      rotationCount: 0,
      isActive: true,
      version: 1
    };

    const encryptedSecret: EncryptedSecret = {
      ...encrypted,
      metadata
    };

    this.secrets.set(name, encryptedSecret);
    this.scheduleRotation(name);

    logSecurityEvent('DATA_ACCESS', {
      endpoint: 'credential_store',
      reason: `Secret stocké: ${name} (${type})`,
      severity: 'LOW'
    });

    secureLogger.info('SECRET_STORED', {
      name,
      type,
      version: metadata.version
    });
  }

  /**
   * Récupère un secret
   */
  public getSecret(name: string): string | null {
    const encryptedSecret = this.secrets.get(name);
    if (!encryptedSecret || !encryptedSecret.metadata.isActive) {
      secureLogger.warn('SECRET_ACCESS_FAILED', {
        name,
        reason: encryptedSecret ? 'Secret inactif' : 'Secret inexistant'
      });
      return null;
    }

    try {
      const secret = this.decryptSecret(
        encryptedSecret.encryptedValue,
        encryptedSecret.iv,
        encryptedSecret.tag
      );

      // Log d'accès (sans valeur)
      logSecurityEvent('DATA_ACCESS', {
        endpoint: 'credential_access',
        reason: `Accès secret: ${name}`,
        severity: 'LOW'
      });

      return secret;
    } catch (error) {
      secureLogger.error('SECRET_ACCESS_ERROR', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Effectue la rotation d'un secret
   */
  public rotateSecret(name: string): boolean {
    const encryptedSecret = this.secrets.get(name);
    if (!encryptedSecret) {
      return false;
    }

    try {
      // Générer nouveau secret
      const newValue = this.generateStrongSecret(encryptedSecret.metadata.type);
      const encrypted = this.encryptSecret(newValue);

      // Mettre à jour les métadonnées
      const updatedMetadata: SecretMetadata = {
        ...encryptedSecret.metadata,
        lastRotatedAt: new Date(),
        rotationCount: encryptedSecret.metadata.rotationCount + 1,
        version: encryptedSecret.metadata.version + 1
      };

      // Stocker la nouvelle version
      this.secrets.set(name, {
        ...encrypted,
        metadata: updatedMetadata
      });

      // Reprogrammer la prochaine rotation
      this.scheduleRotation(name);

      logSecurityEvent('DATA_ACCESS', {
        endpoint: 'credential_rotation',
        reason: `Rotation secret: ${name} (v${updatedMetadata.version})`,
        severity: 'LOW'
      });

      secureLogger.info('SECRET_ROTATED', {
        name,
        version: updatedMetadata.version,
        rotationCount: updatedMetadata.rotationCount
      });

      return true;
    } catch (error) {
      secureLogger.error('SECRET_ROTATION_ERROR', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Programme la rotation automatique d'un secret
   */
  private scheduleRotation(name: string): void {
    // Annuler le timer précédent
    const existingTimer = this.rotationTimers.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Programmer la nouvelle rotation
    const timer = setTimeout(() => {
      this.rotateSecret(name);
    }, SECRET_CONFIG.rotationInterval);

    this.rotationTimers.set(name, timer);
  }

  /**
   * Révoque un secret (le désactive)
   */
  public revokeSecret(name: string): boolean {
    const encryptedSecret = this.secrets.get(name);
    if (!encryptedSecret) {
      return false;
    }

    encryptedSecret.metadata.isActive = false;
    this.secrets.set(name, encryptedSecret);

    // Annuler la rotation programmée
    const timer = this.rotationTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.rotationTimers.delete(name);
    }

    logSecurityEvent('DATA_ACCESS', {
      endpoint: 'credential_revocation',
      reason: `Secret révoqué: ${name}`,
      severity: 'MEDIUM'
    });

    secureLogger.warn('SECRET_REVOKED', { name });
    return true;
  }

  /**
   * Liste les secrets (métadonnées seulement)
   */
  public listSecrets(): Array<{ name: string; metadata: SecretMetadata }> {
    const result: Array<{ name: string; metadata: SecretMetadata }> = [];
    
    for (const [name, encryptedSecret] of this.secrets.entries()) {
      result.push({
        name,
        metadata: encryptedSecret.metadata
      });
    }

    return result;
  }

  /**
   * Vérifie l'intégrité des secrets
   */
  public verifyIntegrity(): boolean {
    let allValid = true;

    for (const [name, encryptedSecret] of this.secrets.entries()) {
      try {
        // Essayer de déchiffrer pour vérifier l'intégrité
        this.decryptSecret(
          encryptedSecret.encryptedValue,
          encryptedSecret.iv,
          encryptedSecret.tag
        );
      } catch (error) {
        secureLogger.error('SECRET_INTEGRITY_FAILED', {
          name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        allValid = false;
      }
    }

    if (!allValid) {
      logSecurityEvent('SUSPICIOUS_ACTIVITY', {
        endpoint: 'credential_integrity',
        reason: 'Échec de vérification d\'intégrité des secrets',
        severity: 'CRITICAL'
      });
    }

    return allValid;
  }

  /**
   * Initialise les secrets système
   */
  private initializeSecrets(): void {
    // Initialiser les secrets principaux s'ils n'existent pas
    if (!this.secrets.has('jwt_primary')) {
      this.storeSecret('jwt_primary', config.JWT_SECRET, 'jwt');
    }

    secureLogger.info('CREDENTIALS_MANAGER_INITIALIZED', {
      secretCount: this.secrets.size
    });
  }

  /**
   * Nettoie les ressources
   */
  public cleanup(): void {
    // Arrêter tous les timers
    for (const timer of this.rotationTimers.values()) {
      clearTimeout(timer);
    }
    this.rotationTimers.clear();

    secureLogger.info('CREDENTIALS_MANAGER_CLEANUP_COMPLETE');
  }
}

// Instance globale du gestionnaire de secrets
export const credentialsManager = new SecureCredentialsManager();

/**
 * Configuration JWT sécurisée
 */
export const SECURE_JWT_CONFIG = {
  secret: () => credentialsManager.getSecret('jwt_primary') || config.JWT_SECRET,
  sign: {
    algorithm: 'HS256' as const,
    expiresIn: '15m', // Courte durée
    issuer: 'FreelanceOS',
    audience: 'freelance-os-client'
  },
  verify: {
    algorithms: ['HS256'] as const,
    issuer: 'FreelanceOS',
    audience: 'freelance-os-client',
    maxAge: '15m'
  }
};

/**
 * Utilitaires pour la validation des variables d'environnement
 */
export const ENV_SECURITY_CHECKS = {
  /**
   * Vérifie la robustesse des secrets dans l'environnement
   */
  validateEnvironmentSecrets(): Array<{ variable: string; issue: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> {
    const issues: Array<{ variable: string; issue: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    // JWT Secret
    if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
      issues.push({
        variable: 'JWT_SECRET',
        issue: 'Secret JWT trop court (< 32 caractères)',
        severity: 'CRITICAL'
      });
    }

    // Database URL
    if (config.DATABASE_URL?.includes('password=')) {
      const urlParts = config.DATABASE_URL.split('password=')[1];
      if (urlParts) {
        const passwordPart = urlParts.split('&')[0]?.split('@')[0];
        if (passwordPart && passwordPart.length < 12) {
          issues.push({
            variable: 'DATABASE_URL',
            issue: 'Mot de passe base de données trop court',
            severity: 'HIGH'
          });
        }
      }
    }

    // Node Environment
    if (config.NODE_ENV === 'development' && process.env.NODE_ENV === 'production') {
      issues.push({
        variable: 'NODE_ENV',
        issue: 'Incohérence entre config et process.env',
        severity: 'HIGH'
      });
    }

    return issues;
  },

  /**
   * Génère un rapport de sécurité des credentials
   */
  generateSecurityReport(): {
    score: number;
    issues: Array<{ variable: string; issue: string; severity: string }>;
    recommendations: string[];
  } {
    const issues = this.validateEnvironmentSecrets();
    const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
    const highCount = issues.filter(i => i.severity === 'HIGH').length;
    const mediumCount = issues.filter(i => i.severity === 'MEDIUM').length;

    // Calcul du score de sécurité
    const maxScore = 100;
    const score = Math.max(0, maxScore - (criticalCount * 40) - (highCount * 20) - (mediumCount * 10));

    const recommendations = [
      'Utiliser des secrets de 32+ caractères',
      'Activer la rotation automatique des secrets',
      'Utiliser un vault externe en production (HashiCorp Vault, Azure Key Vault)',
      'Chiffrer les secrets au repos',
      'Auditer régulièrement l\'accès aux secrets'
    ];

    return {
      score,
      issues,
      recommendations
    };
  }
};

export default {
  SecureCredentialsManager,
  credentialsManager,
  SECURE_JWT_CONFIG,
  ENV_SECURITY_CHECKS
};