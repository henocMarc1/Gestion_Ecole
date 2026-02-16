-- Migration: Politiques RLS Permissives (Debug)
-- Description: Politiques ultra-permissives pour identifier le problème
-- Created: 2026-02-10

-- =====================================================
-- NETTOYAGE COMPLET
-- =====================================================

ALTER TABLE payrolls DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques payrolls
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'payrolls') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON payrolls';
    END LOOP;
END $$;

-- Supprimer toutes les politiques notifications
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'notifications') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON notifications';
    END LOOP;
END $$;

-- =====================================================
-- PAYROLLS - POLITIQUES ULTRA-PERMISSIVES
-- =====================================================

ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;

-- Tout le monde authentifié peut tout faire (pour test)
CREATE POLICY "payrolls_select_all"
    ON payrolls FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "payrolls_insert_all"
    ON payrolls FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payrolls_update_all"
    ON payrolls FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payrolls_delete_all"
    ON payrolls FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- NOTIFICATIONS - POLITIQUES ULTRA-PERMISSIVES
-- =====================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Tout le monde authentifié peut tout faire (pour test)
CREATE POLICY "notifications_select_all"
    ON notifications FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_insert_all"
    ON notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update_all"
    ON notifications FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_delete_all"
    ON notifications FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- VÉRIFICATION
-- =====================================================

SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('payrolls', 'notifications')
ORDER BY tablename, cmd;
