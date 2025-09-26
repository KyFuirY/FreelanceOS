# FreelanceOS Backend

API REST moderne pour FreelanceOS développée avec Node.js, Fastify et TypeScript.

## 🚀 Démarrage rapide

```bash
# Installation des dépendances
pnpm install

# Configuration environnement 
cp .env.example .env

# Génération Prisma + Migration base de données
pnpm db:generate
pnpm db:migrate

# Démarrage développement
pnpm dev
```

## 📜 Scripts disponibles

### Développement
- `pnpm dev` - Serveur développement avec hot-reload
- `pnpm build` - Build production
- `pnpm start` - Serveur production

### Process Management (PM2)
- `pnpm start:pm2` - Démarrage avec PM2 (production)
- `pnpm stop:pm2` - Arrêt du serveur PM2
- `pnpm restart:pm2` - Redémarrage PM2
- `pnpm logs:pm2` - Logs PM2 en temps réel
- `pnpm status:pm2` - Statut des processus PM2

### Tests
- `pnpm test` - Tests unitaires
- `pnpm test:watch` - Tests en mode watch
- `pnpm test:coverage` - Couverture de tests

### Base de données (Prisma)
- `pnpm db:generate` - Génération client Prisma
- `pnpm db:push` - Push schema vers DB
- `pnpm db:migrate` - Créer migration
- `pnpm db:seed` - Seed données de test
- `pnpm db:studio` - Interface graphique Prisma

### Code Quality
- `pnpm lint` - Vérification code (Biome)
- `pnpm lint:fix` - Correction automatique
- `pnpm type-check` - Vérification TypeScript

## 🔧 Architecture

```
src/
├── config/          # Configuration (env, database, redis)
├── controllers/     # Contrôleurs API
├── middleware/      # Middlewares Fastify
├── routes/          # Définition des routes
├── services/        # Services métier
├── utils/           # Utilitaires
├── types/           # Types TypeScript
├── tests/           # Tests unitaires
└── server.ts        # Point d'entrée
```

## ✅ Fonctionnalités implémentées

- **Authentification JWT** : Inscription, connexion, refresh tokens
- **Sécurité** : Hash bcrypt 12 rounds, rate limiting
- **Base de données** : PostgreSQL + Prisma ORM
- **Cache** : Redis pour les sessions
- **Tests** : Vitest avec couverture
- **Documentation** : OpenAPI/Swagger auto-générée
- **Logs** : Winston avec timestamps
- **Process Management** : PM2 ready

## 🌐 Endpoints API

### Health
- `GET /api/health` - Status serveur

### Authentification
- `POST /api/v1/auth/register` - Inscription
- `POST /api/v1/auth/login` - Connexion
- `GET /api/v1/auth/me` - Profil utilisateur
- `POST /api/v1/auth/refresh` - Renouvellement token
- `POST /api/v1/auth/logout` - Déconnexion

### Documentation
- `GET /docs` - Interface Swagger

## 🔒 Variables d'environnement

Voir `.env.example` pour la liste complète.

## 📊 PM2 en production

Le serveur utilise PM2 pour la gestion des processus en production :

```bash
# Démarrage
pnpm start:pm2

# Monitoring
pnpm logs:pm2
pnpm status:pm2

# Gestion
pnpm restart:pm2
pnpm stop:pm2
```

## 🧪 Tests

```bash
# Lancer tous les tests
pnpm test

# Tests avec couverture
pnpm test:coverage

# Tests en continue
pnpm test:watch
```

La couverture de code cible : **80%+ backend, 60%+ frontend**

## 📚 Documentation technique

- [Architecture complète](../AGENTS.md)
- [Roadmap du projet](../Roadmap.md)
- [API Documentation](http://localhost:3000/docs) (serveur démarré)