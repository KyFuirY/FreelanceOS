import { PrismaClient, ClientStatus } from '@prisma/client';
import { 
  CreateClientInput, 
  UpdateClientInput, 
  ClientQueryParams,
  ClientWithStats,
  ClientListResponse,
  ClientDetailResponse
} from '@/types/client.types';
import { secureLogger, logSecurityEvent } from '@/utils/secure-logger';
import { encryptPII, decryptPII } from '@/utils/encryption';
import { sanitizeObjectXSS, SENSITIVE_XSS_FIELDS } from '@/utils/xss-protection';

export class ClientService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Utilitaire pour déchiffrer un client
   */
  private decryptClient(client: any): any {
    return {
      ...client,
      email: client.email ? decryptPII(client.email) : client.email,
      phone: client.phone ? decryptPII(client.phone) : client.phone,
      address: client.address ? decryptPII(client.address) : client.address,
      siret: client.siret ? decryptPII(client.siret) : client.siret,
      tvaNumber: client.tvaNumber ? decryptPII(client.tvaNumber) : client.tvaNumber
    };
  }

  /**
   * Créer un nouveau client
   */
  async createClient(userId: string, data: CreateClientInput): Promise<ClientWithStats> {
    const startTime = Date.now();
    
    try {
      // 1. Protection XSS - Sanitiser les données d'entrée
      const sanitizedData = sanitizeObjectXSS(data, ['name', 'company', 'notes', 'address', 'city'] as any);

      // 2. Vérifier l'unicité de l'email pour ce freelance
      if (sanitizedData.email) {
        const existingClient = await this.prisma.client.findFirst({
          where: {
            userId,
            email: sanitizedData.email,
          },
        });

        if (existingClient) {
          throw new Error(`Un client avec l'email "${sanitizedData.email}" existe déjà`);
        }
      }

      // 3. Préparer les données avec chiffrement des PII
      const clientData = {
        userId,
        name: sanitizedData.name,
        email: sanitizedData.email ? encryptPII(sanitizedData.email) : null,
        phone: sanitizedData.phone ? encryptPII(sanitizedData.phone) : null,
        company: sanitizedData.company || null,
        siret: sanitizedData.siret ? encryptPII(sanitizedData.siret) : null,
        tvaNumber: sanitizedData.tvaNumber ? encryptPII(sanitizedData.tvaNumber) : null,
        address: sanitizedData.address ? encryptPII(sanitizedData.address) : null,
        city: sanitizedData.city || null,
        zipCode: sanitizedData.zipCode || null,
        country: sanitizedData.country || 'FR',
        notes: sanitizedData.notes || null,
        tags: sanitizedData.tags || [],
        paymentTerms: sanitizedData.paymentTerms || 30,
        status: sanitizedData.status || ClientStatus.ACTIVE
      };

      // Créer le client
      const client = await this.prisma.client.create({
        data: clientData
      });

      // Déchiffrer pour le retour
      const decryptedClient = this.decryptClient(client);

      const duration = Date.now() - startTime;

      // Log sécurisé (PII masquées automatiquement)
      secureLogger.info('Nouveau client créé', {
        clientId: client.id,
        clientName: sanitizedData.name,
        userId,
        duration: `${duration}ms`
      });

      // Retourner avec les stats par défaut
      return {
        ...decryptedClient,
        score: 0,
        lastContact: null,
        _stats: {
          totalInvoices: 0,
          totalRevenue: 0,
          averagePaymentDelay: 0,
          interactionsCount: 0
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      secureLogger.error('Erreur création client', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        duration: `${duration}ms`
      });

      // Log événement de sécurité si tentative suspecte
      if (error instanceof Error && (error.message.includes('<script>') || error.message.includes('malicious'))) {
        logSecurityEvent('SUSPICIOUS_ACTIVITY', {
          userId,
          severity: 'HIGH',
          reason: 'Tentative de création client avec données XSS détectées'
        });
      }

      throw error;
    }
  }

  /**
   * Récupérer tous les clients d'un freelance
   */
  async getClients(userId: string, params: Partial<ClientQueryParams> = {}): Promise<ClientListResponse> {
    const startTime = Date.now();
    
    try {
      const { 
        page = 1, 
        limit = 20, 
        search, 
        status, 
        sortBy = 'name',
        sortOrder = 'asc' 
      } = params;

      const skip = (page - 1) * limit;

      // Construire les conditions de recherche
      const where: any = { userId };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (status) {
        where.status = status;
      }

      // Récupérer les clients
      const [clients, total] = await Promise.all([
        this.prisma.client.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder }
        }),
        this.prisma.client.count({ where })
      ]);

      // Déchiffrer les données
      const decryptedClients = clients.map(client => ({
        ...this.decryptClient(client),
        score: 0,
        lastContact: null,
        _stats: {
          totalInvoices: 0,
          totalRevenue: 0,
          averagePaymentDelay: 0,
          interactionsCount: 0
        }
      }));

      const duration = Date.now() - startTime;

      secureLogger.info('Récupération clients', {
        userId,
        count: clients.length,
        total,
        duration: `${duration}ms`
      });

      return {
        clients: decryptedClients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };

    } catch (error) {
      secureLogger.error('Erreur récupération clients', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });

      throw error;
    }
  }

  /**
   * Récupérer un client spécifique
   */
  async getClientById(userId: string, clientId: string): Promise<ClientDetailResponse> {
    try {
      const client = await this.prisma.client.findFirst({
        where: {
          id: clientId,
          userId
        }
      });

      if (!client) {
        throw new Error('Client non trouvé');
      }

      // Déchiffrer les données
      const decryptedClient = this.decryptClient(client);

      secureLogger.info('Récupération client', {
        userId,
        clientId
      });

      // Retourner avec données complètes pour ClientDetailResponse
      return {
        ...decryptedClient,
        score: 0,
        lastContact: null,
        _stats: {
          totalInvoices: 0,
          totalRevenue: 0,
          averagePaymentDelay: 0,
          interactionsCount: 0
        },
        interactions: [],
        recentInvoices: []
      };

    } catch (error) {
      secureLogger.error('Erreur récupération client', {
        userId,
        clientId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });

      throw error;
    }
  }

  /**
   * Mettre à jour un client
   */
  async updateClient(userId: string, clientId: string, data: UpdateClientInput): Promise<ClientDetailResponse> {
    const startTime = Date.now();
    
    try {
      // Vérifier que le client appartient bien à l'utilisateur
      const existingClient = await this.prisma.client.findFirst({
        where: {
          id: clientId,
          userId
        }
      });

      if (!existingClient) {
        throw new Error('Client non trouvé');
      }

      // Préparer les données avec chiffrement
      const updateData: any = { ...data };
      if (data.email) updateData.email = encryptPII(data.email);
      if (data.phone) updateData.phone = encryptPII(data.phone);
      if (data.address) updateData.address = encryptPII(data.address);
      if (data.siret) updateData.siret = encryptPII(data.siret);
      if (data.tvaNumber) updateData.tvaNumber = encryptPII(data.tvaNumber);

      // Mettre à jour
      const client = await this.prisma.client.update({
        where: { id: clientId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      // Déchiffrer pour le retour
      const decryptedClient = this.decryptClient(client);

      const duration = Date.now() - startTime;

      secureLogger.info('Client mis à jour', {
        userId,
        clientId,
        updatedFields: Object.keys(data),
        duration: `${duration}ms`
      });

      return {
        ...decryptedClient,
        score: 0,
        lastContact: null,
        _stats: {
          totalInvoices: 0,
          totalRevenue: 0,
          averagePaymentDelay: 0,
          interactionsCount: 0
        },
        interactions: [],
        recentInvoices: []
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      secureLogger.error('Erreur mise à jour client', {
        userId,
        clientId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        duration: `${duration}ms`
      });

      throw error;
    }
  }

  /**
   * Supprimer un client
   */
  async deleteClient(userId: string, clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Vérifier que le client appartient bien à l'utilisateur
      const existingClient = await this.prisma.client.findFirst({
        where: {
          id: clientId,
          userId
        }
      });

      if (!existingClient) {
        throw new Error('Client non trouvé');
      }

      await this.prisma.client.delete({
        where: { id: clientId }
      });

      // Log événement de sécurité pour suppression
      logSecurityEvent('DATA_ACCESS', {
        userId,
        severity: 'MEDIUM',
        reason: 'Suppression client'
      });

      secureLogger.info('Client supprimé', {
        userId,
        clientId
      });

      return {
        success: true,
        message: 'Client supprimé avec succès'
      };

    } catch (error) {
      secureLogger.error('Erreur suppression client', {
        userId,
        clientId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });

      throw error;
    }
  }

  /**
   * Récupérer les statistiques des clients
   */
  async getClientStats(userId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    recentClients: number;
  }> {
    try {
      const [total, active, inactive, recent] = await Promise.all([
        this.prisma.client.count({ where: { userId } }),
        this.prisma.client.count({ where: { userId, status: ClientStatus.ACTIVE } }),
        this.prisma.client.count({ where: { userId, status: ClientStatus.INACTIVE } }),
        this.prisma.client.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 derniers jours
            }
          }
        })
      ]);

      return {
        total,
        active,
        inactive,
        recentClients: recent
      };

    } catch (error) {
      secureLogger.error('Erreur statistiques clients', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });

      throw error;
    }
  }
}