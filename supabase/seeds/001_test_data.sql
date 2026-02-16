-- =====================================================
-- SEED DATA - DONNÉES DE TEST
-- =====================================================
-- Données initiales pour développement et tests
-- Comptes test: passwords = "Test123456!"
-- =====================================================

-- Note: Les mots de passe doivent être créés via Supabase Auth
-- Ce fichier crée les données après que les comptes Auth soient créés

-- =====================================================
-- 1. CRÉER UNE ÉCOLE DE TEST
-- =====================================================
INSERT INTO schools (id, name, code, address, phone, email, is_active, settings) VALUES
(
  '550e8400-e29b-41d4-a716-446655440000',
  'École Primaire Les Étoiles',
  'EPE-2025',
  'Cocody, Rue des Jardins, Abidjan, Côte d''Ivoire',
  '+225 27 22 45 67 89',
  'contact@ecole-etoiles.ci',
  true,
  '{
    "timezone": "Africa/Abidjan",
    "currency": "XOF",
    "language": "fr",
    "academic_year_start_month": 9
  }'::jsonb
);

-- =====================================================
-- 2. ANNÉE SCOLAIRE EN COURS
-- =====================================================
INSERT INTO years (id, school_id, name, start_date, end_date, is_current) VALUES
(
  '660e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  '2025-2026',
  '2025-09-01',
  '2026-06-30',
  true
);

-- =====================================================
-- 3. UTILISATEURS
-- =====================================================
-- Note: Ces IDs doivent correspondre aux IDs créés dans Supabase Auth
-- Pour la démo, utiliser ces UUID spécifiques lors de la création des comptes

-- Super Admin
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active, must_change_password) VALUES
(
  '12f53071-db4f-4019-857c-ad35bc3c59f9',
  NULL, -- Super Admin n'est lié à aucune école spécifique
  'superadmin@ecole.ci',
  'Kouassi Administrateur',
  'SUPER_ADMIN',
  '+225 07 01 02 03 04',
  true,
  false
);

-- Admin de l'école
INSERT INTO users (id, school_id, email, full_name, role, phone, address, is_active) VALUES
(
  '12f53071-db4f-4019-857c-ad35bc3c59f9',
  '550e8400-e29b-41d4-a716-446655440000',
  'admin@ecole-etoiles.ci',
  'Amani Koné',
  'ADMIN',
  '+225 07 11 22 33 44',
  'Cocody, Abidjan',
  true
);

-- Comptable
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  '869ca049-be58-4681-bb33-8370facd18cf869ca049-be58-4681-bb33-8370facd18cf',
  '550e8400-e29b-41d4-a716-446655440000',
  'comptable@ecole-etoiles.ci',
  'Fatou Traoré',
  'ACCOUNTANT',
  '+225 07 22 33 44 55',
  true
);

-- Secrétaire
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  '202825d7-75d9-488f-a34c-8b6e53905dc1',
  '550e8400-e29b-41d4-a716-446655440000',
  'secretaire@ecole-etoiles.ci',
  'Aïcha Bamba',
  'SECRETARY',
  '+225 07 33 44 55 66',
  true
);

-- Enseignant 1 (CP1)
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  'enseignant1@ecole-etoiles.ci',
  '550e8400-e29b-41d4-a716-446655440000',
  'enseignant1@ecole-etoiles.ci',
  'Jean-Baptiste Ouattara',
  'TEACHER',
  '+225 07 44 55 66 77',
  true
);

-- Enseignant 2 (CE2)
INSERT INTO users (id, school_id, email, full_name, role, phone, is_active) VALUES
(
  '80928b56-d3da-4a62-9233-0db8b13542a0',
  '550e8400-e29b-41d4-a716-446655440000',
  'enseignant2@ecole-etoiles.ci',
  'Marie-Claire Diaby',
  'TEACHER',
  '+225 07 55 66 77 88',
  true
);

-- Parent 1 (Yao)
INSERT INTO users (id, school_id, email, full_name, role, phone, address, is_active) VALUES
(
  '011a6cdb-fd6c-4ddd-ad9d-01f880f1811c',
  '550e8400-e29b-41d4-a716-446655440000',
  'parent.yao@gmail.com',
  'Ibrahim Yao',
  'PARENT',
  '+225 05 11 22 33 44',
  'Marcory, Abidjan',
  true
);

-- Parent 2 (Sékou)
INSERT INTO users (id, school_id, email, full_name, role, phone, address, is_active) VALUES
(
  '8a2ec90d-e6cb-46df-a04d-abf738e55559',
  '550e8400-e29b-41d4-a716-446655440000',
  'parent.sekou@yahoo.fr',
  'Mariam Sékou',
  'PARENT',
  '+225 05 22 33 44 55',
  'Yopougon, Abidjan',
  true
);

-- Parent 3 (Konan)
INSERT INTO users (id, school_id, email, full_name, role, phone, address, is_active) VALUES
(
  'a7205530-412b-4eff-9657-86fa204f8649',
  '550e8400-e29b-41d4-a716-446655440000',
  'parent.konan@outlook.com',
  'Aya Konan',
  'PARENT',
  '+225 05 33 44 55 66',
  'Abobo, Abidjan',
  true
);

-- =====================================================
-- 4. CLASSES
-- =====================================================
INSERT INTO classes (id, school_id, year_id, name, level, capacity, room) VALUES
(
  'c1111111-1111-1111-1111-111111111111',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'CP1 A',
  'CP',
  25,
  'Salle 101'
),
(
  'c2222222-2222-2222-2222-222222222222',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'CE2 B',
  'CE2',
  30,
  'Salle 203'
),
(
  'c3333333-3333-3333-3333-333333333333',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'CM1 A',
  'CM1',
  28,
  'Salle 301'
);

-- =====================================================
-- 5. ASSOCIATION ENSEIGNANTS-CLASSES
-- =====================================================
INSERT INTO teacher_classes (teacher_id, class_id, subject, is_main_teacher) VALUES
('55555555-5555-5555-5555-555555555555', 'c1111111-1111-1111-1111-111111111111', NULL, true),
('66666666-6666-6666-6666-666666666666', 'c2222222-2222-2222-2222-222222222222', NULL, true);

-- =====================================================
-- 6. ÉLÈVES
-- =====================================================
INSERT INTO students (id, school_id, class_id, first_name, last_name, date_of_birth, gender, registration_number, nationality, status) VALUES
-- Classe CP1 A
(
  's1111111-1111-1111-1111-111111111111',
  '550e8400-e29b-41d4-a716-446655440000',
  'c1111111-1111-1111-1111-111111111111',
  'Kouadio',
  'Yao',
  '2018-03-15',
  'M',
  'EPE-2025-001',
  'Ivoirienne',
  'ACTIVE'
),
(
  's2222222-2222-2222-2222-222222222222',
  '550e8400-e29b-41d4-a716-446655440000',
  'c1111111-1111-1111-1111-111111111111',
  'Amenan',
  'Yao',
  '2019-07-22',
  'F',
  'EPE-2025-002',
  'Ivoirienne',
  'ACTIVE'
),
(
  's3333333-3333-3333-3333-333333333333',
  '550e8400-e29b-41d4-a716-446655440000',
  'c1111111-1111-1111-1111-111111111111',
  'Mamadou',
  'Sékou',
  '2018-11-08',
  'M',
  'EPE-2025-003',
  'Ivoirienne',
  'ACTIVE'
),
(
  's4444444-4444-4444-4444-444444444444',
  '550e8400-e29b-41d4-a716-446655440000',
  'c1111111-1111-1111-1111-111111111111',
  'Fatoumata',
  'Sékou',
  '2018-05-30',
  'F',
  'EPE-2025-004',
  'Ivoirienne',
  'ACTIVE'
),

-- Classe CE2 B
(
  's5555555-5555-5555-5555-555555555555',
  '550e8400-e29b-41d4-a716-446655440000',
  'c2222222-2222-2222-2222-222222222222',
  'Adjoua',
  'Konan',
  '2016-09-12',
  'F',
  'EPE-2025-005',
  'Ivoirienne',
  'ACTIVE'
),
(
  's6666666-6666-6666-6666-666666666666',
  '550e8400-e29b-41d4-a716-446655440000',
  'c2222222-2222-2222-2222-222222222222',
  'N''Guessan',
  'Konan',
  '2015-12-25',
  'M',
  'EPE-2025-006',
  'Ivoirienne',
  'ACTIVE'
),
(
  's7777777-7777-7777-7777-777777777777',
  '550e8400-e29b-41d4-a716-446655440000',
  'c2222222-2222-2222-2222-222222222222',
  'Abou',
  'Diallo',
  '2016-04-18',
  'M',
  'EPE-2025-007',
  'Ivoirienne',
  'ACTIVE'
),
(
  's8888888-8888-8888-8888-888888888888',
  '550e8400-e29b-41d4-a716-446655440000',
  'c2222222-2222-2222-2222-222222222222',
  'Mariama',
  'Touré',
  '2016-01-05',
  'F',
  'EPE-2025-008',
  'Ivoirienne',
  'ACTIVE'
),

-- Classe CM1 A
(
  's9999999-9999-9999-9999-999999999999',
  '550e8400-e29b-41d4-a716-446655440000',
  'c3333333-3333-3333-3333-333333333333',
  'Koffi',
  'Brou',
  '2014-08-20',
  'M',
  'EPE-2025-009',
  'Ivoirienne',
  'ACTIVE'
),
(
  's0000000-0000-0000-0000-000000000000',
  '550e8400-e29b-41d4-a716-446655440000',
  'c3333333-3333-3333-3333-333333333333',
  'Akissi',
  'N''Dri',
  '2015-02-14',
  'F',
  'EPE-2025-010',
  'Ivoirienne',
  'ACTIVE'
);

-- =====================================================
-- 7. ASSOCIATION PARENTS-ÉLÈVES
-- =====================================================
INSERT INTO parents_students (parent_id, student_id, relationship, is_primary_contact) VALUES
-- Parent Yao avec ses 2 enfants
('77777777-7777-7777-7777-777777777777', 's1111111-1111-1111-1111-111111111111', 'Père', true),
('77777777-7777-7777-7777-777777777777', 's2222222-2222-2222-2222-222222222222', 'Père', true),

-- Parent Sékou avec ses 2 enfants
('88888888-8888-8888-8888-888888888888', 's3333333-3333-3333-3333-333333333333', 'Mère', true),
('88888888-8888-8888-8888-888888888888', 's4444444-4444-4444-4444-444444444444', 'Mère', true),

-- Parent Konan avec ses 2 enfants
('99999999-9999-9999-9999-999999999999', 's5555555-5555-5555-5555-555555555555', 'Mère', true),
('99999999-9999-9999-9999-999999999999', 's6666666-6666-6666-6666-666666666666', 'Mère', true);

-- =====================================================
-- 8. FRAIS DE SCOLARITÉ
-- =====================================================
INSERT INTO fees (id, school_id, year_id, name, description, type, amount, applicable_to, due_date, is_mandatory) VALUES
(
  'f1111111-1111-1111-1111-111111111111',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'Frais de scolarité - 1er trimestre',
  'Frais de scolarité pour le premier trimestre 2025-2026',
  'TUITION',
  150000.00,
  'ALL',
  '2025-10-31',
  true
),
(
  'f2222222-2222-2222-2222-222222222222',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'Frais d''inscription',
  'Frais d''inscription annuelle',
  'REGISTRATION',
  50000.00,
  'ALL',
  '2025-09-15',
  true
),
(
  'f3333333-3333-3333-3333-333333333333',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'Uniforme scolaire',
  'Kit uniforme complet',
  'UNIFORM',
  35000.00,
  'ALL',
  '2025-09-15',
  false
),
(
  'f4444444-4444-4444-4444-444444444444',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'Fournitures scolaires',
  'Kit de fournitures',
  'BOOKS',
  25000.00,
  'ALL',
  '2025-09-30',
  true
);

-- =====================================================
-- 9. FACTURES EXEMPLES
-- =====================================================
INSERT INTO invoices (id, school_id, student_id, invoice_number, issue_date, due_date, status, subtotal, total, created_by) VALUES
(
  'i1111111-1111-1111-1111-111111111111',
  '550e8400-e29b-41d4-a716-446655440000',
  's1111111-1111-1111-1111-111111111111',
  'INV-2025-00001',
  '2025-09-01',
  '2025-09-30',
  'PAID',
  225000.00,
  225000.00,
  '33333333-3333-3333-3333-333333333333'
),
(
  'i2222222-2222-2222-2222-222222222222',
  '550e8400-e29b-41d4-a716-446655440000',
  's3333333-3333-3333-3333-333333333333',
  'INV-2025-00002',
  '2025-09-01',
  '2025-09-30',
  'SENT',
  225000.00,
  225000.00,
  '33333333-3333-3333-3333-333333333333'
);

-- =====================================================
-- 10. LIGNES DE FACTURES
-- =====================================================
INSERT INTO invoice_items (invoice_id, fee_id, description, quantity, unit_price, total) VALUES
-- Facture 1 (Élève Kouadio Yao)
('i1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222', 'Frais d''inscription', 1, 50000.00, 50000.00),
('i1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'Frais de scolarité - 1er trimestre', 1, 150000.00, 150000.00),
('i1111111-1111-1111-1111-111111111111', 'f4444444-4444-4444-4444-444444444444', 'Fournitures scolaires', 1, 25000.00, 25000.00),

-- Facture 2 (Élève Mamadou Sékou)
('i2222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', 'Frais d''inscription', 1, 50000.00, 50000.00),
('i2222222-2222-2222-2222-222222222222', 'f1111111-1111-1111-1111-111111111111', 'Frais de scolarité - 1er trimestre', 1, 150000.00, 150000.00),
('i2222222-2222-2222-2222-222222222222', 'f4444444-4444-4444-4444-444444444444', 'Fournitures scolaires', 1, 25000.00, 25000.00);

-- =====================================================
-- 11. PAIEMENTS
-- =====================================================
INSERT INTO payments (id, school_id, invoice_id, student_id, payment_number, amount, payment_method, payment_date, status, received_by) VALUES
(
  'p1111111-1111-1111-1111-111111111111',
  '550e8400-e29b-41d4-a716-446655440000',
  'i1111111-1111-1111-1111-111111111111',
  's1111111-1111-1111-1111-111111111111',
  'PAY-2025-00001',
  225000.00,
  'MOBILE_MONEY',
  '2025-09-05',
  'COMPLETED',
  '33333333-3333-3333-3333-333333333333'
);

-- =====================================================
-- 12. PRÉSENCES (derniers 7 jours pour la classe CP1 A)
-- =====================================================
-- Présences pour aujourd'hui
INSERT INTO attendance (student_id, class_id, date, status, marked_by) VALUES
('s1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE, 'PRESENT', '55555555-5555-5555-5555-555555555555'),
('s2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE, 'PRESENT', '55555555-5555-5555-5555-555555555555'),
('s3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE, 'LATE', '55555555-5555-5555-5555-555555555555'),
('s4444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE, 'PRESENT', '55555555-5555-5555-5555-555555555555');

-- Présences hier
INSERT INTO attendance (student_id, class_id, date, status, marked_by) VALUES
('s1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', '55555555-5555-5555-5555-555555555555'),
('s2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 'ABSENT', '55555555-5555-5555-5555-555555555555'),
('s3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', '55555555-5555-5555-5555-555555555555'),
('s4444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 'EXCUSED', '55555555-5555-5555-5555-555555555555');

-- =====================================================
-- 13. MESSAGES DE BIENVENUE
-- =====================================================
INSERT INTO messages (school_id, sender_id, recipient_id, subject, body, status) VALUES
(
  '550e8400-e29b-41d4-a716-446655440000',
  '22222222-2222-2222-2222-222222222222',
  '77777777-7777-7777-7777-777777777777',
  'Bienvenue à l''École Les Étoiles',
  'Cher parent, nous sommes ravis d''accueillir vos enfants Kouadio et Amenan dans notre établissement pour l''année scolaire 2025-2026. N''hésitez pas à nous contacter pour toute question.',
  'SENT'
);

-- =====================================================
-- FIN DU SEED
-- =====================================================

-- Afficher un résumé
DO $$
DECLARE
  school_count INT;
  user_count INT;
  student_count INT;
  class_count INT;
BEGIN
  SELECT COUNT(*) INTO school_count FROM schools WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO user_count FROM users WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO student_count FROM students WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO class_count FROM classes WHERE deleted_at IS NULL;
  
  RAISE NOTICE '======================================';
  RAISE NOTICE 'SEED DATA CRÉÉES AVEC SUCCÈS';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Écoles: %', school_count;
  RAISE NOTICE 'Utilisateurs: %', user_count;
  RAISE NOTICE 'Élèves: %', student_count;
  RAISE NOTICE 'Classes: %', class_count;
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Comptes de test (password: Test123456!)';
  RAISE NOTICE '- Super Admin: superadmin@ecole.ci';
  RAISE NOTICE '- Admin: admin@ecole-etoiles.ci';
  RAISE NOTICE '- Comptable: comptable@ecole-etoiles.ci';
  RAISE NOTICE '- Enseignant 1: enseignant1@ecole-etoiles.ci';
  RAISE NOTICE '- Enseignant 2: enseignant2@ecole-etoiles.ci';
  RAISE NOTICE '- Parent 1: parent.yao@gmail.com';
  RAISE NOTICE '- Parent 2: parent.sekou@yahoo.fr';
  RAISE NOTICE '- Parent 3: parent.konan@outlook.com';
  RAISE NOTICE '======================================';
END $$;
