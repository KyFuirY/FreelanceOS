import { z } from 'zod';
import { ClientStatus, InteractionType } from '@prisma/client';

// ============================================================================
// VALIDATIONS ZOD - CLIENTS
// ============================================================================

// Schéma de base pour les clients
export const ClientBaseSchema = z.object({
  name: z.string()
    .min(1, 'Le nom est obligatoire')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  
  email: z.string()
    .email('Format email invalide')
    .optional()
    .or(z.literal('')),
  
  phone: z.string()
    .regex(/^(?:\+33|0)[1-9](?:[0-9]{8})$/, 'Numéro de téléphone français invalide')
    .optional()
    .or(z.literal('')),
  
  company: z.string()
    .max(100, 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  
  siret: z.string()
    .regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres')
    .optional()
    .or(z.literal('')),
  
  tvaNumber: z.string()
    .regex(/^FR\d{11}$/, 'Le numéro de TVA français doit avoir le format FR + 11 chiffres')
    .optional()
    .or(z.literal('')),
  
  address: z.string()
    .max(200, 'L\'adresse ne peut pas dépasser 200 caractères')
    .optional()
    .or(z.literal('')),
  
  city: z.string()
    .max(100, 'La ville ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  
  zipCode: z.string()
    .regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres')
    .optional()
    .or(z.literal('')),
  
  country: z.string()
    .length(2, 'Le code pays doit faire 2 caractères')
    .default('FR'),
  
  notes: z.string()
    .max(2000, 'Les notes ne peuvent pas dépasser 2000 caractères')
    .optional()
    .or(z.literal('')),
  
  tags: z.array(z.string())
    .default([]),
  
  paymentTerms: z.number()
    .min(0, 'Les délais de paiement doivent être positifs')
    .max(365, 'Les délais de paiement ne peuvent pas dépasser 365 jours')
    .default(30),
  
  status: z.nativeEnum(ClientStatus)
    .default(ClientStatus.ACTIVE),
});

// Schéma pour création client
export const CreateClientSchema = ClientBaseSchema.refine(
  (data) => data.email || data.phone,
  {
    message: 'Un email ou un numéro de téléphone est obligatoire',
    path: ['email'],
  }
);

// Schéma pour mise à jour client
export const UpdateClientSchema = ClientBaseSchema.partial();

// Schéma pour les paramètres de requête
export const ClientQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(val => val > 0)
    .default('1'),
  
  limit: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(val => val > 0 && val <= 100)
    .default('20'),
  
  search: z.string()
    .max(100)
    .optional(),
  
  status: z.nativeEnum(ClientStatus)
    .optional(),
  
  tags: z.string()
    .transform(str => str ? str.split(',') : [])
    .optional(),
  
  sortBy: z.enum(['name', 'createdAt', 'lastContact', 'score'])
    .default('name'),
  
  sortOrder: z.enum(['asc', 'desc'])
    .default('asc'),
});

// ============================================================================
// VALIDATIONS ZOD - INTERACTIONS CLIENTS
// ============================================================================

export const ClientInteractionBaseSchema = z.object({
  type: z.nativeEnum(InteractionType),
  
  subject: z.string()
    .min(1, 'Le sujet est obligatoire')
    .max(100, 'Le sujet ne peut pas dépasser 100 caractères'),
  
  content: z.string()
    .min(1, 'Le contenu est obligatoire')
    .max(2000, 'Le contenu ne peut pas dépasser 2000 caractères'),
  
  scheduledAt: z.string()
    .datetime()
    .transform(str => new Date(str))
    .optional(),
});

export const CreateClientInteractionSchema = ClientInteractionBaseSchema.extend({
  clientId: z.string()
    .cuid('ID client invalide'),
});

export const UpdateClientInteractionSchema = ClientInteractionBaseSchema.partial();

// ============================================================================
// TYPES TYPESCRIPT
// ============================================================================

// Types inférés depuis Zod
export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
export type ClientQueryParams = z.infer<typeof ClientQuerySchema>;
export type CreateClientInteractionInput = z.infer<typeof CreateClientInteractionSchema>;
export type UpdateClientInteractionInput = z.infer<typeof UpdateClientInteractionSchema>;

// Types pour les réponses API
export interface ClientWithStats {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: ClientStatus;
  tags: string[];
  score: number;
  lastContact?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Statistiques calculées
  _stats: {
    totalInvoices: number;
    totalRevenue: number;
    averagePaymentDelay: number;
    interactionsCount: number;
  };
}

export interface ClientListResponse {
  clients: ClientWithStats[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ClientDetailResponse extends ClientWithStats {
  siret?: string;
  tvaNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country: string;
  notes?: string;
  paymentTerms: number;
  
  // Relations complètes
  interactions: Array<{
    id: string;
    type: InteractionType;
    subject: string;
    content: string;
    scheduledAt?: Date;
    completedAt?: Date;
    createdAt: Date;
  }>;
  
  recentInvoices: Array<{
    id: string;
    number: string;
    amount: number;
    status: string;
    dueDate: Date;
    createdAt: Date;
  }>;
}