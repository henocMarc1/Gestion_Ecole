-- Migration: Employee Self Attendance
-- Description: Permettre aux employés de marquer leur propre présence
-- Created: 2026-02-10

-- =====================================================
-- EMPLOYEE SELF-ATTENDANCE POLICIES
-- =====================================================

-- Employees can view their own attendance records
DROP POLICY IF EXISTS "Employees can view their own attendance records" ON attendance_records;
CREATE POLICY "Employees can view their own attendance records"
    ON attendance_records FOR SELECT
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

-- Employees can insert their own attendance records
DROP POLICY IF EXISTS "Employees can insert their own attendance records" ON attendance_records;
CREATE POLICY "Employees can insert their own attendance records"
    ON attendance_records FOR INSERT
    WITH CHECK (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
        AND
        school_id IN (
            SELECT school_id FROM employees WHERE user_id = auth.uid()
        )
    );

-- Employees can update their own attendance records (same day only)
DROP POLICY IF EXISTS "Employees can update their own attendance records" ON attendance_records;
CREATE POLICY "Employees can update their own attendance records"
    ON attendance_records FOR UPDATE
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
        AND
        date = CURRENT_DATE  -- Only today's records
    )
    WITH CHECK (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
        AND
        date = CURRENT_DATE
    );

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Afficher les politiques d'attendance_records
SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'attendance_records'
ORDER BY policyname;
