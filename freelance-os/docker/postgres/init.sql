-- Initialisation de la base de données FreelanceOS
-- Ce script est exécuté au premier démarrage de PostgreSQL

-- Création de l'extension pour les UUIDs si pas déjà présente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Création de l'extension pour le full-text search (utile pour les recherches clients/prospects)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Création de l'extension pour les types de données avancés
CREATE EXTENSION IF NOT EXISTS "hstore";

-- Configuration des paramètres de base
ALTER DATABASE freelance_os SET timezone TO 'Europe/Paris';

-- Message de confirmation
\echo 'Base de données FreelanceOS initialisée avec succès ✅'