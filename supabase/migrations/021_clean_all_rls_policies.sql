-- Migration: Clean All RLS Policies (Complete Cleanup)
-- Description: Suppression complète de toutes les politiques RLS et recréation propre
-- Created: 2026-02-10

-- =====================================================
-- SUPPRESSION COMPLÈTE - PAYROLLS
-- =====================================================

ALTER TABLE payrolls DISABLE ROW LEVEL SECURITY;

-- Supprimer TOUTES les politiques existantes
DROP POLICY IF EXISTS "ADMIN and ACCOUNTANT can view payrolls" ON payrolls;
DROP POLICY IF EXISTS "ADMIN and ACCOUNTANT can insert payrolls" ON payrolls;
DROP POLICY IF EXISTS "ADMIN and ACCOUNTANT can update payrolls" ON payrolls;
DROP POLICY IF EXISTS "ADMIN and ACCOUNTANT can delete payrolls" ON payrolls;
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can view payrolls" ON payrolls;
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can insert payrolls" ON payrolls;
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can update payrolls" ON payrolls;
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can delete payrolls" ON payrolls;
DROP POLICY IF EXISTS "SUPER_ADMIN can do anything with payrolls" ON payrolls;
DROP POLICY IF EXISTS "Allow read access to payrolls" ON payrolls;
DROP POLICY IF EXISTS "Allow insert payrolls" ON payrolls;
DROP POLICY IF EXISTS "Allow update payrolls" ON payrolls;
DROP POLICY IF EXISTS "Allow delete payrolls" ON payrolls;

-- =====================================================
-- SUPPRESSION COMPLÈTE - NOTIFICATIONS
-- =====================================================

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Supprimer TOUTES les politiques existantes
DROP POLICY IF EXISTS "ADMIN can create notifications" ON notifications;
DROP POLICY IF EXISTS "ADMIN can view notifications" ON notifications;
DROP POLICY IF EXISTS "ADMIN can update notifications" ON notifications;
DROP POLICY IF EXISTS "ADMIN can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can view notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Allow read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow delete notifications" ON notifications;

-- =====================================================
-- CRÉATION PROPRE - PAYROLLS (4 politiques uniquement)
-- =====================================================

ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;

-- SELECT : ADMIN, ACCOUNTANT, SUPER_ADMIN peuvent lire
CREATE POLICY "payrolls_select_policy"
    ON payrolls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
            AND (users.school_id = payrolls.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- INSERT : ADMIN, ACCOUNTANT, SUPER_ADMIN peuvent créer
CREATE POLICY "payrolls_insert_policy"
    ON payrolls FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
            AND (users.school_id = payrolls.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- UPDATE : ADMIN, ACCOUNTANT, SUPER_ADMIN peuvent modifier
CREATE POLICY "payrolls_update_policy"
    ON payrolls FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
            AND (users.school_id = payrolls.school_id OR users.role = 'SUPER_ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
            AND (users.school_id = payrolls.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- DELETE : ADMIN, ACCOUNTANT, SUPER_ADMIN peuvent supprimer
CREATE POLICY "payrolls_delete_policy"
    ON payrolls FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
            AND (users.school_id = payrolls.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- =====================================================
-- CRÉATION PROPRE - NOTIFICATIONS (4 politiques uniquement)
-- =====================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT : ADMIN, SUPER_ADMIN peuvent lire
CREATE POLICY "notifications_select_policy"
    ON notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
            AND (users.school_id = notifications.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- INSERT : ADMIN, SUPER_ADMIN peuvent créer
CREATE POLICY "notifications_insert_policy"
    ON notifications FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
            AND (users.school_id = notifications.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- UPDATE : ADMIN, SUPER_ADMIN peuvent modifier
CREATE POLICY "notifications_update_policy"
    ON notifications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
            AND (users.school_id = notifications.school_id OR users.role = 'SUPER_ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
            AND (users.school_id = notifications.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- DELETE : ADMIN, SUPER_ADMIN peuvent supprimer
CREATE POLICY "notifications_delete_policy"
    ON notifications FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
            AND (users.school_id = notifications.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================

-- Cette requête doit retourner exactement 8 lignes (4 + 4)
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN policyname LIKE '%select%' THEN '1-SELECT'
        WHEN policyname LIKE '%insert%' THEN '2-INSERT'
        WHEN policyname LIKE '%update%' THEN '3-UPDATE'
        WHEN policyname LIKE '%delete%' THEN '4-DELETE'
    END as operation_order
FROM pg_policies 
WHERE tablename IN ('payrolls', 'notifications')
ORDER BY tablename, operation_order;
