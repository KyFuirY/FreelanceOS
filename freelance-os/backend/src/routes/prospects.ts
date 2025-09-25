import { FastifyPluginAsync } from 'fastify'

const prospectRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/prospects
  fastify.get('/', async (request, reply) => {
    reply.send({ 
      message: 'Liste des prospects - À implémenter',
      prospects: []
    })
  })

  // POST /api/v1/prospects
  fastify.post('/', async (request, reply) => {
    reply.send({ message: 'Création prospect - À implémenter' })
  })

  // GET /api/v1/prospects/:id
  fastify.get('/:id', async (request, reply) => {
    reply.send({ message: 'Détail prospect - À implémenter' })
  })

  // PUT /api/v1/prospects/:id
  fastify.put('/:id', async (request, reply) => {
    reply.send({ message: 'Modification prospect - À implémenter' })
  })

  // DELETE /api/v1/prospects/:id
  fastify.delete('/:id', async (request, reply) => {
    reply.send({ message: 'Suppression prospect - À implémenter' })
  })

  // POST /api/v1/prospects/:id/follow-up
  fastify.post('/:id/follow-up', async (request, reply) => {
    reply.send({ message: 'Ajout suivi prospect - À implémenter' })
  })
}

export default prospectRoutes