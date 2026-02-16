-- =====================================================
-- MIGRATION 031: Bypass RLS for system-level employee creation
-- =====================================================
-- Alternative à SECURITY DEFINER: Ajouter une politique permissive pour les insertions système

-- Supprimer la politique restrictive actuelle pour les inserts
DROP POLICY IF EXISTS "HR and ADMIN can insert employees" ON employees;

-- Créer une nouvelle politique plus permissive qui permet aussi les insertions via triggers
-- Cette politique vérifie si c'est une insertion via un trigger (dans lequel cas l'inserteur est techniquement NULL)
-- OU si c'est un utilisateur HR/ADMIN/SUPER_ADMIN

CREATE POLICY "Allow employee creation via system and HR roles"
    ON employees FOR INSERT
    WITH CHECK (
        -- Autoriser si aucun utilisateur authentifié (trigger/système)
        auth.uid() IS NULL 
        -- OU autoriser si l'utilisateur authentifié a les bons rôles
        OR school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- Commentaire
COMMENT ON POLICY "Allow employee creation via system and HR roles" ON employees 
IS 'Permet la création d''employés via les triggers système ET les utilisateurs HR/ADMIN/SUPER_ADMIN';
