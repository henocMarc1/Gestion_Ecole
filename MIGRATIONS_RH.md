# Instructions pour appliquer les migrations RH

## ⚠️ Important: Migrations à appliquer sur Supabase

Le rôle HR a été créé mais les migrations SQL doivent être exécutées sur Supabase pour que le système fonctionne.

## Étapes d'application:

### 1. Se connecter à Supabase
1. Allez sur [supabase.com](https://supabase.com)
2. Ouvrez votre projet: `eukkzsbmsyxgklzzhiej`
3. Cliquez sur **SQL Editor** dans le menu de gauche

### 2. Exécuter les migrations dans l'ordre

#### Migration 005: Ajouter le rôle HR
```sql
-- Copiez et collez le contenu de:
-- supabase/migrations/005_add_hr_role.sql
```

Exécutez cette migration en premier. Elle va:
- Ajouter 'HR' à l'enum user_role
- Créer la fonction `auth.is_hr()`
- Mettre à jour `auth.is_school_admin()` pour inclure HR

#### Migration 006: Politiques RLS pour HR
```sql
-- Copiez et collez le contenu de:
-- supabase/migrations/006_rls_hr_policies.sql
```

Exécutez cette migration en second. Elle va:
- Ajouter les politiques RLS pour que HR puisse gérer le personnel
- Permettre HR de voir/gérer les affectations de classes
- Permettre HR de gérer les présences
- Restreindre l'accès de HR aux finances

### 3. Ajouter l'utilisateur RH de test (optionnel)
```sql
-- Copiez et collez la section "Responsable RH" de:
-- supabase/seeds/002_rbac_test_data.sql

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
```

⚠️ **Note**: L'UUID `a0000000-0000-0000-0000-000000000009` doit d'abord être créé dans Supabase Auth avec:
- Email: rh@ecole-moderne.ci
- Mot de passe: Test123456!

### 4. Vérifier l'application
Après avoir appliqué les migrations:

1. Connectez-vous avec le compte RH:
   - Email: `rh@ecole-moderne.ci`
   - Mot de passe: `Test123456!`

2. Vérifiez que vous êtes redirigé vers `/dashboard/hr`

3. Testez les fonctionnalités:
   - ✅ Voir la liste du personnel
   - ✅ Voir les affectations de classes
   - ❌ Ne peut pas accéder aux finances

## Résolution des problèmes

### Erreur: "enum user_role already exists"
Si vous avez déjà un enum user_role, vous devez le supprimer d'abord:
```sql
-- Attention: cela va supprimer toutes les données utilisateurs!
DROP TYPE user_role CASCADE;
```
Puis réappliquez toutes les migrations depuis le début.

### Erreur: "policy already exists"
Supprimez les anciennes politiques:
```sql
DROP POLICY IF EXISTS "users_select_hr_staff" ON users;
DROP POLICY IF EXISTS "users_insert_hr" ON users;
-- etc.
```

## État actuel

- ✅ Code frontend créé
- ✅ Migrations SQL créées
- ✅ Seed data préparé
- ❌ Migrations non appliquées sur Supabase
- ❌ Compte RH de test non créé dans Auth

Une fois les migrations appliquées, le système sera 100% opérationnel pour le rôle HR.
