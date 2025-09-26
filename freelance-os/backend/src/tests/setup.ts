import { beforeAll, afterAll } from 'vitest'
import { prisma } from '../utils/database'

// Setup pour les tests - nettoie la DB avant/après
beforeAll(async () => {
  // Nettoyer les données de test
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: 'test'
      }
    }
  })
})

afterAll(async () => {
  // Nettoyer après les tests
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: 'test'
      }
    }
  })
  
  await prisma.$disconnect()
})