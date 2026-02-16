-- =====================================================
-- MIGRATION 030: Fix employee creation RLS policy
-- =====================================================
-- Corriger la fonction create_employee_on_user_creation en utilisant SECURITY DEFINER
-- pour contourner les politiques RLS lors de la création automatique d'employés

-- Supprimer le trigger d'abord
DROP TRIGGER IF EXISTS trigger_create_employee_on_user_creation ON users;

-- Recréer la fonction avec SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_employee_on_user_creation()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Si le nouvel utilisateur a un rôle qui nécessite un profil employee
  IF NEW.role IN ('ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY') THEN
    -- Utiliser postgres role pour contourner les politiques RLS
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
$$;

-- Recréer le trigger
CREATE TRIGGER trigger_create_employee_on_user_creation
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_on_user_creation();

-- Commentaire pour documentation
COMMENT ON FUNCTION create_employee_on_user_creation() IS 
'Crée automatiquement un enregistrement employee quand un utilisateur ADMIN, TEACHER, HR, ACCOUNTANT ou SECRETARY est créé. Utilise SECURITY DEFINER pour contourner les politiques RLS.';
