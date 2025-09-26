import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from './app'
import { prisma } from '../utils/database'

describe('Authentication API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'motdepasse123',
        firstName: 'John',
        lastName: 'Doe'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Compte créé avec succès')
      expect(body.user.email).toBe(userData.email)
      expect(body.tokens.accessToken).toBeDefined()
      expect(body.tokens.refreshToken).toBeDefined()
    })

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'motdepasse123',
        firstName: 'John',
        lastName: 'Doe'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Données invalides')
    })

    it('should reject weak password', async () => {
      const userData = {
        email: 'test2@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/v1/auth/login', () => {
    beforeAll(async () => {
      // Créer un utilisateur de test
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'login-test@example.com',
          password: 'motdepasse123',
          firstName: 'Test',
          lastName: 'User'
        }
      })
    })

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login-test@example.com',
          password: 'motdepasse123'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Connexion réussie')
      expect(body.tokens.accessToken).toBeDefined()
    })

    it('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login-test@example.com',
          password: 'wrongpassword'
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string

    beforeAll(async () => {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login-test@example.com',
          password: 'motdepasse123'
        }
      })
      const body = JSON.parse(loginResponse.body)
      accessToken = body.tokens.accessToken
    })

    it('should return user profile with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.user.email).toBe('login-test@example.com')
    })

    it('should reject request without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me'
      })

      expect(response.statusCode).toBe(401)
    })
  })
})