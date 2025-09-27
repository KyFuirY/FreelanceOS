/**
 * Scanner et Moniteur de Ports
 * Analyse l'exposition réseau et identifie les risques de sécurité
 * Conforme aux standards de sécurité 2025
 */

import * as net from 'net';
import { secureLogger } from './secure-logger';

/**
 * Configuration des ports à surveiller
 */
export const PORT_SECURITY_CONFIG = {
  // Ports autorisés pour l'application
  ALLOWED_PORTS: [
    3000, // Port principal de l'application
    3001, // Port de développement
    5432, // PostgreSQL (base de données)
    6379, // Redis (cache)
    8080  // Port alternatif si configuré
  ] as const,

  // Ports dangereux à surveiller
  DANGEROUS_PORTS: [
    22,    // SSH
    23,    // Telnet
    25,    // SMTP
    53,    // DNS
    80,    // HTTP (production doit utiliser HTTPS)
    110,   // POP3
    135,   // RPC
    139,   // NetBIOS
    443,   // HTTPS (OK si configuré)
    445,   // SMB
    993,   // IMAPS
    995,   // POP3S
    1433,  // SQL Server
    1521,  // Oracle
    2049,  // NFS
    3389,  // RDP
    5060,  // SIP
    5900,  // VNC
    8000,  // Serveurs de dev
    8080,  // Serveurs web alternatifs
    8443,  // HTTPS alternatif
    9000,  // Serveurs de développement
    27017, // MongoDB
    3306,  // MySQL
    5984,  // CouchDB
    6379   // Redis (doit être protégé)
  ] as const,

  // Plages de ports à scanner
  SCAN_RANGES: [
    { start: 1, end: 1024 },     // Ports système
    { start: 3000, end: 3010 },  // Ports application
    { start: 5000, end: 5100 },  // Ports services
    { start: 8000, end: 8090 },  // Ports web
    { start: 9000, end: 9010 }   // Ports développement
  ]
} as const;

/**
 * Types de risques de sécurité
 */
export enum PortRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Interface pour les informations de port
 */
export interface PortInfo {
  port: number;
  isOpen: boolean;
  isListening: boolean;
  service?: string | undefined;
  risk: PortRiskLevel;
  reason: string;
  timestamp: Date;
}

/**
 * Interface pour le rapport de scan
 */
export interface PortScanReport {
  timestamp: Date;
  totalScanned: number;
  openPorts: PortInfo[];
  riskyPorts: PortInfo[];
  securityScore: number;
  recommendations: string[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Services connus par port
 */
const KNOWN_SERVICES: Record<number, { name: string; risk: PortRiskLevel; description: string }> = {
  22: { name: 'SSH', risk: PortRiskLevel.HIGH, description: 'Accès shell - doit être sécurisé' },
  23: { name: 'Telnet', risk: PortRiskLevel.CRITICAL, description: 'Non chiffré - interdire' },
  25: { name: 'SMTP', risk: PortRiskLevel.MEDIUM, description: 'Serveur mail - surveiller' },
  53: { name: 'DNS', risk: PortRiskLevel.MEDIUM, description: 'Service DNS - protéger' },
  80: { name: 'HTTP', risk: PortRiskLevel.HIGH, description: 'Non chiffré - utiliser HTTPS' },
  110: { name: 'POP3', risk: PortRiskLevel.HIGH, description: 'Mail non chiffré - utiliser POP3S' },
  135: { name: 'RPC', risk: PortRiskLevel.CRITICAL, description: 'Windows RPC - très risqué' },
  139: { name: 'NetBIOS', risk: PortRiskLevel.HIGH, description: 'Partage Windows - risqué' },
  443: { name: 'HTTPS', risk: PortRiskLevel.LOW, description: 'Chiffré - OK si configuré' },
  445: { name: 'SMB', risk: PortRiskLevel.CRITICAL, description: 'Partage fichiers - très risqué' },
  993: { name: 'IMAPS', risk: PortRiskLevel.LOW, description: 'Mail chiffré - OK' },
  995: { name: 'POP3S', risk: PortRiskLevel.LOW, description: 'Mail chiffré - OK' },
  1433: { name: 'SQL Server', risk: PortRiskLevel.HIGH, description: 'Base de données - protéger' },
  1521: { name: 'Oracle', risk: PortRiskLevel.HIGH, description: 'Base de données - protéger' },
  2049: { name: 'NFS', risk: PortRiskLevel.HIGH, description: 'Partage fichiers - risqué' },
  3000: { name: 'App Dev', risk: PortRiskLevel.MEDIUM, description: 'Port application - surveiller' },
  3306: { name: 'MySQL', risk: PortRiskLevel.HIGH, description: 'Base de données - protéger' },
  3389: { name: 'RDP', risk: PortRiskLevel.CRITICAL, description: 'Bureau distant - très risqué' },
  5432: { name: 'PostgreSQL', risk: PortRiskLevel.HIGH, description: 'Base de données - protéger' },
  5060: { name: 'SIP', risk: PortRiskLevel.MEDIUM, description: 'Téléphonie IP - surveiller' },
  5900: { name: 'VNC', risk: PortRiskLevel.HIGH, description: 'Contrôle distant - risqué' },
  5984: { name: 'CouchDB', risk: PortRiskLevel.HIGH, description: 'Base de données - protéger' },
  6379: { name: 'Redis', risk: PortRiskLevel.HIGH, description: 'Cache - doit être protégé' },
  8000: { name: 'Web Alt', risk: PortRiskLevel.MEDIUM, description: 'Serveur web - surveiller' },
  8080: { name: 'HTTP Alt', risk: PortRiskLevel.MEDIUM, description: 'Serveur web - surveiller' },
  8443: { name: 'HTTPS Alt', risk: PortRiskLevel.LOW, description: 'Chiffré alternatif - OK' },
  9000: { name: 'Dev Server', risk: PortRiskLevel.MEDIUM, description: 'Développement - surveiller' },
  27017: { name: 'MongoDB', risk: PortRiskLevel.HIGH, description: 'Base de données - protéger' }
};

/**
 * Scanner de ports sécurisé
 */
export class SecurePortScanner {
  private scanResults: Map<number, PortInfo> = new Map();
  private isScanning: boolean = false;

  constructor(private config = PORT_SECURITY_CONFIG) {}

  /**
   * Test si un port est ouvert (connexion TCP)
   */
  private async testPort(port: number, timeout: number = 1000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    });
  }

  /**
   * Test si un port est en écoute (serveur actif)
   */
  private async testListening(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.on('error', () => {
        resolve(true); // Port occupé = en écoute
      });
      
      server.listen(port, 'localhost', () => {
        server.close(() => {
          resolve(false); // Port libre = pas en écoute
        });
      });
    });
  }

  /**
   * Analyser un port spécifique
   */
  private async analyzePort(port: number): Promise<PortInfo> {
    const isOpen = await this.testPort(port);
    const isListening = isOpen ? await this.testListening(port) : false;
    
    const serviceInfo = KNOWN_SERVICES[port];
    const portInfo: PortInfo = {
      port,
      isOpen,
      isListening,
      service: serviceInfo?.name,
      risk: this.calculateRisk(port, isOpen, isListening),
      reason: this.getRiskReason(port, isOpen, isListening),
      timestamp: new Date()
    };

    return portInfo;
  }

  /**
   * Calcul du niveau de risque
   */
  private calculateRisk(port: number, isOpen: boolean, isListening: boolean): PortRiskLevel {
    if (!isOpen) return PortRiskLevel.LOW;
    
    const serviceInfo = KNOWN_SERVICES[port];
    
    // Ports critiques ouverts
    if (serviceInfo?.risk === PortRiskLevel.CRITICAL) {
      return PortRiskLevel.CRITICAL;
    }
    
    // Ports non autorisés et en écoute
    if (isListening && !(this.config.ALLOWED_PORTS as readonly number[]).includes(port)) {
      return PortRiskLevel.HIGH;
    }
    
    // Ports dangereux
    if ((this.config.DANGEROUS_PORTS as readonly number[]).includes(port)) {
      return serviceInfo?.risk || PortRiskLevel.HIGH;
    }
    
    // Ports autorisés
    if ((this.config.ALLOWED_PORTS as readonly number[]).includes(port)) {
      return isListening ? PortRiskLevel.LOW : PortRiskLevel.MEDIUM;
    }
    
    // Ports inconnus ouverts
    return isOpen ? PortRiskLevel.MEDIUM : PortRiskLevel.LOW;
  }

  /**
   * Explication du risque
   */
  private getRiskReason(port: number, isOpen: boolean, isListening: boolean): string {
    if (!isOpen) return 'Port fermé - OK';
    
    const serviceInfo = KNOWN_SERVICES[port];
    
    if (serviceInfo) {
      if (isListening) {
        return `${serviceInfo.description} - Service actif détecté`;
      } else {
        return `${serviceInfo.description} - Port ouvert mais pas de service`;
      }
    }
    
    if ((this.config.ALLOWED_PORTS as readonly number[]).includes(port)) {
      return isListening ? 'Port autorisé avec service actif' : 'Port autorisé sans service';
    }
    
    if (isListening) {
      return 'Service non autorisé détecté - À vérifier';
    }
    
    return 'Port ouvert de destination inconnue';
  }

  /**
   * Scanner une plage de ports
   */
  private async scanPortRange(start: number, end: number): Promise<PortInfo[]> {
    const results: PortInfo[] = [];
    const batchSize = 10; // Limiter la charge réseau
    
    for (let port = start; port <= end; port += batchSize) {
      const batch: Promise<PortInfo>[] = [];
      
      for (let i = 0; i < batchSize && (port + i) <= end; i++) {
        batch.push(this.analyzePort(port + i));
      }
      
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      
      // Petite pause pour ne pas surcharger
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  /**
   * Scanner complet du système
   */
  async performFullScan(): Promise<PortScanReport> {
    if (this.isScanning) {
      throw new Error('Scanner déjà en cours d\'exécution');
    }

    this.isScanning = true;
    
    try {
      secureLogger.info('🔍 Démarrage du scan de ports de sécurité');
      
      const allResults: PortInfo[] = [];
      
      // Scanner toutes les plages configurées
      for (const range of this.config.SCAN_RANGES) {
        secureLogger.info(`Scan de la plage ${range.start}-${range.end}`);
        const rangeResults = await this.scanPortRange(range.start, range.end);
        allResults.push(...rangeResults);
      }
      
      // Scanner les ports spécifiquement dangereux
      const dangerousPorts = (this.config.DANGEROUS_PORTS as readonly number[]).filter(
        (port: number) => !allResults.find(result => result.port === port)
      );
      
      for (const port of dangerousPorts) {
        const portInfo = await this.analyzePort(port);
        allResults.push(portInfo);
      }
      
      // Générer le rapport
      const report = this.generateReport(allResults);
      
      secureLogger.info('✅ Scan de ports terminé', {
        totalScanned: report.totalScanned,
        openPorts: report.openPorts.length,
        riskyPorts: report.riskyPorts.length,
        securityScore: report.securityScore
      });
      
      return report;
      
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Générer le rapport de sécurité
   */
  private generateReport(results: PortInfo[]): PortScanReport {
    const openPorts = results.filter(r => r.isOpen);
    const riskyPorts = results.filter(r => r.risk === PortRiskLevel.HIGH || r.risk === PortRiskLevel.CRITICAL);
    
    // Comptage par niveau de risque
    const summary = {
      critical: results.filter(r => r.risk === PortRiskLevel.CRITICAL).length,
      high: results.filter(r => r.risk === PortRiskLevel.HIGH).length,
      medium: results.filter(r => r.risk === PortRiskLevel.MEDIUM).length,
      low: results.filter(r => r.risk === PortRiskLevel.LOW).length
    };
    
    // Calcul du score de sécurité
    const securityScore = this.calculateSecurityScore(summary, results.length);
    
    // Génération des recommandations
    const recommendations = this.generateRecommendations(openPorts, riskyPorts);
    
    return {
      timestamp: new Date(),
      totalScanned: results.length,
      openPorts,
      riskyPorts,
      securityScore,
      recommendations,
      summary
    };
  }

  /**
   * Calcul du score de sécurité (0-100)
   */
  private calculateSecurityScore(summary: any, total: number): number {
    if (total === 0) return 100;
    
    let score = 100;
    
    // Pénalités par niveau de risque
    score -= summary.critical * 25; // -25 par port critique
    score -= summary.high * 15;     // -15 par port à risque élevé
    score -= summary.medium * 5;    // -5 par port à risque moyen
    score -= summary.low * 1;       // -1 par port à risque faible
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Génération des recommandations
   */
  private generateRecommendations(openPorts: PortInfo[], riskyPorts: PortInfo[]): string[] {
    const recommendations: string[] = [];
    
    // Ports critiques
    const criticalPorts = riskyPorts.filter(p => p.risk === PortRiskLevel.CRITICAL);
    if (criticalPorts.length > 0) {
      recommendations.push(
        `🔴 URGENT: Fermer immédiatement les ports critiques: ${criticalPorts.map(p => p.port).join(', ')}`
      );
    }
    
    // Ports à risque élevé
    const highRiskPorts = riskyPorts.filter(p => p.risk === PortRiskLevel.HIGH);
    if (highRiskPorts.length > 0) {
      recommendations.push(
        `🟠 Sécuriser ou fermer les ports à risque élevé: ${highRiskPorts.map(p => p.port).join(', ')}`
      );
    }
    
    // Services de base de données exposés
    const dbPorts = openPorts.filter(p => [5432, 3306, 27017, 6379, 1433].includes(p.port));
    if (dbPorts.length > 0) {
      recommendations.push(
        '🛡️ Protéger les bases de données avec authentification forte et restriction IP'
      );
    }
    
    // Ports HTTP non chiffrés
    const httpPorts = openPorts.filter(p => [80, 8000, 8080].includes(p.port));
    if (httpPorts.length > 0) {
      recommendations.push(
        '🔒 Migrer vers HTTPS pour tous les services web exposés'
      );
    }
    
    // Ports de développement en production
    const devPorts = openPorts.filter(p => p.port >= 3000 && p.port <= 9000);
    if (devPorts.length > 0) {
      recommendations.push(
        '⚠️ Vérifier si les ports de développement doivent être exposés en production'
      );
    }
    
    // Recommandations générales
    if (openPorts.length > 5) {
      recommendations.push(
        '📊 Auditer régulièrement les ports ouverts et fermer ceux qui ne sont pas nécessaires'
      );
    }
    
    recommendations.push(
      '🔍 Implémenter un monitoring continu des ports avec alertes en temps réel'
    );
    
    return recommendations;
  }

  /**
   * Scanner rapide des ports essentiels
   */
  async quickScan(): Promise<PortInfo[]> {
    const essentialPorts = [
      ...this.config.ALLOWED_PORTS,
      ...this.config.DANGEROUS_PORTS.slice(0, 10) // Top 10 des ports dangereux
    ];
    
    const results: PortInfo[] = [];
    
    for (const port of essentialPorts) {
      const portInfo = await this.analyzePort(port);
      results.push(portInfo);
    }
    
    return results.filter(r => r.isOpen);
  }
}

/**
 * Moniteur de ports en continu
 */
export class PortMonitor {
  private scanner: SecurePortScanner;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private lastScanResults: PortInfo[] = [];

  constructor(private intervalMs: number = 300000) { // 5 minutes par défaut
    this.scanner = new SecurePortScanner();
  }

  /**
   * Démarrer le monitoring continu
   */
  start(): void {
    if (this.isMonitoring) {
      secureLogger.warn('Monitoring de ports déjà actif');
      return;
    }

    this.isMonitoring = true;
    secureLogger.info('🔍 Démarrage du monitoring de ports continu');

    // Scan initial
    this.performMonitoringScan();

    // Scans périodiques
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringScan();
    }, this.intervalMs);
  }

  /**
   * Arrêter le monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    secureLogger.info('🛑 Arrêt du monitoring de ports');
  }

  /**
   * Effectuer un scan de monitoring
   */
  private async performMonitoringScan(): Promise<void> {
    try {
      const currentResults = await this.scanner.quickScan();
      
      // Détecter les changements
      const changes = this.detectChanges(this.lastScanResults, currentResults);
      
      if (changes.length > 0) {
        secureLogger.warn('🚨 Changements détectés dans l\'exposition des ports', {
          changes: changes.map(c => ({
            port: c.port,
            type: c.type,
            risk: c.risk
          }))
        });
      }
      
      this.lastScanResults = currentResults;
      
    } catch (error) {
      secureLogger.error('❌ Erreur lors du monitoring de ports', error);
    }
  }

  /**
   * Détecter les changements entre deux scans
   */
  private detectChanges(previous: PortInfo[], current: PortInfo[]): Array<{port: number; type: string; risk: PortRiskLevel}> {
    const changes: Array<{port: number; type: string; risk: PortRiskLevel}> = [];
    
    // Nouveaux ports ouverts
    for (const curr of current) {
      const prev = previous.find(p => p.port === curr.port);
      if (!prev) {
        changes.push({
          port: curr.port,
          type: 'NOUVEAU_PORT_OUVERT',
          risk: curr.risk
        });
      }
    }
    
    // Ports fermés
    for (const prev of previous) {
      const curr = current.find(p => p.port === prev.port);
      if (!curr) {
        changes.push({
          port: prev.port,
          type: 'PORT_FERME',
          risk: prev.risk
        });
      }
    }
    
    return changes;
  }

  /**
   * Obtenir le statut actuel
   */
  getStatus(): { isMonitoring: boolean; lastScanTime: Date | null; openPorts: number } {
    return {
      isMonitoring: this.isMonitoring,
      lastScanTime: this.lastScanResults.length > 0 ? this.lastScanResults[0]?.timestamp || null : null,
      openPorts: this.lastScanResults.length
    };
  }
}

export default {
  SecurePortScanner,
  PortMonitor,
  PORT_SECURITY_CONFIG,
  PortRiskLevel
};