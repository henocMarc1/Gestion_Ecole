# Guide d'Application des Migrations

## 🚨 ACTION IMMÉDIATE REQUISE

**Erreur actuelle:** `invalid input value for enum user_role: "HR"`

**Cause:** Le type enum `user_role` dans PostgreSQL ne contient pas encore la valeur "HR"

**Solution:** Appliquer la migration **005_add_hr_role.sql** dans Supabase SQL Editor

**Temps estimé:** 2 minutes

### Démarrage Rapide

1. Allez sur [supabase.co](https://supabase.co)
2. Connectez-vous → Sélectionnez votre projet
3. **SQL Editor** (dans le menu de gauche)
4. **New query**
5. Copiez-collez le contenu de `supabase/migrations/005_add_hr_role.sql`
6. **Run** (ou Ctrl+Enter)
7. ✅ Le rôle HR sera disponible immédiatement

---

## Migrations à Appliquer (URGENT)

### ⚠️ Migration 005: Ajouter le rôle HR à l'enum (CRITIQUE)
**Fichier:** `supabase/migrations/005_add_hr_role.sql`

**Impact:** Ajoute "HR" au type enum `user_role` pour permettre la création d'utilisateurs RH

**ERREUR ACTUELLE:** `invalid input value for enum user_role: "HR"`

**Étapes:**
1. Accédez à [supabase.co](https://supabase.co)
2. Connectez-vous à votre projet
3. Allez à **SQL Editor**
4. Cliquez sur **New query**
5. Copiez le contenu du fichier `supabase/migrations/005_add_hr_role.sql`
6. Collez-le dans l'éditeur
7. Cliquez sur **Run**

**Vérification:**
```sql
-- Vérifiez que HR est dans l'enum
SELECT unnest(enum_range(NULL::user_role))::text AS role;
-- Vous devriez voir: SUPER_ADMIN, ADMIN, SECRETARY, ACCOUNTANT, TEACHER, PARENT, HR
```

---

### Migration 007: Ajout de la colonne matricule
**Fichier:** `supabase/migrations/007_add_matricule_column.sql`

**Impact:** Ajoute une colonne `matricule` à la table `students`

**Étapes:**
1. Accédez à [supabase.co](https://supabase.co)
2. Connectez-vous à votre projet
3. Allez à **SQL Editor**
4. Cliquez sur **New query**
5. Copiez le contenu du fichier `supabase/migrations/007_add_matricule_column.sql`
6. Collez-le dans l'éditeur
7. Cliquez sur **Run**

**Vérification:**
```sql
-- Vérifiez que la colonne existe
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'matricule';
-- Devrait retourner: matricule | character varying
```

---

## Vérification du Système HR Complet

### ✅ Points Validés

1. **Dashboard HR**
   - Page: `/src/app/dashboard/hr/page.tsx`
   - Statut: ✅ Complète avec 3 onglets (Aperçu, Personnel, Affectations)
   - Fonctionnalités:
     - Tableau de bord avec statistiques
     - Gestion du personnel
     - Gestion des affectations
     - Suppression de personnel et d'affectations

2. **Navigation HR**
   - Fichier: `/src/components/layout/AppShell.tsx`
   - Items présents:
     - "Tableau de bord" → `/dashboard/hr`
     - "Gestion RH" → `/dashboard/hr`
   - Filtre: `roles: ['HR']` ✅

3. **Routage HR**
   - Fichier: `/src/hooks/useAuth.ts`
   - Fonction: `resolveDashboardRoute()`
   - Route HR: `/dashboard/hr` ✅

4. **Création d'utilisateurs HR**
   - Fichier: `/src/app/dashboard/super-admin/accounts/page.tsx`
   - Rôle HR disponible dans la création ✅
   - Label: "Ressources Humaines"
   - Couleur: Orange

5. **RLS Helper Function**
   - Fichier: `/supabase/migrations/002_rls_policies.sql`
   - Fonction: `auth.is_hr()`
   - Statut: ✅ Implémentée (ligne 73-76)

---

## Workflow de Test HR

### 1. Création d'un utilisateur HR
1. Allez à **Super Admin** → **Gestion des utilisateurs**
2. Cliquez sur **Ajouter un utilisateur**
3. Remplissez le formulaire:
   - Email: `hr@ecole.com`
   - Nom complet: `Responsable RH`
   - Téléphone: (optionnel)
   - Rôle: **Ressources Humaines**
   - Mot de passe: (au minimum 6 caractères)
4. Cliquez sur **Créer**

### 2. Connexion en tant que HR
1. Déconnectez-vous
2. Connectez-vous avec `hr@ecole.com`
3. Vous devriez être redirigé vers `/dashboard/hr`

### 3. Navigation HR
1. Vérifiez que vous voyez les éléments de navigation:
   - "Tableau de bord" (Ressources Humaines)
   - "Gestion RH"
2. Vous ne devriez PAS voir les éléments d'admin (Finance, Comptabilité, etc.)

### 4. Onglets du Dashboard HR
1. **Aperçu**: Affiche les statistiques
   - Personnel total
   - Enseignants
   - Classes actives
   - Présences aujourd'hui

2. **Personnel**: Liste complète du personnel
   - Nom, Email, Rôle, Téléphone, Statut
   - Bouton supprimer

3. **Affectations**: Affectations des enseignants aux classes
   - Enseignant, Classe, Matière, Type
   - Bouton supprimer

---

## Workflow de Création d'Étudiant (Complet)

### Prérequis
- Migration 007 appliquée (colonne matricule)
- Être connecté en tant qu'Admin

### Étapes
1. Allez à **Dashboard Admin** → **Gestion des élèves**
2. Cliquez sur **Ajouter un élève**
3. Remplissez le formulaire étudiant:
   - Prénom: `Jean`
   - Nom: `Dupont`
   - Numéro étudiant: (laissez vide, généré automatiquement)
   - Email: `jean.dupont@ecole.com`
   - Classe: Sélectionnez une classe
4. Remplissez les informations du parent:
   - Prénom parent: `Marie`
   - Nom parent: `Dupont`
   - Email parent: `marie.dupont@email.com`
   - Téléphone: (optionnel)
5. Cliquez sur **Créer l'élève**

### Vérifications post-création
1. **Étudiant créé**
   - Matricule généré au format: `YYYY-III-NNNN`
   - Exemple: `2024-DUP-4521`
   - Assigné à la classe sélectionnée

2. **Compte parent créé**
   - Email: `marie.dupont@email.com`
   - Rôle: `PARENT`
   - Mot de passe initial: `Parent123!`
   - Flag: `must_change_password = true`

3. **Relation créée**
   - Table: `parents_students`
   - Relationship: `Tuteur`
   - is_primary_contact: `true`

4. **Test de connexion parent**
   - Déconnectez-vous
   - Connectez-vous avec: `marie.dupont@email.com` / `Parent123!`
   - Vous devriez voir un modal de changement de mot de passe
   - Confirmez que vous NE POUVEZ PAS fermer le modal (non-closable)
   - Changez le mot de passe
   - Vous devriez alors accéder au dashboard parent
   - Vérifiez que l'élève est listé dans "Mes enfants"

---

## Checklist de Déploiement

### Base de Données (URGENT - BLOQUE LA CRÉATION D'UTILISATEURS HR)
- [ ] 🔴 **CRITIQUE:** Migration 005 appliquée (enum HR) - SANS CELA, IMPOSSIBLE DE CRÉER DES UTILISATEURS HR
- [ ] Migration 007 appliquée (matricule)

### Code
- [x] Page HR implémentée
- [x] Navigation HR implémentée
- [x] Routage HR implémenté
- [x] Création d'utilisateurs HR dans l'interface
- [x] RLS function is_hr() dans migrations

### Tests Manuels (Après application de la migration 005)
- [ ] Création d'utilisateur HR
- [ ] Connexion en tant que HR
- [ ] Accès au dashboard HR
- [ ] Navigation HR correcte
- [ ] Création d'étudiant avec matricule (après migration 007)
- [ ] Création de compte parent
- [ ] Changement de mot de passe parent obligatoire
- [ ] Accès parent dashboard

---

## Dépannage

### Erreur: "is_hr() function not found"
**Cause:** La migration 002 n'a pas été appliquée
**Solution:** Appliquez la migration 002_rls_policies.sql via SQL Editor

### Erreur: "No matricule column"
**Cause:** La migration 007 n'a pas été appliquée
**Solution:** Appliquez la migration 007_add_matricule_column.sql via SQL Editor

### Le dashboard HR n'affiche pas les données
**Cause:** RLS policies peuvent être restrictives
**Solution:** Vérifiez que l'utilisateur HR a le role 'HR' dans la table users

### Accès au dashboard parent impossible après création
**Cause:** Le modal de changement de mot de passe n'apparaît pas
**Solution:** 
1. Vérifiez que `must_change_password = true` dans la table users
2. Vérifiez que le flag est bien réinitialisé à `false` après changement
3. Vérifiez les logs du navigateur (F12 → Console)

---

## Fichiers Modifiés

```
src/
├── app/
│   └── dashboard/
│       ├── admin/
│       │   └── students/page.tsx (↑ Auto-matricule + parent creation)
│       ├── parent/
│       │   └── page.tsx (↑ Mandatory password change)
│       ├── super-admin/
│       │   └── accounts/page.tsx (↑ HR role in creation)
│       └── hr/
│           └── page.tsx (✓ Complete HR dashboard)
├── components/
│   └── layout/
│       └── AppShell.tsx (✓ HR navigation)
└── hooks/
    └── useAuth.ts (✓ HR routing)

supabase/
└── migrations/
    ├── 002_rls_policies.sql (↑ is_hr() function)
    └── 007_add_matricule_column.sql (✓ New)
```

---

## Support

Pour toute question ou problème, consultez:
1. Les logs du navigateur (F12 → Console)
2. Les logs Supabase (Supabase Dashboard → Logs)
3. La documentation Next.js: https://nextjs.org/docs
4. La documentation Supabase: https://supabase.com/docs
