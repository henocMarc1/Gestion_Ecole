-- =====================================================
-- MIGRATION: Ajouter table des bulletins (bulletins)
-- =====================================================
-- Cette migration crée la table pour gérer les bulletins
-- trimestriels des élèves avec moyennes et appréciations

-- TABLE: bulletins (Bulletins trimestriels)
-- =====================================================
CREATE TABLE IF NOT EXISTS bulletins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL, -- 'Trimestre 1', 'Trimestre 2', 'Trimestre 3'
  average DECIMAL(5, 2) NOT NULL CHECK (average >= 0 AND average <= 20),
  remarks TEXT, -- Appréciations générales
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, term, school_id) -- Un bulletin par élève par trimestre
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bulletins_student ON bulletins(student_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_school ON bulletins(school_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_term ON bulletins(term);
CREATE INDEX IF NOT EXISTS idx_bulletins_issued_date ON bulletins(issued_date);
CREATE INDEX IF NOT EXISTS idx_bulletins_student_term ON bulletins(student_id, term);

-- Commentaires
COMMENT ON TABLE bulletins IS 'Bulletins trimestriels avec moyennes et appréciations des élèves';
COMMENT ON COLUMN bulletins.term IS 'Trimestre (Trimestre 1, 2 ou 3)';
COMMENT ON COLUMN bulletins.average IS 'Moyenne générale du trimestre /20';
COMMENT ON COLUMN bulletins.remarks IS 'Appréciations générales du conseil de classe';
COMMENT ON COLUMN bulletins.issued_date IS 'Date d''édition du bulletin';

-- =====================================================
-- Politiques RLS pour bulletins
-- =====================================================

-- Activer RLS
ALTER TABLE bulletins ENABLE ROW LEVEL SECURITY;

-- Policy: Les enseignants voient les bulletins de leur école
CREATE POLICY "bulletins_teacher_select"
  ON bulletins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = bulletins.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY', 'TEACHER')
    )
  );

-- Policy: Les parents voient uniquement les bulletins de leurs enfants
CREATE POLICY "bulletins_parent_select"
  ON bulletins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents_students ps
      INNER JOIN users parent_user ON parent_user.id = ps.parent_id
      WHERE parent_user.id = auth.uid()
      AND ps.student_id = bulletins.student_id
      AND parent_user.school_id = bulletins.school_id
    )
  );

-- Policy: Les enseignants et admins peuvent créer des bulletins
CREATE POLICY "bulletins_insert_admin"
  ON bulletins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = bulletins.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- Policy: Les admins peuvent modifier les bulletins
CREATE POLICY "bulletins_update_admin"
  ON bulletins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = bulletins.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- Policy: Les admins peuvent supprimer les bulletins
CREATE POLICY "bulletins_delete_admin"
  ON bulletins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = bulletins.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- =====================================================
-- TRIGGER: Mettre à jour updated_at automatiquement
-- =====================================================

CREATE OR REPLACE FUNCTION update_bulletins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bulletins_updated_at_trigger
BEFORE UPDATE ON bulletins
FOR EACH ROW
EXECUTE FUNCTION update_bulletins_updated_at();
