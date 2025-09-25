# 🧪 Guide de Test - FreelanceOS

## 📋 Prérequis

Avant de commencer, vérifiez que vous avez :
- ✅ **Node.js v20+** (vous avez v22.17.0)
- ✅ **npm/pnpm** (npm v10.9.2 détecté)
- ⚠️ **Docker** (non installé - voir alternatives ci-dessous)
- **PostgreSQL** (optionnel avec Docker)
- **Redis** (optionnel avec Docker)

## 🚀 Méthodes de test disponibles

### **Option A : Test avec Docker (Recommandé)**

Si vous avez Docker installé :
```bash
# 1. Aller à la racine du projet
cd "C:\Users\swanm\Desktop\Projet perso\freelance-os"

# 2. Lancer tous les services
docker-compose up -d

# 3. Vérifier les logs
docker-compose logs -f backend
docker-compose logs -f frontend

# 4. Accéder aux services
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:3000
# - Documentation API: http://localhost:3000/docs
```

### **Option B : Test Local (Sans Docker)**

Si vous n'avez pas Docker, testez en local :

#### **1. Installation Backend**
```bash
# Naviguer vers le backend
cd "C:\Users\swanm\Desktop\Projet perso\freelance-os\backend"

# Installer pnpm (plus rapide que npm)
npm install -g pnpm

# Installer les dépendances
pnpm install

# Note: Les services PostgreSQL et Redis sont requis
# Vous pouvez les installer localement ou utiliser des services cloud
```

#### **2. Installation Frontend**
```bash
# Naviguer vers le frontend
cd "C:\Users\swanm\Desktop\Projet perso\freelance-os\frontend"

# Installer les dépendances
pnpm install

# Démarrer le serveur de développement
pnpm dev
```

### **Option C : Installation Docker Desktop (Recommandé)**

1. Téléchargez **Docker Desktop** pour Windows :
   - https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe

2. Installez et redémarrez votre ordinateur

3. Lancez Docker Desktop

4. Testez l'installation :
   ```bash
   docker --version
   docker-compose --version
   ```

## 🔧 Tests de validation par composant

### **Backend (API)**

#### Test 1 : Compilation TypeScript
```bash
cd backend
pnpm type-check
```

#### Test 2 : Linting et qualité
```bash
pnpm lint
```

#### Test 3 : Tests unitaires
```bash
pnpm test
```

#### Test 4 : Health check
```bash
# Une fois le backend démarré
curl http://localhost:3000/health
# ou visitez http://localhost:3000/health dans votre navigateur
```

### **Frontend (React)**

#### Test 1 : Compilation TypeScript
```bash
cd frontend
pnpm type-check
```

#### Test 2 : Build de production
```bash
pnpm build
```

#### Test 3 : Linting
```bash
pnpm lint
```

#### Test 4 : Tests unitaires
```bash
pnpm test
```

## 🎯 Points de vérification

### ✅ **Structure des fichiers**
- [ ] `backend/src/server.ts` existe
- [ ] `backend/prisma/schema.prisma` existe
- [ ] `frontend/src/App.tsx` existe
- [ ] `docker-compose.yml` à la racine
- [ ] Fichiers `.env` créés dans backend/ et frontend/

### ✅ **Services fonctionnels**
- [ ] Backend démarre sur port 3000
- [ ] Frontend démarre sur port 5173
- [ ] PostgreSQL accessible (si Docker)
- [ ] Redis accessible (si Docker)
- [ ] Documentation Swagger accessible sur /docs

### ✅ **API Endpoints**
- [ ] GET `/health` retourne status OK
- [ ] GET `/docs` affiche la documentation Swagger
- [ ] Routes API préfixées par `/api/v1/`

## 🐛 Dépannage courant

### **Erreur : "Cannot find module"**
```bash
# Réinstaller les dépendances
rm -rf node_modules
pnpm install
```

### **Port déjà utilisé**
```bash
# Tuer les processus sur les ports 3000/5173
# Windows PowerShell:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### **Problème Docker**
```bash
# Nettoyer Docker
docker-compose down -v
docker system prune -f
docker-compose up --build -d
```

### **Base de données non accessible**
1. Vérifiez que PostgreSQL est démarré
2. Vérifiez les variables d'environnement dans `.env`
3. Exécutez les migrations Prisma : `pnpm db:push`

## 📊 Métriques de succès

### **Performance attendue**
- ⚡ **Démarrage backend** : < 10 secondes
- ⚡ **Démarrage frontend** : < 5 secondes
- ⚡ **Hot-reload** : < 2 secondes
- ⚡ **API Response** : < 200ms

### **Qualité code**
- 📋 **TypeScript** : 0 erreurs de type
- 📋 **Linting** : 0 erreurs Biome
- 📋 **Tests** : Couverture > 80% (backend)
- 📋 **Build** : Succès sans warnings

## 🎉 Validation finale

Si tous ces points sont ✅ :
1. **Structure** : Architecture créée correctement
2. **Backend** : API Fastify fonctionnelle
3. **Frontend** : React app accessible
4. **Base de données** : Schéma Prisma valide
5. **Docker** : Services orchestrés
6. **Développement** : Hot-reload opérationnel

➡️ **Prêt pour la Phase 2 : Authentification !**

---

💡 **Conseil** : Si vous rencontrez des problèmes, commencez par l'Option B (test local) pour valider chaque composant individuellement, puis passez à Docker une fois que tout fonctionne.