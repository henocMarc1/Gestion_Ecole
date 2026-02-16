-- =====================================================
-- Déployer manuellement dans Supabase SQL Editor
-- =====================================================
-- 1. Copiez ce contenu entièrement
-- 2. Allez sur dashboard.supabase.io > votre projet > SQL Editor
-- 3. Collez et exécutez (Ctrl+Enter ou cmd+Enter)
-- =====================================================

-- Créer l'enum session si absent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_session') THEN
    CREATE TYPE attendance_session AS ENUM ('MORNING', 'AFTERNOON');
  END IF;
END$$;

-- Ajouter la colonne session avec default MORNING
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS session attendance_session NOT NULL DEFAULT 'MORNING';

-- Supprimer l'ancienne contrainte unique (student_id, date) si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_student_id_date_key'
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_date_key;
  END IF;
END$$;

-- Ajouter la nouvelle contrainte unique (student_id, date, session)
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

-- Index sur session pour optimiser les requêtes par séance
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session);

-- =====================================================
-- Correction de la contrainte de date (exécuter avec les sessions)
-- =====================================================
-- Autoriser la date du jour et +1 jour pour absorber les décalages horaires
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS check_attendance_date;

ALTER TABLE attendance 
ADD CONSTRAINT check_attendance_date CHECK (date <= (CURRENT_DATE + INTERVAL '1 day'));

-- =====================================================
-- Données de TEST (optionnel)
-- =====================================================
-- Récupérez les IDs réels depuis votre base:
-- SELECT id, first_name, last_name FROM students LIMIT 3;
-- SELECT id, name FROM classes LIMIT 1;

-- INSERT INTO attendance (student_id, class_id, date, session, status)
-- VALUES 
--   ('your-student-id-here', 'your-class-id-here', '2026-01-17', 'MORNING', 'ABSENT'),
--   ('your-student-id-here', 'your-class-id-here', '2026-01-17', 'AFTERNOON', 'PRESENT');

-- Vérifier les présences enregistrées
-- SELECT student_id, date, session, status FROM attendance 
-- WHERE date >= '2026-01-17' 
-- ORDER BY date DESC, session;
