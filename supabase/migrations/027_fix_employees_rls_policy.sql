-- =====================================================
-- MIGRATION 027: Fix RLS policy on employees table
-- =====================================================
-- Ajoute une politique pour permettre aux utilisateurs authentifiés
-- de voir les employés de leur école

-- Vérifier si la politique existe et la supprimer si oui
DROP POLICY IF EXISTS "Authenticated users can view employees in their school" ON employees;

-- Ajouter la nouvelle politique qui permet à tous les utilisateurs 
-- de voir les employés de leur école (nécessaire pour trouver son propre enregistrement employee)
CREATE POLICY "Authenticated users can view employees in their school"
    ON employees FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid()
        )
    );

-- Commentaire pour documentation
COMMENT ON POLICY "Authenticated users can view employees in their school" ON employees 
IS 'Permet aux utilisateurs authentifiés de voir les employés de leur école pour trouver leur propre enregistrement';

-- =====================================================
-- PROBLÈME IDENTIFIÉ
-- =====================================================
-- Les utilisateurs n'ont pas d'enregistrement employee car aucun n'a été créé
-- pour mapper leur compte utilisateur. Cela doit être fait manuellement par l'administrateur
-- via la page de gestion des utilisateurs/employés dans l'application.
-- 
-- ACTION REQUISE:
-- 1. Assurez-vous que chaque utilisateur qui doit accéder aux congés a un enregistrement
--    dans la table "employees" avec son user_id correspondant
-- 2. Pour les utilisateurs existants, créer manuellement l'enregistrement employee
-- 3. Ou, implémenter une fonction qui crée automatiquement un enregistrement employee
--    lors de la création d'un utilisateur

