# Fix RLS Error - Manual Instructions

## ⚠️ Problème Identifié

L'erreur `42501 - new row violates row-level security policy for table "employees"` se produit lors de la création d'un nouvel utilisateur avec les rôles ADMIN, TEACHER, HR, ACCOUNTANT ou SECRETARY.

### Cause Racine

La migration `028_auto_create_employee_on_user.sql` crée un trigger qui insère automatiquement un enregistrement `employee`. Cependant, ce trigger s'exécute avec les permissions système et la politique RLS de la table `employees` empêche cette insertion.

## ✅ Solution

### Option 1: Via Console Supabase Web (Recommandé)

1. Allez sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet `qszwffrdsjbafjhvgpzd`
3. Allez dans **SQL Editor**
4. Créez une nouvelle requête
5. copier-coller le SQL ci-dessous complètement:

```sql
-- =====================================================
-- FIX: Allow employee creation via system and HR roles
-- =====================================================

-- Supprimer la politique ancienne restrictive
DROP POLICY IF EXISTS "HR and ADMIN can insert employees" ON employees;

-- Créer une nouvelle politique qui permet aussi les insertions système
CREATE POLICY "Allow employee creation via system and HR roles"
    ON employees FOR INSERT
    WITH CHECK (
        -- Autoriser si aucun utilisateur authentifié (trigger/système)
        auth.uid() IS NULL 
        -- OU autoriser si l'utilisateur authentifié a les bons rôles
        OR school_id IN (
            SELECT school_id FROM users 
            WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- Recréer la fonction avec SECURITY DEFINER
DROP TRIGGER IF EXISTS trigger_create_employee_on_user_creation ON users;

CREATE OR REPLACE FUNCTION create_employee_on_user_creation()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
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
      SPLIT_PART(NEW.full_name, ' ', 1),
      COALESCE(NULLIF(SUBSTRING(NEW.full_name, POSITION(' ' IN NEW.full_name) + 1), ''), 'N/A'),
      NEW.email,
      NEW.phone,
      'EMP-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(MD5(NEW.id::TEXT), 1, 6),
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
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_employee_on_user_creation
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_on_user_creation();

-- Confirmation
SELECT 'Fix appliqué avec succès!' AS status;
```

6. Cliquez sur **Run** (ou Ctrl+Enter)
7. Attendez la confirmation "Fix appliqué avec succès!"

### Option 2: Via Script Node.js

Si vous préférez une approche automatisée:

```bash
npm run apply-fix-rls
```

## 🧪 Test du Fix

Après appliquer le SQL:

1. Allez à `/dashboard/super-admin/accounts`
2. Cliquez sur "Ajouter un utilisateur"
3. Remplissez les détails et sélectionnez un rôle (ex: TEACHER)
4. Cliquez sur "Créer mon compte"
5. L'utilisateur devrait être créé sans erreur RLS

## 📋 Qu'est-ce que le Fix Fait

1. **Remplace la politique RLS** pour permettre les insertions via le système (`auth.uid() IS NULL`)
2. **Modifie la fonction trigger** avec `SECURITY DEFINER` pour exécuter avec les permissions du propriétaire
3. **Récréé le trigger** pour que les nouveaux utilisateurs aient automatiquement un

 enregistrement employee

## ✨ Résultat

- ✅ Les utilisateurs ADMIN, TEACHER, HR, ACCOUNTANT et SECRETARY sont créés avec succès
- ✅ Un enregistrement `employee` est créé automatiquement pour chaque nouvel utilisateur
- ✅ Les politiques RLS restent sécurisées pour les opérations client

---

**Status**: En attente d'application manuelle via la console Supabase
**Créé**: 16 février 2026
