# 🚀 FreelanceOS

## Outil open-source moderne de gestion complète pour freelances et petites entreprises

FreelanceOS combine facturation, CRM, gestion de projets, suivi du temps et analytics dans une interface simple et performante.

### ✨ Fonctionnalités Phase 1 (MVP Enrichi)

- 💰 **Tableau de bord Cash Flow** avec prévisions sur 3 mois
- 📋 **Gestion Clients** avec historique des interactions
- 📄 **Devis & Factures** avec génération PDF automatique
- 🎯 **Module Prospection** avec suivi des relances
- ⚡ **Rappels Automatiques** pour paiements et renouvellements

### 🛠 Stack Technique 2025

- **Backend**: Node.js + Fastify + TypeScript
- **Frontend**: React 18 + TypeScript + Tailwind CSS v4 + Vite + shadcn/ui
- **Base de données**: PostgreSQL + Prisma ORM + Redis
- **PDF**: Puppeteer + React PDF
- **Auth**: NextAuth.js + JWT
- **Tests**: Vitest + Playwright (E2E)

### 🚀 Démarrage rapide

#### Backend
```bash
cd backend
pnpm install
pnpm dev
```

#### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

#### Docker (Développement complet)
```bash
docker-compose up -d
```

### 📁 Structure du projet

```
freelance-os/
├── backend/          # API REST Node.js/Fastify
├── frontend/         # Interface React + Tailwind
├── docker/          # Configuration conteneurs
├── docs/            # Documentation technique
└── templates/       # Templates PDF et emails
```

### 🤝 Contribution

Voir [CONTRIBUTING.md](./CONTRIBUTING.md) pour les guidelines de contribution.

### 📄 Licence

MIT License - Voir [LICENSE](./LICENSE) pour plus de détails.