import { FastifyRequest, FastifyReply } from 'fastify';
import { ClientService } from '@/services/client.service';
import { 
  CreateClientSchema,
  UpdateClientSchema, 
  ClientQuerySchema,
  CreateClientInput,
  UpdateClientInput,
  ClientQueryParams
} from '@/types/client.types';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';

// Instance du service
const clientService = new ClientService(prisma);

// ============================================================================
// TYPES POUR LES REQUÊTES
// ============================================================================

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

// Helper pour récupérer l'utilisateur authentifié
const getCurrentUser = (request: FastifyRequest): AuthenticatedUser => {
  const user = (request as any).currentUser;
  if (!user) {
    throw new Error('Utilisateur non authentifié');
  }
  return user;
};

// ============================================================================
// CONTRÔLEURS
// ============================================================================

/**
 * Créer un nouveau client
 */
export const createClient = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = getCurrentUser(request);
    // Validation des données
    const validData = CreateClientSchema.parse(request.body);
    
    const client = await clientService.createClient(user.userId, validData);

    reply.status(201).send({
      message: 'Client créé avec succès',
      client,
    });
  } catch (error) {
    logger.error('Erreur contrôleur createClient', {
      userId: getCurrentUser(request).userId,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      body: request.body,
    });

    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        return reply.status(409).send({
          error: 'Conflit',
          message: error.message,
        });
      }
      
      if (error.message.includes('Invalid')) {
        return reply.status(400).send({
          error: 'Données invalides',
          message: error.message,
        });
      }
    }

    reply.status(500).send({
      error: 'Erreur serveur',
      message: 'Impossible de créer le client',
    });
  }
};

/**
 * Lister les clients avec pagination
 */
export const listClients = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Validation des paramètres de requête
    const validParams = ClientQuerySchema.parse(request.query);
    
    const result = await clientService.getClients(getCurrentUser(request).userId, validParams);

    reply.send(result);
  } catch (error) {
    logger.error('Erreur contrôleur listClients', {
      userId: getCurrentUser(request).userId,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      query: request.query,
    });

    reply.status(500).send({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les clients',
    });
  }
};

/**
 * Récupérer un client par ID
 */
export const getClientById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = getCurrentUser(request);
    const { id } = request.params as { id: string };
    
    if (!id || id.length < 10) {
      return reply.status(400).send({
        error: 'ID invalide',
        message: 'L\'ID du client est requis et doit être valide',
      });
    }

    const client = await clientService.getClientById(user.userId, id);

    reply.send({
      client,
    });
  } catch (error) {
    logger.error('Erreur contrôleur getClientById', {
      userId: getCurrentUser(request).userId,
      clientId: (request.params as { id: string }).id,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    });

    if (error instanceof Error && error.message.includes('introuvable')) {
      return reply.status(404).send({
        error: 'Client introuvable',
        message: error.message,
      });
    }

    reply.status(500).send({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer le client',
    });
  }
};

/**
 * Mettre à jour un client
 */
export const updateClient = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    
    if (!id || id.length < 10) {
      return reply.status(400).send({
        error: 'ID invalide',
        message: 'L\'ID du client est requis et doit être valide',
      });
    }

    // Validation des données
    const validData = UpdateClientSchema.parse(request.body);
    
    const client = await clientService.updateClient(getCurrentUser(request).userId, id, validData);

    reply.send({
      message: 'Client mis à jour avec succès',
      client,
    });
  } catch (error) {
    logger.error('Erreur contrôleur updateClient', {
      userId: getCurrentUser(request).userId,
      clientId: (request.params as { id: string }).id,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      body: request.body,
    });

    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        return reply.status(404).send({
          error: 'Client introuvable',
          message: error.message,
        });
      }
      
      if (error.message.includes('existe déjà')) {
        return reply.status(409).send({
          error: 'Conflit',
          message: error.message,
        });
      }
      
      if (error.message.includes('Invalid')) {
        return reply.status(400).send({
          error: 'Données invalides',
          message: error.message,
        });
      }
    }

    reply.status(500).send({
      error: 'Erreur serveur',
      message: 'Impossible de mettre à jour le client',
    });
  }
};

/**
 * Supprimer un client
 */
export const deleteClient = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    
    if (!id || id.length < 10) {
      return reply.status(400).send({
        error: 'ID invalide',
        message: 'L\'ID du client est requis et doit être valide',
      });
    }

    await clientService.deleteClient(getCurrentUser(request).userId, id);

    reply.status(204).send();
  } catch (error) {
    logger.error('Erreur contrôleur deleteClient', {
      userId: getCurrentUser(request).userId,
      clientId: (request.params as { id: string }).id,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    });

    if (error instanceof Error && error.message.includes('introuvable')) {
      return reply.status(404).send({
        error: 'Client introuvable',
        message: error.message,
      });
    }

    reply.status(500).send({
      error: 'Erreur serveur',
      message: 'Impossible de supprimer le client',
    });
  }
};

/**
 * Statistiques rapides des clients
 */
export const getClientsStats = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getCurrentUser(request).userId;
    
    const [
      totalClients,
      activeClients,
      prospectClients,
      archivedClients,
    ] = await Promise.all([
      prisma.client.count({
        where: { userId },
      }),
      prisma.client.count({
        where: { userId, status: 'ACTIVE' },
      }),
      prisma.client.count({
        where: { userId, status: 'PROSPECT' },
      }),
      prisma.client.count({
        where: { userId, status: 'ARCHIVED' },
      }),
    ]);

    reply.send({
      stats: {
        total: totalClients,
        active: activeClients,
        prospects: prospectClients,
        archived: archivedClients,
        inactive: totalClients - activeClients - prospectClients - archivedClients,
      },
    });
  } catch (error) {
    logger.error('Erreur contrôleur getClientsStats', {
      userId: getCurrentUser(request).userId,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    });

    reply.status(500).send({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les statistiques',
    });
  }
};
