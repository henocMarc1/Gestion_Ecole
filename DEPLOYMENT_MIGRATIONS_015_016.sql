-- =====================================================
-- DÉPLOIEMENT URGENT - Exécuter dans Supabase SQL Editor
-- =====================================================
-- Copier TOUT ce contenu et exécuter en une seule opération
-- dans: dashboard.supabase.io > SQL Editor > New Query
-- =====================================================

-- MIGRATION 015: Ajouter la colonne session et les contraintes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_session') THEN
    CREATE TYPE attendance_session AS ENUM ('MORNING', 'AFTERNOON');
  END IF;
END$$;

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS session attendance_session NOT NULL DEFAULT 'MORNING';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_student_id_date_key'
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_date_key;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_student_date_session_key'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_student_date_session_key UNIQUE (student_id, date, session);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session);

-- =====================================================
-- MIGRATION 016: Corriger la contrainte de date
-- =====================================================
ALTER TABLE attendance 
DROP CONSTRAINT check_attendance_date;

ALTER TABLE attendance 
ADD CONSTRAINT check_attendance_date CHECK (date <= (CURRENT_DATE + INTERVAL '1 day'));

-- =====================================================
-- VÉRIFICATION (optionnel)
-- =====================================================
-- Affiche les colonnes de attendance
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'attendance' ORDER BY ordinal_position;

-- Affiche les contraintes de attendance
-- SELECT constraint_name, check_clause 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'attendance' AND constraint_type = 'CHECK';
