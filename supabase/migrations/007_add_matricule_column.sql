-- =====================================================
-- MIGRATION: Ajouter colonne matricule pour les élèves
-- =====================================================
-- Cette migration ajoute une colonne matricule distincte
-- de registration_number pour une meilleure organisation

-- Ajouter la colonne matricule
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS matricule VARCHAR(50) UNIQUE;

-- Créer un index sur le matricule
CREATE INDEX IF NOT EXISTS idx_students_matricule ON students(matricule);

-- Mettre à jour les élèves existants avec un matricule généré
WITH numbered_students AS (
  SELECT 
    id,
    CONCAT(
      EXTRACT(YEAR FROM created_at)::TEXT, 
      '-', 
      UPPER(SUBSTRING(first_name FROM 1 FOR 3)),
      '-',
      LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0')
    ) as new_matricule
  FROM students
  WHERE matricule IS NULL AND deleted_at IS NULL
)
UPDATE students 
SET matricule = numbered_students.new_matricule
FROM numbered_students
WHERE students.id = numbered_students.id;

-- Commentaire
COMMENT ON COLUMN students.matricule IS 'Matricule unique de l''élève généré automatiquement';
