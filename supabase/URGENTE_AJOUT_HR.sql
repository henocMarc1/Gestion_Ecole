-- =====================================================
-- 🔴 MIGRATION CRITIQUE - À EXÉCUTER IMMÉDIATEMENT
-- =====================================================
-- Cette migration corrige l'erreur:
-- "invalid input value for enum user_role: HR"
--
-- INSTRUCTIONS:
-- 1. Allez sur supabase.co
-- 2. Sélectionnez votre projet
-- 3. SQL Editor → New query
-- 4. Copiez-collez ce fichier complet
-- 5. Cliquez sur "Run" (ou Ctrl+Enter)
-- =====================================================

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
-- ✅ TERMINÉ - Vous pouvez maintenant créer des utilisateurs HR
-- =====================================================

-- VÉRIFICATION (optionnel):
-- Exécutez cette requête pour vérifier que HR est bien ajouté:
-- SELECT unnest(enum_range(NULL::user_role))::text AS role;
