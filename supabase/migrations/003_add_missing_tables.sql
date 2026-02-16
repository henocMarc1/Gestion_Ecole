-- =====================================================
-- MIGRATION 003: TABLES SUPPLÉMENTAIRES
-- =====================================================
-- Crée les tables documents et corrige les problèmes manquants
-- Note: Les migrations 001 et 002 doivent être exécutées en premier

-- Les fonctions RLS sont supposées être créées par migration 002
-- Si elles n'existent pas, réexécutez la migration 002 d'abord
-- Les politiques ci-dessous supposent que auth.user_school_id() existe

-- TABLE: documents (Documents administratifs)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'GENERAL',
  student_id UUID REFERENCES students(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- INDEX pour documents
CREATE INDEX idx_documents_school_id ON documents(school_id);
CREATE INDEX idx_documents_student_id ON documents(student_id);
CREATE INDEX idx_documents_created_by ON documents(created_by);

-- Activer RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour documents
CREATE POLICY "documents_select_by_school"
  ON documents FOR SELECT
  USING (
    school_id = auth.user_school_id() OR auth.is_super_admin()
  );

CREATE POLICY "documents_insert_secretary_or_admin"
  ON documents FOR INSERT
  WITH CHECK (
    (school_id = auth.user_school_id() OR auth.is_super_admin()) AND
    auth.has_role(ARRAY['ADMIN', 'SECRETARY'])
  );

CREATE POLICY "documents_delete_admin"
  ON documents FOR DELETE
  USING (
    (school_id = auth.user_school_id() OR auth.is_super_admin()) AND
    auth.has_role(ARRAY['ADMIN'])
  );

-- TABLE: accountant_reports (Rapports comptables)
CREATE TABLE IF NOT EXISTS accountant_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- INDEX
CREATE INDEX idx_accountant_reports_school_id ON accountant_reports(school_id);

-- RLS
ALTER TABLE accountant_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accountant_reports_select_finance_or_admin"
  ON accountant_reports FOR SELECT
  USING (
    (school_id = auth.user_school_id() OR auth.is_super_admin()) AND
    auth.has_role(ARRAY['ADMIN', 'ACCOUNTANT'])
  );

CREATE POLICY "accountant_reports_insert_finance_or_admin"
  ON accountant_reports FOR INSERT
  WITH CHECK (
    (school_id = auth.user_school_id() OR auth.is_super_admin()) AND
    auth.has_role(ARRAY['ADMIN', 'ACCOUNTANT'])
  );
