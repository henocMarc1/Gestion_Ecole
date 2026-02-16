-- =====================================================
-- MIGRATION 034: Fix and ensure documents table exists
-- =====================================================
-- Crée ou recréé la table documents avec des politiques RLS simples

-- Supprimer les politiques existantes s'il y en a
DROP POLICY IF EXISTS "documents_select_by_school" ON documents;
DROP POLICY IF EXISTS "documents_insert_secretary_or_admin" ON documents;
DROP POLICY IF EXISTS "documents_delete_admin" ON documents;

-- Créer la table documents si elle n'existe pas
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'GENERAL',
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Index pour optimiser les requêtes
DROP INDEX IF EXISTS idx_documents_school_id;
DROP INDEX IF EXISTS idx_documents_student_id;
DROP INDEX IF EXISTS idx_documents_created_by;

CREATE INDEX idx_documents_school_id ON documents(school_id);
CREATE INDEX idx_documents_student_id ON documents(student_id);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_deleted ON documents(deleted_at);

-- Activer RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Politiques RLS SIMPLES (sans fonctions personnalisées)
-- Tous les utilisateurs de l'école peuvent voir les documents
CREATE POLICY "documents_select_by_school"
  ON documents FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  );

-- Les secrétaires et admins peuvent créer des documents
CREATE POLICY "documents_insert_secretary_or_admin"
  ON documents FOR INSERT
  WITH CHECK (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY', 'SUPER_ADMIN'))
  );

-- Les secrétaires et admins peuvent modifier les documents
CREATE POLICY "documents_update_secretary_or_admin"
  ON documents FOR UPDATE
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY', 'SUPER_ADMIN'))
  );

-- Les admins peuvent supprimer les documents
CREATE POLICY "documents_delete_admin"
  ON documents FOR DELETE
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
  );

-- Commentaires
COMMENT ON TABLE documents IS 'Documents administratifs des écoles';
COMMENT ON COLUMN documents.category IS 'Catégorie: GENERAL, STUDENT, CERTIFICATE, etc.';
COMMENT ON COLUMN documents.file_url IS 'URL du fichier (stocké dans Supabase Storage)';
