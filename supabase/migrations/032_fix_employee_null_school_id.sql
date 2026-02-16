-- =====================================================
-- MIGRATION 032: Fix employee creation with NULL school_id
-- =====================================================
-- Vérifie que school_id n'est pas NULL avant de créer un enregistrement employee

DROP TRIGGER IF EXISTS trigger_create_employee_on_user_creation ON users;

CREATE OR REPLACE FUNCTION create_employee_on_user_creation()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Si le nouvel utilisateur a un rôle qui nécessite un profil employee
  -- ET possède un school_id valide (les super admins n'en ont pas)
  IF NEW.role IN ('ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY') 
     AND NEW.school_id IS NOT NULL THEN
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

-- Créer le trigger
CREATE TRIGGER trigger_create_employee_on_user_creation
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_on_user_creation();

-- Commentaire pour documentation
COMMENT ON FUNCTION create_employee_on_user_creation() IS 
'Crée automatiquement un enregistrement employee pour les rôles ADMIN, TEACHER, HR, ACCOUNTANT et SECRETARY seulement (et seulement si school_id est fourni)';
