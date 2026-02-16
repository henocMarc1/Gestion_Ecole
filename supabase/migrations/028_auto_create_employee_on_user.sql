-- =====================================================
-- MIGRATION 028: Auto-create employee record on user creation
-- =====================================================
-- Crée automatiquement un enregistrement employee quand un utilisateur
-- avec les rôles ADMIN, TEACHER, HR, ACCOUNTANT ou SECRETARY est inséré dans la table users

-- Fonction pour créer automatiquement un enregistrement employee
CREATE OR REPLACE FUNCTION create_employee_on_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le nouvel utilisateur a un rôle qui nécessite un profil employee
  IF NEW.role IN ('ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY') THEN
    INSERT INTO employees (
      school_id,
      user_id,
      first_name,
      last_name,
      email,
      phone,
      employee_number,
      position,
      employment_type,
      hire_date,
      status
    ) VALUES (
      NEW.school_id,
      NEW.id,
      SPLIT_PART(NEW.full_name, ' ', 1), -- Premier mot = prénom
      COALESCE(NULLIF(SUBSTRING(NEW.full_name, POSITION(' ' IN NEW.full_name) + 1), ''), 'N/A'), -- Reste = nom
      NEW.email,
      NEW.phone,
      'EMP-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(MD5(NEW.id::TEXT), 1, 6), -- Numéro unique
      CASE 
        WHEN NEW.role = 'TEACHER' THEN 'Enseignant'
        WHEN NEW.role = 'HR' THEN 'Responsable RH'
        WHEN NEW.role = 'ACCOUNTANT' THEN 'Comptable'
        WHEN NEW.role = 'SECRETARY' THEN 'Secrétaire'
        WHEN NEW.role = 'ADMIN' THEN 'Directeur'
      END,
      'CDI',
      CURRENT_DATE,
      'active'
    )
    ON CONFLICT DO NOTHING; -- Éviter les doublons
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS trigger_create_employee_on_user_creation ON users;

-- Créer le trigger
CREATE TRIGGER trigger_create_employee_on_user_creation
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_on_user_creation();

-- Commentaire pour documentation
COMMENT ON FUNCTION create_employee_on_user_creation() IS 
'Crée automatiquement un enregistrement employee quand un utilisateur ADMIN, TEACHER, HR, ACCOUNTANT ou SECRETARY est créé';

-- =====================================================
-- MIGRATION DES DONNÉES EXISTANTES
-- =====================================================
-- Pour les utilisateurs existants qui n'ont pas d'enregistrement employee,
-- les créer maintenant:

INSERT INTO employees (
  school_id,
  user_id,
  first_name,
  last_name,
  email,
  phone,
  employee_number,
  position,
  employment_type,
  hire_date,
  status
)
SELECT
  u.school_id,
  u.id,
  SPLIT_PART(u.full_name, ' ', 1),
  COALESCE(NULLIF(SUBSTRING(u.full_name, POSITION(' ' IN u.full_name) + 1), ''), 'N/A'),
  u.email,
  u.phone,
  'EMP-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(MD5(u.id::TEXT), 1, 6),
  CASE 
    WHEN u.role = 'TEACHER' THEN 'Enseignant'
    WHEN u.role = 'HR' THEN 'Responsable RH'
    WHEN u.role = 'ACCOUNTANT' THEN 'Comptable'
    WHEN u.role = 'SECRETARY' THEN 'Secrétaire'
    WHEN u.role = 'ADMIN' THEN 'Directeur'
  END,
  'CDI',
  CURRENT_DATE,
  'active'
FROM users u
WHERE u.role IN ('ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY')
  AND u.id NOT IN (SELECT user_id FROM employees WHERE user_id IS NOT NULL)
  AND u.school_id IS NOT NULL
ON CONFLICT (school_id, employee_number) DO NOTHING;

-- =====================================================
-- VÉRIFICATION
-- =====================================================
SELECT 'Vérification: Utilisateurs sans enregistrement employee' AS check_type;
SELECT u.id, u.full_name, u.role, u.email
FROM users u
WHERE u.id NOT IN (SELECT COALESCE(user_id, uuid_nil()) FROM employees)
  AND u.role IN ('ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY')
LIMIT 10;

SELECT 'Enregistrements employees créés' AS check_type;
SELECT COUNT(*) as total_employees FROM employees;
