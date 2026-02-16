-- =====================================================
-- SEED DATA - DONNÉES DE TEST RBAC
-- =====================================================
-- Jeu de données pour tester les politiques RLS et 
-- les redirections par rôle. Mot de passe test: Test123456!
-- =====================================================

-- Nettoyer les données existantes (ordre inverse des dépendances)
DELETE FROM messages WHERE school_id IS NOT NULL;
DELETE FROM attendance;
DELETE FROM invoice_items;
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM fees;
DELETE FROM parents_students;
DELETE FROM students;
DELETE FROM teacher_classes;
DELETE FROM classes;
DELETE FROM years;
DELETE FROM users WHERE school_id IS NOT NULL OR role = 'SUPER_ADMIN';
DELETE FROM schools;

-- =====================================================
-- 1. ÉCOLE PRINCIPALE
-- =====================================================
INSERT INTO schools (id, name, code, address, phone, email, is_active) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'École Primaire Moderne',
  'EPM-001',
  'Cocody, Abidjan, Côte d''Ivoire',
  '+225 27 22 45 67 89',
  'contact@ecole-moderne.ci',
  true
);

-- =====================================================
-- 2. ANNÉE SCOLAIRE
-- =====================================================
INSERT INTO years (id, school_id, name, start_date, end_date, is_current) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '2025-2026',
  '2025-09-01',
  '2026-06-30',
  true
);

-- =====================================================
-- 3. UTILISATEURS PAR RÔLE
-- =====================================================
-- IMPORTANT: Ces UUID doivent être créés manuellement dans Supabase Auth 
-- avant de lancer ce seed, ou via script de migration Auth.

-- Super Admin (pas de school_id)
INSERT INTO users (id, school_id, email, full_name, role, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000001',
  NULL,
  'superadmin@ecole.ci',
  'Super Admin Global',
  'SUPER_ADMIN',
  true
);

-- Admin École
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'admin@ecole-moderne.ci',
  'Directeur Principal',
  'ADMIN',
  '+225 07 11 11 11 11',
  true
);

-- Responsable RH
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000001',
  'rh@ecole-moderne.ci',
  'Responsable Ressources Humaines',
  'HR',
  '+225 07 99 99 99 99',
  true
);

-- Secrétaire
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'secretaire@ecole-moderne.ci',
  'Secrétaire Scolaire',
  'SECRETARY',
  '+225 07 22 22 22 22',
  true
);

-- Comptable
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'comptable@ecole-moderne.ci',
  'Comptable Finance',
  'ACCOUNTANT',
  '+225 07 33 33 33 33',
  true
);

-- Enseignant 1 (CP1)
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'enseignant.cp1@ecole-moderne.ci',
  'Enseignant CP1',
  'TEACHER',
  '+225 07 44 44 44 44',
  true
);

-- Enseignant 2 (CE2)
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  'enseignant.ce2@ecole-moderne.ci',
  'Enseignant CE2',
  'TEACHER',
  '+225 07 55 55 55 55',
  true
);

-- Parent 1
INSERT INTO users (id, school_id, email, full_name, role, phone, address, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000001',
  'parent1@gmail.com',
  'Parent Famille A',
  'PARENT',
  '+225 05 11 11 11 11',
  'Marcory, Abidjan',
  true
);

-- Parent 2
INSERT INTO users (id, school_id, email, full_name, role, phone, address, is_active) VALUES
(
  'a0000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000001',
  'parent2@gmail.com',
  'Parent Famille B',
  'PARENT',
  '+225 05 22 22 22 22',
  'Yopougon, Abidjan',
  true
);

-- =====================================================
-- 4. CLASSES
-- =====================================================
INSERT INTO classes (id, school_id, year_id, name, level, capacity, room) VALUES
(
  'c0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'CP1 A',
  'CP',
  25,
  'Salle 101'
),
(
  'c0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'CE2 B',
  'CE2',
  30,
  'Salle 202'
);

-- =====================================================
-- 5. AFFECTATION ENSEIGNANTS
-- =====================================================
INSERT INTO teacher_classes (teacher_id, class_id, is_main_teacher) VALUES
('a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', true),
('a0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', true);

-- =====================================================
-- 6. ÉLÈVES
-- =====================================================
-- Classe CP1 A
INSERT INTO students (id, school_id, class_id, first_name, last_name, date_of_birth, gender, registration_number, status) VALUES
(
  's0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Jean',
  'Kouassi',
  '2018-05-10',
  'M',
  'EPM-2025-001',
  'ACTIVE'
),
(
  's0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Marie',
  'Kouassi',
  '2019-03-15',
  'F',
  'EPM-2025-002',
  'ACTIVE'
);

-- Classe CE2 B
INSERT INTO students (id, school_id, class_id, first_name, last_name, date_of_birth, gender, registration_number, status) VALUES
(
  's0000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'Paul',
  'Traoré',
  '2016-08-20',
  'M',
  'EPM-2025-003',
  'ACTIVE'
),
(
  's0000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'Sophie',
  'Traoré',
  '2016-12-05',
  'F',
  'EPM-2025-004',
  'ACTIVE'
);

-- =====================================================
-- 7. LIENS PARENTS-ÉLÈVES
-- =====================================================
INSERT INTO parents_students (parent_id, student_id, relationship, is_primary_contact) VALUES
('a0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000001', 'Père', true),
('a0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000002', 'Père', true),
('a0000000-0000-0000-0000-000000000008', 's0000000-0000-0000-0000-000000000003', 'Mère', true),
('a0000000-0000-0000-0000-000000000008', 's0000000-0000-0000-0000-000000000004', 'Mère', true);

-- =====================================================
-- 8. FRAIS DE SCOLARITÉ
-- =====================================================
INSERT INTO fees (id, school_id, year_id, name, type, amount, applicable_to, due_date, is_mandatory) VALUES
(
  'f0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Inscription 2025-2026',
  'REGISTRATION',
  50000.00,
  'ALL',
  '2025-09-15',
  true
),
(
  'f0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Scolarité Trimestre 1',
  'TUITION',
  150000.00,
  'ALL',
  '2025-10-31',
  true
);

-- =====================================================
-- 9. FACTURES
-- =====================================================
INSERT INTO invoices (id, school_id, student_id, invoice_number, issue_date, due_date, status, subtotal, total, created_by) VALUES
(
  'i0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  's0000000-0000-0000-0000-000000000001',
  'INV-2025-00001',
  '2025-09-01',
  '2025-09-30',
  'SENT',
  200000.00,
  200000.00,
  'a0000000-0000-0000-0000-000000000004'
),
(
  'i0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  's0000000-0000-0000-0000-000000000003',
  'INV-2025-00002',
  '2025-09-01',
  '2025-09-30',
  'PAID',
  200000.00,
  200000.00,
  'a0000000-0000-0000-0000-000000000004'
);

-- =====================================================
-- 10. LIGNES DE FACTURES
-- =====================================================
INSERT INTO invoice_items (invoice_id, fee_id, description, quantity, unit_price, total) VALUES
('i0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Inscription', 1, 50000.00, 50000.00),
('i0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'Scolarité T1', 1, 150000.00, 150000.00),
('i0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Inscription', 1, 50000.00, 50000.00),
('i0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Scolarité T1', 1, 150000.00, 150000.00);

-- =====================================================
-- 11. PAIEMENTS
-- =====================================================
INSERT INTO payments (id, school_id, invoice_id, student_id, payment_number, amount, payment_method, payment_date, status, received_by) VALUES
(
  'p0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'i0000000-0000-0000-0000-000000000002',
  's0000000-0000-0000-0000-000000000003',
  'PAY-2025-00001',
  200000.00,
  'MOBILE_MONEY',
  '2025-09-05',
  'COMPLETED',
  'a0000000-0000-0000-0000-000000000004'
);

-- =====================================================
-- 12. PRÉSENCES (2 jours)
-- =====================================================
INSERT INTO attendance (student_id, class_id, date, status, marked_by) VALUES
-- Aujourd'hui CP1
('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', CURRENT_DATE, 'PRESENT', 'a0000000-0000-0000-0000-000000000005'),
('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', CURRENT_DATE, 'LATE', 'a0000000-0000-0000-0000-000000000005'),
-- Aujourd'hui CE2
('s0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', CURRENT_DATE, 'PRESENT', 'a0000000-0000-0000-0000-000000000006'),
('s0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', CURRENT_DATE, 'ABSENT', 'a0000000-0000-0000-0000-000000000006'),
-- Hier CP1
('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', CURRENT_DATE - 1, 'PRESENT', 'a0000000-0000-0000-0000-000000000005'),
('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', CURRENT_DATE - 1, 'PRESENT', 'a0000000-0000-0000-0000-000000000005');

-- =====================================================
-- FIN - Résumé du seed
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED DATA LOADED - COMPTES DE TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email: superadmin@ecole.ci (SUPER_ADMIN)';
  RAISE NOTICE 'Email: admin@ecole-moderne.ci (ADMIN)';
  RAISE NOTICE 'Email: rh@ecole-moderne.ci (HR)';
  RAISE NOTICE 'Email: secretaire@ecole-moderne.ci (SECRETARY)';
  RAISE NOTICE 'Email: comptable@ecole-moderne.ci (ACCOUNTANT)';
  RAISE NOTICE 'Email: enseignant.cp1@ecole-moderne.ci (TEACHER CP1)';
  RAISE NOTICE 'Email: enseignant.ce2@ecole-moderne.ci (TEACHER CE2)';
  RAISE NOTICE 'Email: parent1@gmail.com (PARENT Famille A)';
  RAISE NOTICE 'Email: parent2@gmail.com (PARENT Famille B)';
  RAISE NOTICE 'Mot de passe pour tous: Test123456!';
  RAISE NOTICE '========================================';
END $$;
