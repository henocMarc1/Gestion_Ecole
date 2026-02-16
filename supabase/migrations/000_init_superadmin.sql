-- Initialiser le compte SuperAdmin
-- À exécuter AVANT les autres migrations

-- Insérer le Super Admin
INSERT INTO users (
  id,
  email,
  full_name,
  role,
  is_active,
  must_change_password,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'superadmin@ecole.ci',
  'Super Administrateur',
  'SUPER_ADMIN',
  true,
  false,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Message de confirmation
DO $$ BEGIN
  RAISE NOTICE 'Super Admin créé/mis à jour: superadmin@ecole.ci (Mot de passe: Test123456!)';
END $$;
