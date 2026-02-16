-- =====================================================
-- MIGRATION: Ajouter table des notes (grades)
-- =====================================================
-- Cette migration crée la table pour gérer les notes
-- des élèves par matière et trimestre

-- TABLE: grades (Notes des élèves)
-- =====================================================
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  grade DECIMAL(5, 2) NOT NULL CHECK (grade >= 0),
  max_grade DECIMAL(5, 2) NOT NULL DEFAULT 20 CHECK (max_grade > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  term VARCHAR(50) NOT NULL, -- 'Trimestre 1', 'Trimestre 2', 'Trimestre 3'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_grade CHECK (grade <= max_grade)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_teacher ON grades(teacher_id);
CREATE INDEX IF NOT EXISTS idx_grades_school ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_date ON grades(date);
CREATE INDEX IF NOT EXISTS idx_grades_term ON grades(term);
CREATE INDEX IF NOT EXISTS idx_grades_student_term ON grades(student_id, term);

-- Commentaires
COMMENT ON TABLE grades IS 'Notes des élèves par matière et trimestre';
COMMENT ON COLUMN grades.subject IS 'Matière concernée';
COMMENT ON COLUMN grades.grade IS 'Note obtenue';
COMMENT ON COLUMN grades.max_grade IS 'Note maximale possible (ex: 20)';
COMMENT ON COLUMN grades.date IS 'Date de l''évaluation';
COMMENT ON COLUMN grades.term IS 'Trimestre (Trimestre 1, 2 ou 3)';

-- =====================================================
-- Politiques RLS pour grades
-- =====================================================

-- Activer RLS
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Policy: Les enseignants voient uniquement leurs notes pour leur école
CREATE POLICY "grades_teacher_select"
  ON grades FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = grades.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- Policy: Les parents voient uniquement les notes de leurs enfants
CREATE POLICY "grades_parent_select"
  ON grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents_students ps
      INNER JOIN users parent_user ON parent_user.id = ps.parent_id
      WHERE parent_user.id = auth.uid()
      AND ps.student_id = grades.student_id
      AND parent_user.school_id = grades.school_id
    )
  );

-- Policy: Les enseignants peuvent créer des notes pour leur école
CREATE POLICY "grades_insert_teacher"
  ON grades FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = grades.school_id
      AND u.role = 'TEACHER'
    )
  );

-- Policy: Les enseignants peuvent modifier leurs notes
CREATE POLICY "grades_update_teacher"
  ON grades FOR UPDATE
  USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = grades.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- Policy: Les enseignants peuvent supprimer leurs notes
CREATE POLICY "grades_delete_teacher"
  ON grades FOR DELETE
  USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = grades.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- =====================================================
-- TRIGGER: Mettre à jour updated_at automatiquement
-- =====================================================

CREATE OR REPLACE FUNCTION update_grades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grades_updated_at_trigger
BEFORE UPDATE ON grades
FOR EACH ROW
EXECUTE FUNCTION update_grades_updated_at();
