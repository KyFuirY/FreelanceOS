import { FastifyPluginAsync } from 'fastify'

const clientRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/clients
  fastify.get('/', async (request, reply) => {
    reply.send({ 
      message: 'Liste des clients - À implémenter',
      clients: []
    })
  })

  // POST /api/v1/clients
  fastify.post('/', async (request, reply) => {
    reply.send({ message: 'Création client - À implémenter' })
  })

  // GET /api/v1/clients/:id
  fastify.get('/:id', async (request, reply) => {
    reply.send({ message: 'Détail client - À implémenter' })
  })

  // PUT /api/v1/clients/:id
  fastify.put('/:id', async (request, reply) => {
    reply.send({ message: 'Modification client - À implémenter' })
  })

  // DELETE /api/v1/clients/:id
  fastify.delete('/:id', async (request, reply) => {
    reply.send({ message: 'Suppression client - À implémenter' })
  })
}

export default clientRoutes