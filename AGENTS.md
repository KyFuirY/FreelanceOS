# FreelanceOS - AGENTS.md

FreelanceOS est un outil open-source moderne de gestion complète pour freelances et petites entreprises. Il combine facturation, CRM, gestion de projets, suivi du temps et analytics dans une interface simple et performante.

## Architecture du projet

### Structure générale
```
freelance-os/
├── backend/          # API REST (Node.js/Express ou Spring Boot)
├── frontend/         # Interface web (React/Vue + Tailwind)
├── mobile/          # App mobile (React Native/Flutter)
├── desktop/         # App desktop (Electron)
├── docker/          # Configuration conteneurs
├── docs/           # Documentation technique
└── templates/      # Templates PDF et emails
```

### Stack technique 2025
- **Backend**: Node.js + Fastify + TypeScript (performance) OU Bun (ultra-rapide)
- **Base de données**: PostgreSQL + Prisma ORM + Redis cache
- **Frontend**: React 18 + TypeScript + Tailwind CSS v4 + Vite + shadcn/ui
- **Mobile**: React Native + Expo Router (2025)
- **PDF**: Puppeteer + React PDF (moderne)
- **Auth**: NextAuth.js + Supabase Auth (2025 standard)
- **Tests**: Vitest + Playwright (E2E) - remplace Jest/Cypress
- **AI/ML**: OpenAI API + Anthropic Claude (fonctionnalités IA)
- **Déploiement**: Docker + Kubernetes + Edge deployment

## Directives de développement

### Philosophie du code
- **Simplicité avant tout** : Une fonctionnalité doit être intuitive dès la première utilisation
- **Performance** : Temps de chargement < 2s, interactions fluides
- **Accessibilité** : Respect WCAG 2.1, navigation clavier complète
- **Mobile-first** : Design responsive, PWA ready
- **Sécurité** : Validation stricte, chiffrement des données sensibles

### Standards de code
- **Nommage**: camelCase (JS/TS), kebab-case (CSS), PascalCase (composants)
- **Architecture**: Clean Architecture + Domain-Driven Design pour le backend
- **État**: Redux Toolkit (complexe) ou Zustand (simple) pour React
- **Styling**: Tailwind utility classes, pas de CSS custom sauf exceptions
- **Types**: TypeScript strict, pas d'`any`, interfaces explicites

### Conventions de commits
Format: `type(scope): description`
- `feat(auth)`: nouvelle fonctionnalité authentification
- `fix(invoice)`: correction bug génération PDF
- `refactor(api)`: restructuration sans changement fonctionnel
- `docs(readme)`: mise à jour documentation
- `test(client)`: ajout tests module client

## Fonctionnalités par phase

### Phase 1 - MVP IA-Enhanced (2-3 mois)
**Priorité**: Fonctionnalités core avec assistance IA
- Gestion clients avec **auto-completion IA** des infos entreprise
- Création devis/factures avec **templates IA suggérés**
- Export PDF avec **génération automatique mentions légales**
- Dashboard revenus avec **prédictions IA** cash-flow
- Auth sécurisée + **authentification biométrique mobile**
- **Assistant vocal** pour saisie rapide temps/notes
- **OCR intelligent** pour numérisation factures fournisseurs

### Phase 2 - Business (4-6 mois) 
**Priorité**: Outils de gestion avancés
- CRM complet (historique interactions, notes, scoring clients)
- Suivi temps avec timer intégré + conversion automatique factures
- Gestion projets (Kanban, tâches, deadlines, templates)
- Analytics avancés (ROI, prévisions, saisonnalité)
- Multi-devises + multilingue (i18n)
- API REST complète avec documentation OpenAPI

### Phase 3 - Ecosystem (8-12 mois)
**Priorité**: Différenciation et monétisation
- Marketplace freelances (collaboration, sous-traitance)
- Centre formation intégré (cours, webinaires)
- Intégrations tierces (Stripe, PayPal, Zapier, Notion)
- App mobile native
- Module financement (affacturage, avances)

## Directives techniques spécifiques

### Gestion des données
- **Validation**: Joi/Yup côté backend, react-hook-form + zod côté frontend
- **Sécurité**: Hash bcrypt (12 rounds), rate limiting, CORS strict
- **Performances**: Pagination (20 items/page), lazy loading, cache Redis
- **RGPD**: Anonymisation données, export/suppression à la demande

### Interface utilisateur
- **Design system**: Composants réutilisables avec Storybook
- **Navigation**: Sidebar collapsible, breadcrumbs, raccourcis clavier
- **États**: Loading skeletons, error boundaries, toasts notifications
- **Formulaires**: Validation temps réel, auto-save brouillons

### API Design
- **REST**: Endpoints cohérents (`/api/v1/clients`, `/api/v1/invoices`)
- **Réponses**: Format JSON uniforme avec métadonnées (pagination, total)
- **Erreurs**: Codes HTTP standards + messages explicites en français
- **Rate limiting**: 100 req/min par IP, 1000 req/min par user authentifié

### Tests et qualité
- **Couverture**: Minimum 80% backend, 60% frontend
- **E2E**: Scénarios utilisateur critiques (création facture, paiement)
- **Performance**: Bundle size < 500KB, Lighthouse score > 90
- **Sécurité**: Tests OWASP automatisés, audit dépendances

## Instructions de développement spécifiques

### Nouvelles fonctionnalités
1. **Analyser le besoin** : Créer user story avec critères d'acceptation
2. **Designer l'API** : Définir endpoints + schémas de validation
3. **Tests d'abord** : Écrire tests unitaires avant implémentation
4. **Backend puis frontend** : API stable avant interface
5. **Documentation** : Mettre à jour OpenAPI + README si nécessaire

### Génération PDF factures
- Utiliser templates Mustache pour flexibilité
- Supporter logos haute résolution (PNG/SVG)
- Inclure QR code pour paiement rapide
- Respecter normes françaises (mentions légales, TVA)
- Optimiser taille fichier (compression images)

### Module CRM
- **Scoring automatique** : Délais paiement + volume + récurrence
- **Historique complet** : Emails, appels, réunions avec timestamps
- **Segmentation** : Tags personnalisables + filtres avancés
- **Notifications** : Rappels anniversaires, renouvellements contrats

### Gestion temps/projets
- **Timer précis** : Stockage millisecondes, pause/reprise
- **Templates projets** : Phase type avec tâches prédéfinies  
- **Estimation vs réel** : Alertes dépassement budget temps
- **Facturation automatique** : Conversion heures → ligne facture

## Commandes de développement

### Backend (Node.js)
```bash
# Installation
pnpm install

# Développement avec hot-reload
pnpm dev

# Tests
pnpm test                    # Tests unitaires
pnpm test:e2e               # Tests end-to-end  
pnpm test:coverage          # Couverture de code

# Base de données
pnpm db:migrate             # Migrations
pnpm db:seed               # Données de test
pnpm db:reset              # Reset complet

# Build et déploiement
pnpm build
pnpm start
```

### Frontend (React)
```bash
# Installation (pnpm - standard 2025)
pnpm install

# Développement avec Vite + HMR
pnpm dev                   # Serveur dev sur :5173 (Vite)
pnpm storybook            # Composants sur :6006

# Tests modernes
pnpm test                 # Tests unitaires (Vitest)
pnpm test:e2e            # Tests E2E (Playwright)
pnpm lint                # Biome (remplace ESLint+Prettier 2025)
pnpm type-check          # Validation TypeScript

# Build optimisé
pnpm build               # Build avec optimisations IA
pnpm preview             # Prévisualisation build
pnpm analyze             # Analyse bundle size
```

### Docker (déploiement)
```bash
# Développement local
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# Reset environnement
docker-compose down -v && docker-compose up -d
```

## Workflow Git

### Branches
- `main` : Code production stable
- `develop` : Intégration nouvelles fonctionnalités  
- `feature/nom-fonctionnalite` : Développement feature
- `hotfix/nom-bug` : Corrections urgentes production

### Pull Requests
- **Titre** : `[SCOPE] Description courte`
- **Template** : Utiliser `.github/pull_request_template.md`
- **Reviews** : 2 approbations minimum pour `main`
- **Tests** : CI/CD vert obligatoire avant merge
- **Documentation** : Mettre à jour si changements API/UX

## Débogage et logging

### Logs structurés
```javascript
// Utiliser Winston avec format JSON
logger.info('Invoice created', { 
  userId: user.id, 
  invoiceId: invoice.id, 
  amount: invoice.total 
});
```

### Debugging frontend
- Redux DevTools pour état application
- React Developer Tools pour composants
- Console.log temporaires OK, mais nettoyer avant commit

### Monitoring production
- Sentry pour erreurs JavaScript/Node.js
- Métriques business (revenus, utilisateurs actifs)
- Alertes sur erreurs critiques (paiements, exports PDF)

## Sécurité

### Authentification
- JWT avec expiration courte (15min) + refresh token
- 2FA optionnel pour comptes premium
- Blocage après 5 tentatives de connexion échouées

### Données sensibles
- Chiffrement AES-256 pour données bancaires
- Hash bcrypt pour mots de passe (12 rounds minimum)
- Audit trail sur actions critiques (suppressions, modifications montants)

### RGPD/Privacy
- Consentement explicite collecte données
- Export données format standard (JSON)
- Anonymisation après suppression compte
- Logs accès pour audit

## Performance

### Frontend
- Code splitting par route
- Images optimisées (WebP avec fallback)
- Lazy loading composants lourds
- Service Worker pour cache offline

### Backend  
- Pagination systématique (LIMIT/OFFSET)
- Index base de données sur colonnes recherchées
- Cache Redis pour requêtes fréquentes
- Compression gzip responses

## Contribution

### Pour contributors externes
1. Fork le repository
2. Créer branche feature depuis `develop`
3. Respecter conventions code et tests
4. Ouvrir PR avec description détaillée
5. Répondre aux reviews et corriger si nécessaire

### Exemples de contributions bienvenues
- Nouveaux templates PDF
- Traductions (i18n)
- Intégrations API tierces
- Optimisations performances
- Documentation utilisateur

Toujours commencer par créer une issue pour discuter avant développement majeur.