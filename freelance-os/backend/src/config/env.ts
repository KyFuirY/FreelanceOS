import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // Base de données
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  
  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // Email (Nodemailer)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // File uploads
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  
  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  
  // PDF Generation
  PUPPETEER_EXECUTABLE_PATH: z.string().optional()
})

const env = envSchema.safeParse(process.env)

if (!env.success) {
  console.error('❌ Variables d\'environnement invalides:')
  console.error(env.error.format())
  throw new Error('Variables d\'environnement invalides')
}

export const config = env.data

// Validation supplémentaire pour la production
if (config.NODE_ENV === 'production') {
  const requiredForProduction = [
    'JWT_SECRET',
    'DATABASE_URL',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'EMAIL_FROM'
  ]
  
  const missing = requiredForProduction.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error(`❌ Variables d'environnement manquantes pour la production: ${missing.join(', ')}`)
    throw new Error('Variables d\'environnement manquantes pour la production')
  }
}