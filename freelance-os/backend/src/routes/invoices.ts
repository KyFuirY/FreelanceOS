import { FastifyPluginAsync } from 'fastify'

const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/invoices
  fastify.get('/', async (request, reply) => {
    reply.send({ 
      message: 'Liste des factures - À implémenter',
      invoices: []
    })
  })

  // POST /api/v1/invoices
  fastify.post('/', async (request, reply) => {
    reply.send({ message: 'Création facture - À implémenter' })
  })

  // GET /api/v1/invoices/:id
  fastify.get('/:id', async (request, reply) => {
    reply.send({ message: 'Détail facture - À implémenter' })
  })

  // PUT /api/v1/invoices/:id
  fastify.put('/:id', async (request, reply) => {
    reply.send({ message: 'Modification facture - À implémenter' })
  })

  // DELETE /api/v1/invoices/:id
  fastify.delete('/:id', async (request, reply) => {
    reply.send({ message: 'Suppression facture - À implémenter' })
  })

  // GET /api/v1/invoices/:id/pdf
  fastify.get('/:id/pdf', async (request, reply) => {
    reply.send({ message: 'Génération PDF - À implémenter' })
  })
}

export default invoiceRoutes