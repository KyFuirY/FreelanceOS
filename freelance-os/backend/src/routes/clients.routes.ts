import { FastifyInstance } from 'fastify';
import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  deleteClient,
  getClientsStats,
} from '@/controllers/client.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

// ============================================================================
// SCHÉMAS OPENAPI
// ============================================================================

const ClientSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email', nullable: true },
    phone: { type: 'string', nullable: true },
    company: { type: 'string', nullable: true },
    siret: { type: 'string', nullable: true },
    tvaNumber: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    zipCode: { type: 'string', nullable: true },
    country: { type: 'string', default: 'FR' },
    notes: { type: 'string', nullable: true },
    tags: { type: 'array', items: { type: 'string' } },
    paymentTerms: { type: 'number', default: 30 },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'ARCHIVED'] },
    score: { type: 'number' },
    lastContact: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const CreateClientSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', pattern: '^(?:\\+33|0)[1-9](?:[0-9]{8})$' },
    company: { type: 'string', maxLength: 100 },
    siret: { type: 'string', pattern: '^\\d{14}$' },
    tvaNumber: { type: 'string', pattern: '^FR\\d{11}$' },
    address: { type: 'string', maxLength: 200 },
    city: { type: 'string', maxLength: 100 },
    zipCode: { type: 'string', pattern: '^\\d{5}$' },
    country: { type: 'string', minLength: 2, maxLength: 2, default: 'FR' },
    notes: { type: 'string', maxLength: 2000 },
    tags: { type: 'array', items: { type: 'string' } },
    paymentTerms: { type: 'number', minimum: 0, maximum: 365, default: 30 },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'ARCHIVED'], default: 'ACTIVE' },
  },
};

// ============================================================================
// ROUTES
// ============================================================================

export async function clientRoutes(fastify: FastifyInstance) {
  // Hook d'authentification pour toutes les routes clients
  fastify.addHook('preHandler', authMiddleware);

  /**
   * Créer un nouveau client
   */
  fastify.post('/', {
    schema: {
      description: 'Créer un nouveau client',
      tags: ['Clients'],
      security: [{ bearerAuth: [] }],
      body: CreateClientSchema,
      response: {
        201: {
          description: 'Client créé avec succès',
          type: 'object',
          properties: {
            message: { type: 'string' },
            client: ClientSchema,
          },
        },
        400: {
          description: 'Données invalides',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        409: {
          description: 'Client existe déjà',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    }
  }, createClient);

  /**
   * Lister les clients avec pagination
   */
  fastify.get('/', {
    schema: {
      description: 'Lister les clients avec pagination et filtres',
      tags: ['Clients'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', pattern: '^\\d+$', default: '1' },
          limit: { type: 'string', pattern: '^\\d+$', default: '20' },
          search: { type: 'string', maxLength: 100 },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'ARCHIVED'] },
          tags: { type: 'string' },
          sortBy: { type: 'string', enum: ['name', 'createdAt', 'lastContact', 'score'], default: 'name' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
      response: {
        200: {
          description: 'Liste des clients',
          type: 'object',
          properties: {
            clients: {
              type: 'array',
              items: {
                allOf: [
                  ClientSchema,
                  {
                    properties: {
                      _stats: {
                        type: 'object',
                        properties: {
                          totalInvoices: { type: 'number' },
                          totalRevenue: { type: 'number' },
                          averagePaymentDelay: { type: 'number' },
                          interactionsCount: { type: 'number' },
                        },
                      },
                    },
                  },
                ],
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    handler: listClients,
  });

  /**
   * Récupérer un client par ID
   */
  fastify.get('/:id', {
    schema: {
      description: 'Récupérer un client par son ID',
      tags: ['Clients'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Détails du client',
          type: 'object',
          properties: {
            client: ClientSchema,
          },
        },
        404: {
          description: 'Client introuvable',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: getClientById,
  });

  /**
   * Mettre à jour un client
   */
  fastify.put('/:id', {
    schema: {
      description: 'Mettre à jour un client',
      tags: ['Clients'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', pattern: '^(?:\\+33|0)[1-9](?:[0-9]{8})$' },
          company: { type: 'string', maxLength: 100 },
          siret: { type: 'string', pattern: '^\\d{14}$' },
          tvaNumber: { type: 'string', pattern: '^FR\\d{11}$' },
          address: { type: 'string', maxLength: 200 },
          city: { type: 'string', maxLength: 100 },
          zipCode: { type: 'string', pattern: '^\\d{5}$' },
          country: { type: 'string', minLength: 2, maxLength: 2 },
          notes: { type: 'string', maxLength: 2000 },
          tags: { type: 'array', items: { type: 'string' } },
          paymentTerms: { type: 'number', minimum: 0, maximum: 365 },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'ARCHIVED'] },
        },
      },
      response: {
        200: {
          description: 'Client mis à jour',
          type: 'object',
          properties: {
            message: { type: 'string' },
            client: ClientSchema,
          },
        },
        404: {
          description: 'Client introuvable',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: updateClient,
  });

  /**
   * Supprimer un client
   */
  fastify.delete('/:id', {
    schema: {
      description: 'Supprimer un client (archivage si données liées)',
      tags: ['Clients'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        204: {
          description: 'Client supprimé',
          type: 'null',
        },
        404: {
          description: 'Client introuvable',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: deleteClient,
  });

  /**
   * Statistiques des clients
   */
  fastify.get('/stats/overview', {
    schema: {
      description: 'Statistiques rapides des clients',
      tags: ['Clients'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: 'Statistiques des clients',
          type: 'object',
          properties: {
            stats: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                active: { type: 'number' },
                prospects: { type: 'number' },
                archived: { type: 'number' },
                inactive: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: getClientsStats,
  });
}