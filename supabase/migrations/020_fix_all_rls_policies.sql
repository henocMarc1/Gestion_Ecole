-- Migration: Fix All RLS Policies
-- Description: Corriger toutes les politiques RLS pour payrolls et notifications
-- Created: 2026-02-10

-- =====================================================
-- TABLE PAYROLLS - POLITIQUES RLS
-- =====================================================

-- Désactiver temporairement RLS pour nettoyer
ALTER TABLE payrolls DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can view payrolls" ON payrolls;
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can insert payrolls" ON payrolls;
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can update payrolls" ON payrolls;
DROP POLICY IF EXISTS "ACCOUNTANT and ADMIN can delete payrolls" ON payrolls;
DROP POLICY IF EXISTS "SUPER_ADMIN can do anything with payrolls" ON payrolls;
DROP POLICY IF EXISTS "ADMIN and ACCOUNTANT can insert payrolls" ON payrolls;

-- Réactiver RLS
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;

-- Nouvelle politique SELECT pour ADMIN/ACCOUNTANT/SUPER_ADMIN
CREATE POLICY "Allow read access to payrolls"
    ON payrolls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
            AND (users.school_id = payrolls.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- Nouvelle politique INSERT pour ADMIN/ACCOUNTANT/SUPER_ADMIN
CREATE POLICY "Allow insert payrolls"
    ON payrolls FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
            AND (users.school_id = payrolls.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- Nouvelle politique UPDATE pour ADMIN/ACCOUNTANT/SUPER_ADMIN
CREATE POLICY "Allow update payrolls"
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

-- Nouvelle politique DELETE pour ADMIN/ACCOUNTANT/SUPER_ADMIN
CREATE POLICY "Allow delete payrolls"
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
-- TABLE NOTIFICATIONS - POLITIQUES RLS
-- =====================================================

-- Désactiver temporairement RLS pour nettoyer
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "ADMIN can create notifications" ON notifications;
DROP POLICY IF EXISTS "ADMIN can view notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Allow read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow delete notifications" ON notifications;

-- Réactiver RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Politique SELECT pour ADMIN/SUPER_ADMIN
CREATE POLICY "Allow read notifications"
    ON notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
            AND (users.school_id = notifications.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- Politique INSERT pour ADMIN/SUPER_ADMIN
CREATE POLICY "Allow insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
            AND (users.school_id = notifications.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- Politique UPDATE pour ADMIN/SUPER_ADMIN
CREATE POLICY "Allow update notifications"
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

-- Politique DELETE pour ADMIN/SUPER_ADMIN
CREATE POLICY "Allow delete notifications"
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
-- VÉRIFICATION
-- =====================================================

-- Vérifier que les politiques sont bien créées
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('payrolls', 'notifications')
ORDER BY tablename, policyname;
