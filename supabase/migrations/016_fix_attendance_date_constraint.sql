-- =====================================================
-- Fix attendance date constraint to allow same-day entries
-- and one day ahead for corrections
-- =====================================================

-- Drop the old constraint that was too restrictive
ALTER TABLE attendance 
DROP CONSTRAINT check_attendance_date;

-- Add new constraint that allows current date and up to 1 day in the future
-- This handles timezone differences between client and server
ALTER TABLE attendance 
ADD CONSTRAINT check_attendance_date CHECK (date <= (CURRENT_DATE + INTERVAL '1 day'));

-- Verify the change
-- SELECT constraint_name, check_clause 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'attendance' AND constraint_type = 'CHECK';
