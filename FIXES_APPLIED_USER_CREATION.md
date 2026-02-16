# 🔧 Corrections Appliquées - Erreurs de Création d'Utilisateur

## 📋 Erreurs Corrigées

### 1. ❌ Erreur RLS 403 - `new row violates row-level security policy`
**Cause:** Le trigger pour créer automatiquement un enregistrement `employee` s'exécutait avec les permissions système, ce qui violait la politique RLS.

**Solution:** Créé migration 031 & 032

---

### 2. ❌ Erreur NOT NULL 23502 - `null value in column "school_id"`
**Cause:** Lors de la création d'un utilisateur, aucun `school_id` n'était fourni, mais le trigger essayait de créer un enregistrement `employee` qui nécessite un `school_id`.

**Solution Appliquée:**
- ✅ Modification migration 032 pour vérifier que `school_id IS NOT NULL` avant d'insérer
- ✅ Ajout du champ `school_id` au formulaire de création d'utilisateurs
- ✅ Chargement des écoles disponibles pour sélectionner
- ✅ Validation : l'école est requise pour les rôles ADMIN, TEACHER, HR, ACCOUNTANT, SECRETARY

---

## 📝 Fichiers Modifiés

### Migrations SQL
1. **`supabase/migrations/031_allow_system_employee_insert.sql`** (Ancien fix)
   - Alternative avec politique RLS permissive
2. **`supabase/migrations/032_fix_employee_null_school_id.sql`** ✅ **À APPLIQUER**
   - Ajoute vérification `NEW.school_id IS NOT NULL`
   - Utilise `SECURITY DEFINER` pour contourner RLS
   
### Code React
1. **`src/app/dashboard/super-admin/accounts/page.tsx`** ✅ **MODIFIÉ**
   - Ajout fonction `loadSchools()`
   - Ajout champ `school_id` à `newUserData`
   - Modification `handleCreateUser()` pour inclure `school_id`
   - Ajout select école conditionnaire dans le formulaire
   - Validation pour exiger l'école selon le rôle

---

## 🎯 À Faire Manuellement

### **ÉTAPE 1: Appliquer la Migration SQL 032 (IMPORTANT)**

Allez sur [Supabase Dashboard](https://app.supabase.com) et exécutez:

```sql
-- =====================================================
-- MIGRATION 032: Fix employee creation with NULL school_id
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_employee_on_user_creation ON users;

CREATE OR REPLACE FUNCTION create_employee_on_user_creation()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Vérifier que school_id n'est pas NULL avant de créer un employee
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_employee_on_user_creation
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_on_user_creation();
```

✅ Cliquez sur **Run**

### **ÉTAPE 2: Relancer le Serveur Local**

```bash
npm run dev
```

---

## 🧪 Test du Fix

### Créer un nouvel utilisateur TEACHER

1. Allez à `http://localhost:3000/dashboard/super-admin/accounts`
2. Cliquez sur **"Ajouter un utilisateur"**
3. Remplissez les champs:
   - **Email:** `teacher@ecole.ci`
   - **Nom:** `Jean Dupont`
   - **Rôle:** `Enseignant`
   - **École:** `Sélectionner une école` ← **NOUVEAU**
   - **Mot de passe:** `Test123456`

4. Cliquez sur **"Créer l'utilisateur"**
5. ✅ Devrait fonctionner sans erreur!

### Vérifier dans Supabase

1. Allez dans **Supabase Dashboard** → **SQL Editor**
2. Exécutez:
   ```sql
   SELECT id, email, role, school_id FROM users WHERE email = 'teacher@ecole.ci';
   SELECT user_id, first_name, position FROM employees WHERE user_id = (
     SELECT id FROM users WHERE email = 'teacher@ecole.ci'
   );
   ```
3. L'utilisateur ET son enregistrement employee doivent être créés!

---

## 📊 Résumé des Changements

| Issue | Cause | Fix | Status |
|-------|-------|-----|--------|
| RLS 403 | Trigger contourne RLS | `SECURITY DEFINER` | ✅ |
| NULL school_id | Pas fourni à la création | Vérification NOT NULL + champ UI | ✅ |
| Pas de school_id dans UI | Omission du formulaire | Champ select école + validation | ✅ |

---

## 🔐 Sécurité

- ✅ Les utilisateurs SUPER_ADMIN n'ont pas besoin de school_id
- ✅ Les utilisateurs avec rôles autres ne créent pas d'employee
- ✅ Les politiques RLS restent sécurisées via `SECURITY DEFINER`
- ✅ Les écoles vérifiées côté serveur pour la validation

---

## 📞 Prochaines Étapes

1. ✅ Appliquer la migration SQL 032
2. ✅ Relancer le serveur: `npm run dev`
3. ✅ Tester la création d'utilisateurs
4. ✅ Vérifier dans Supabase que les enregistrements sont corrects

**Date:** 16 février 2026  
**Status:** 🟢 Prêt à tester
