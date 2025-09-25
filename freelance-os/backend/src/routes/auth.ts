import { FastifyPluginAsync } from 'fastify'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    // TODO: Implémenter la logique de connexion
    reply.send({ message: 'Login endpoint - À implémenter' })
  })

  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    // TODO: Implémenter la logique d'inscription
    reply.send({ message: 'Register endpoint - À implémenter' })
  })

  // POST /api/v1/auth/logout
  fastify.post('/logout', async (request, reply) => {
    // TODO: Implémenter la logique de déconnexion
    reply.send({ message: 'Logout endpoint - À implémenter' })
  })

  // GET /api/v1/auth/me
  fastify.get('/me', async (request, reply) => {
    // TODO: Implémenter la récupération du profil utilisateur
    reply.send({ message: 'Profile endpoint - À implémenter' })
  })
}

export default authRoutes