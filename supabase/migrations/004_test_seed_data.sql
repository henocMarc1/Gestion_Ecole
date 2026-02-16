-- =====================================================
-- SEED DATA POUR TESTER LE SYSTÈME
-- =====================================================
-- Cette migration insère des données de test pour tous les rôles

-- Variables
DO $$ 
DECLARE
  v_super_admin_id UUID;
  v_school_id UUID;
  v_admin_id UUID;
  v_secretary_id UUID;
  v_accountant_id UUID;
  v_teacher_id UUID;
  v_parent_id UUID;
  v_year_id UUID;
  v_class_id UUID;
  v_student_id UUID;
BEGIN

-- 1. Créer une école de test
INSERT INTO schools (name, code, address, phone, email, website)
VALUES (
  'École Test Primaire',
  'ETP-001',
  'Rue des Tests, Abidjan',
  '+225 00 00 00 00',
  'contact@ecoltest.ci',
  'https://ecoltest.ci'
) RETURNING id INTO v_school_id;

-- 2. Créer une année académique
INSERT INTO years (school_id, name, start_date, end_date, is_current)
VALUES (
  v_school_id,
  '2025-2026',
  '2025-09-01',
  '2026-07-31',
  true
) RETURNING id INTO v_year_id;

-- 3. Ajouter les utilisateurs (en utilisant les UUIDs depuis auth.users)
-- Note: En production, ces utilisateurs doivent être créés via Supabase Auth d'abord

-- Super Admin (utiliser un UUID connu ou généré)
v_super_admin_id := uuid_generate_v4();
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active)
VALUES (
  v_super_admin_id,
  v_school_id,
  'superadmin@ecoltest.ci',
  'Super Administrateur',
  'SUPER_ADMIN',
  '+225 00 00 00 01',
  true
);

-- Admin
v_admin_id := uuid_generate_v4();
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active)
VALUES (
  v_admin_id,
  v_school_id,
  'admin@ecoltest.ci',
  'Directeur Général',
  'ADMIN',
  '+225 00 00 00 02',
  true
);

-- Secrétaire
v_secretary_id := uuid_generate_v4();
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active)
VALUES (
  v_secretary_id,
  v_school_id,
  'secretary@ecoltest.ci',
  'Secrétaire',
  'SECRETARY',
  '+225 00 00 00 03',
  true
);

-- Comptable
v_accountant_id := uuid_generate_v4();
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active)
VALUES (
  v_accountant_id,
  v_school_id,
  'accountant@ecoltest.ci',
  'Comptable',
  'ACCOUNTANT',
  '+225 00 00 00 04',
  true
);

-- Enseignant
v_teacher_id := uuid_generate_v4();
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active)
VALUES (
  v_teacher_id,
  v_school_id,
  'teacher@ecoltest.ci',
  'Enseignant 1',
  'TEACHER',
  '+225 00 00 00 05',
  true
);

-- Parent
v_parent_id := uuid_generate_v4();
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active)
VALUES (
  v_parent_id,
  v_school_id,
  'parent@ecoltest.ci',
  'Parent 1',
  'PARENT',
  '+225 00 00 00 06',
  true
);

-- 4. Créer une classe
INSERT INTO classes (school_id, year_id, name, level, capacity, room)
VALUES (
  v_school_id,
  v_year_id,
  'CP1 A',
  'CP',
  30,
  'Salle 101'
) RETURNING id INTO v_class_id;

-- 5. Assigner l'enseignant à la classe
INSERT INTO teacher_classes (teacher_id, class_id, subject, is_main_teacher)
VALUES (v_teacher_id, v_class_id, 'Français', true);

-- 6. Créer un élève
INSERT INTO students (school_id, class_id, first_name, last_name, date_of_birth, gender, enrollment_date, status)
VALUES (
  v_school_id,
  v_class_id,
  'Jean',
  'Dupont',
  '2018-05-15',
  'M',
  '2025-09-01',
  'ACTIVE'
) RETURNING id INTO v_student_id;

-- 7. Associer le parent à l'élève
INSERT INTO parents_students (parent_id, student_id, relationship, is_primary_contact, can_pickup)
VALUES (v_parent_id, v_student_id, 'Père', true, true);

-- 8. Créer des frais
INSERT INTO fees (school_id, year_id, name, type, amount, description, is_mandatory)
VALUES
  (v_school_id, v_year_id, 'Scolarité', 'TUITION', 150000, 'Frais de scolarité annuels', true),
  (v_school_id, v_year_id, 'Uniforme', 'UNIFORM', 25000, 'Uniforme scolaire', false),
  (v_school_id, v_year_id, 'Livres', 'BOOKS', 35000, 'Manuels scolaires', false);

-- 9. Créer une facture
INSERT INTO invoices (school_id, student_id, invoice_number, issue_date, due_date, status, subtotal, total, created_by)
VALUES (
  v_school_id,
  v_student_id,
  'INV-2025-00001',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  'SENT',
  210000,
  210000,
  v_secretary_id
);

-- 10. Créer une présence
INSERT INTO attendance (student_id, class_id, date, status, marked_by)
VALUES (
  v_student_id,
  v_class_id,
  CURRENT_DATE,
  'PRESENT',
  v_teacher_id
);

END $$;

-- Vérifier que tout a été inséré
SELECT 'Données de test insérées avec succès!' AS message;
