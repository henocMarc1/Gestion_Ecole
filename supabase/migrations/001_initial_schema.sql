-- =====================================================
-- SCHEMA DE BASE DE DONNÉES - SYSTÈME DE GESTION D'ÉCOLE
-- =====================================================
-- Ce fichier contient toutes les migrations pour créer
-- le schéma complet de la base de données PostgreSQL/Supabase
-- =====================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TYPES ENUM
-- =====================================================

-- Rôles utilisateurs
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'SECRETARY',
  'ACCOUNTANT',
  'TEACHER',
  'PARENT'
);

-- Statuts
CREATE TYPE student_status AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
CREATE TYPE message_status AS ENUM ('DRAFT', 'SENT', 'READ');
CREATE TYPE fee_type AS ENUM ('TUITION', 'REGISTRATION', 'UNIFORM', 'BOOKS', 'TRANSPORT', 'MEAL', 'ACTIVITY', 'OTHER');

-- =====================================================
-- TABLE: schools (Écoles)
-- =====================================================
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  logo_url TEXT,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_schools_code ON schools(code);
CREATE INDEX idx_schools_active ON schools(is_active) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE: users (Utilisateurs)
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_school ON users(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- TABLE: years (Années scolaires)
-- =====================================================
CREATE TABLE years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- Ex: "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT check_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_years_school ON years(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_years_current ON years(is_current) WHERE is_current = true AND deleted_at IS NULL;

-- =====================================================
-- TABLE: classes (Classes)
-- =====================================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year_id UUID NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- Ex: "CP1 A", "CE2 B"
  level VARCHAR(50) NOT NULL, -- Ex: "Maternelle", "CP", "CE1"
  capacity INTEGER DEFAULT 30,
  room VARCHAR(50),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_classes_school ON classes(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_year ON classes(year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_level ON classes(level);

-- =====================================================
-- TABLE: teacher_classes (Association Enseignant-Classe)
-- =====================================================
CREATE TABLE teacher_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject VARCHAR(100), -- Matière enseignée (optionnel)
  is_main_teacher BOOLEAN DEFAULT false, -- Enseignant principal de la classe
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, class_id)
);

CREATE INDEX idx_teacher_classes_teacher ON teacher_classes(teacher_id);
CREATE INDEX idx_teacher_classes_class ON teacher_classes(class_id);

-- =====================================================
-- TABLE: students (Élèves)
-- =====================================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('M', 'F')),
  registration_number VARCHAR(50) UNIQUE,
  photo_url TEXT,
  place_of_birth VARCHAR(255),
  nationality VARCHAR(100) DEFAULT 'Ivoirienne',
  blood_group VARCHAR(5),
  medical_notes TEXT,
  status student_status DEFAULT 'ACTIVE',
  enrollment_date DATE DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_students_school ON students(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_class ON students(class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_status ON students(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_registration ON students(registration_number);
CREATE INDEX idx_students_name ON students(last_name, first_name);

-- =====================================================
-- TABLE: parents_students (Association Parent-Élève)
-- =====================================================
CREATE TABLE parents_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(50) NOT NULL, -- Ex: "Père", "Mère", "Tuteur"
  is_primary_contact BOOLEAN DEFAULT false,
  can_pickup BOOLEAN DEFAULT true,
  emergency_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, student_id)
);

CREATE INDEX idx_parents_students_parent ON parents_students(parent_id);
CREATE INDEX idx_parents_students_student ON parents_students(student_id);
CREATE INDEX idx_parents_students_primary ON parents_students(is_primary_contact) WHERE is_primary_contact = true;

-- =====================================================
-- TABLE: attendance (Présences)
-- =====================================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'PRESENT',
  notes TEXT,
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date),
  CONSTRAINT check_attendance_date CHECK (date <= CURRENT_DATE)
);

CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_class ON attendance(class_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_marked_by ON attendance(marked_by);

-- =====================================================
-- TABLE: fees (Frais de scolarité)
-- =====================================================
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year_id UUID NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type fee_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) DEFAULT 'XOF',
  applicable_to VARCHAR(50), -- "ALL", "CP", "CE1", etc.
  due_date DATE,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_fees_school ON fees(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fees_year ON fees(year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fees_type ON fees(type);

-- =====================================================
-- TABLE: invoices (Factures)
-- =====================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status invoice_status DEFAULT 'DRAFT',
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'XOF',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT check_invoice_dates CHECK (due_date >= issue_date),
  CONSTRAINT check_invoice_amounts CHECK (total >= 0)
);

CREATE INDEX idx_invoices_school ON invoices(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_student ON invoices(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- =====================================================
-- TABLE: invoice_items (Lignes de facture)
-- =====================================================
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  fee_id UUID REFERENCES fees(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_quantity CHECK (quantity > 0),
  CONSTRAINT check_prices CHECK (unit_price >= 0 AND total >= 0)
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_fee ON invoice_items(fee_id);

-- =====================================================
-- TABLE: payments (Paiements)
-- =====================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'XOF',
  payment_method VARCHAR(50) NOT NULL, -- "CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHECK"
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status payment_status DEFAULT 'PENDING',
  transaction_id VARCHAR(255),
  receipt_url TEXT,
  notes TEXT,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_school ON payments(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_invoice ON payments(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_student ON payments(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_number ON payments(payment_number);
CREATE INDEX idx_payments_status ON payments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_date ON payments(payment_date);

-- =====================================================
-- TABLE: messages (Messages/Notifications)
-- =====================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status message_status DEFAULT 'DRAFT',
  read_at TIMESTAMPTZ,
  parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_school ON messages(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_sender ON messages(sender_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_recipient ON messages(recipient_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- =====================================================
-- TABLE: audit_logs (Journaux d'audit)
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- Ex: "CREATE_USER", "UPDATE_PAYMENT", "DELETE_STUDENT"
  entity_type VARCHAR(50) NOT NULL, -- Ex: "USER", "PAYMENT", "STUDENT"
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_school ON audit_logs(school_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- =====================================================
-- TRIGGERS: updated_at auto-update
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger sur toutes les tables avec updated_at
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_years_updated_at BEFORE UPDATE ON years
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fees_updated_at BEFORE UPDATE ON fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER: Validation de la fenêtre de 48h pour attendance
-- =====================================================
CREATE OR REPLACE FUNCTION check_attendance_edit_window()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si la modification est dans la fenêtre de 48h
  IF (CURRENT_DATE - NEW.date) > 2 THEN
    -- Exception: Super Admin et Admin peuvent modifier
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('SUPER_ADMIN', 'ADMIN')
    ) THEN
      RAISE EXCEPTION 'La présence ne peut être modifiée que dans les 48 heures';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_attendance_window BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION check_attendance_edit_window();

-- =====================================================
-- TRIGGER: Auto-calcul du total des factures
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10, 2);
BEGIN
  -- Calculer le sous-total depuis les items
  SELECT COALESCE(SUM(total), 0) INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = NEW.id;
  
  -- Mettre à jour les montants de la facture
  UPDATE invoices
  SET 
    subtotal = v_subtotal,
    total = v_subtotal - COALESCE(discount, 0) + COALESCE(tax, 0)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION calculate_invoice_total();

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour générer un numéro de facture unique
CREATE OR REPLACE FUNCTION generate_invoice_number(p_school_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_year VARCHAR(4);
  v_sequence INTEGER;
  v_number VARCHAR(50);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 10) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM invoices
  WHERE school_id = p_school_id
  AND invoice_number LIKE 'INV-' || v_year || '%';
  
  v_number := 'INV-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour générer un numéro de paiement unique
CREATE OR REPLACE FUNCTION generate_payment_number(p_school_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_year VARCHAR(4);
  v_sequence INTEGER;
  v_number VARCHAR(50);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM 10) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM payments
  WHERE school_id = p_school_id
  AND payment_number LIKE 'PAY-' || v_year || '%';
  
  v_number := 'PAY-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTAIRES SUR LES TABLES
-- =====================================================
COMMENT ON TABLE schools IS 'Table des écoles gérées par le système';
COMMENT ON TABLE users IS 'Utilisateurs du système (tous rôles confondus)';
COMMENT ON TABLE years IS 'Années scolaires';
COMMENT ON TABLE classes IS 'Classes par année scolaire';
COMMENT ON TABLE teacher_classes IS 'Association entre enseignants et classes';
COMMENT ON TABLE students IS 'Élèves inscrits';
COMMENT ON TABLE parents_students IS 'Association entre parents et leurs enfants';
COMMENT ON TABLE attendance IS 'Présences quotidiennes des élèves';
COMMENT ON TABLE fees IS 'Catalogue des frais de scolarité';
COMMENT ON TABLE invoices IS 'Factures émises aux élèves/parents';
COMMENT ON TABLE invoice_items IS 'Détail des lignes de facturation';
COMMENT ON TABLE payments IS 'Paiements effectués';
COMMENT ON TABLE messages IS 'Système de messagerie interne';
COMMENT ON TABLE audit_logs IS 'Journal d''audit de toutes les actions sensibles';
