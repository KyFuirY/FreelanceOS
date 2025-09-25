import { FastifyPluginAsync } from 'fastify'

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/dashboard/stats
  fastify.get('/stats', async (request, reply) => {
    reply.send({ 
      message: 'Statistiques dashboard - À implémenter',
      stats: {
        totalRevenue: 0,
        unpaidInvoices: 0,
        activeClients: 0,
        pendingProspects: 0
      }
    })
  })

  // GET /api/v1/dashboard/cash-flow
  fastify.get('/cash-flow', async (request, reply) => {
    reply.send({ 
      message: 'Cash flow - À implémenter',
      cashFlow: []
    })
  })

  // GET /api/v1/dashboard/recent-activities
  fastify.get('/recent-activities', async (request, reply) => {
    reply.send({ 
      message: 'Activités récentes - À implémenter',
      activities: []
    })
  })
}

export default dashboardRoutes