-- =====================================================
-- MIGRATION: Ajouter le rôle RH (Ressources Humaines)
-- =====================================================
-- Ajoute un nouveau rôle RH pour gérer le personnel,
-- les affectations et les présences.

-- Ajouter RH à l'enum user_role
-- Note: PostgreSQL ne supporte pas ALTER TYPE directement,
-- donc on doit créer un nouveau type et migrer les données

-- Créer le nouveau type avec RH
CREATE TYPE user_role_new AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'SECRETARY',
  'ACCOUNTANT',
  'TEACHER',
  'PARENT',
  'HR'
);

-- Changer la colonne role dans la table users
ALTER TABLE users ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;

-- Supprimer l'ancien enum
DROP TYPE user_role;

-- Renommer le nouvel enum
ALTER TYPE user_role_new RENAME TO user_role;

-- =====================================================
-- FONCTION HELPER: Vérifier si l'utilisateur est RH
-- =====================================================

CREATE OR REPLACE FUNCTION auth.is_hr()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'HR';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- Mettre à jour la fonction is_school_admin pour inclure RH
-- (RH fait partie de l'administration de l'école)
-- =====================================================

CREATE OR REPLACE FUNCTION auth.is_school_admin()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() IN ('SUPER_ADMIN', 'ADMIN', 'HR');
$$ LANGUAGE sql SECURITY DEFINER STABLE;
