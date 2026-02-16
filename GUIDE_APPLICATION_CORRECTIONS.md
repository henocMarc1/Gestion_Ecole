# GUIDE D'APPLICATION DES CORRECTIONS

## 1. Appliquer les migrations Supabase

### Option A: Via l'interface Supabase (Recommandé)

1. Allez à **Supabase Dashboard** → Votre projet
2. Accédez à **SQL Editor**
3. Copiez le contenu de chaque migration et exécutez-les dans l'ordre:
   - `supabase/migrations/003_add_missing_tables.sql`
   - `supabase/migrations/004_test_seed_data.sql`

### Option B: Via le CLI Supabase (Si configuré)

```bash
# Naviguer au dossier du projet
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"

# Appliquer les migrations
supabase db push

# Ou si vous utilisez le client SQL directement:
psql postgresql://user:password@db.supabaseproject.com/postgres -f supabase/migrations/003_add_missing_tables.sql
psql postgresql://user:password@db.supabaseproject.com/postgres -f supabase/migrations/004_test_seed_data.sql
```

---

## 2. Vérifier les migrations

Après avoir appliqué les migrations, vérifiez que tout est en place:

```sql
-- Vérifier que la table documents existe
SELECT * FROM documents LIMIT 1;

-- Vérifier que la table accountant_reports existe
SELECT * FROM accountant_reports LIMIT 1;

-- Vérifier les données de test
SELECT COUNT(*) as total_schools FROM schools;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_classes FROM classes;
SELECT COUNT(*) as total_students FROM students;
SELECT COUNT(*) as total_fees FROM fees;
SELECT COUNT(*) as total_invoices FROM invoices;
```

---

## 3. Tester les créations par rôle

Après avoir appliqué les migrations, vous pouvez tester:

### **Directeur/Admin**
- ✅ Créer des classes (nécéssite une année académique)
- ✅ Créer des élèves (nom, prénom, date de naissance, genre)

### **Secrétaire**
- ✅ Créer des factures (élève, montant, date d'échéance)
- ✅ Télécharger des documents

### **Comptable**
- ✅ Créer des frais (nom, montant, type, année)
- ✅ Enregistrer des paiements (facture, montant, méthode)

---

## 4. Données de test disponibles

Après `004_test_seed_data.sql`, vous aurez:

| Rôle | Email | Mot de passe | Permissions |
|------|-------|--------------|-------------|
| Super Admin | superadmin@ecoltest.ci | À créer | Tous les systèmes |
| Directeur | admin@ecoltest.ci | À créer | Gestion école |
| Secrétaire | secretary@ecoltest.ci | À créer | Documents, factures |
| Comptable | accountant@ecoltest.ci | À créer | Frais, paiements |
| Enseignant | teacher@ecoltest.ci | À créer | Présences, classes |
| Parent | parent@ecoltest.ci | À créer | Consulter enfants |

**Note**: Les mots de passe doivent être créés via Supabase Auth ou un formulaire d'inscription.

---

## 5. Si vous avez encore des erreurs

### Erreur: "relation 'documents' does not exist"
→ Migration 003 n'a pas été appliquée
→ Solution: Exécuter `003_add_missing_tables.sql`

### Erreur: "column 'year_id' is required"
→ Les pages classes/fees n'ont pas été mises à jour
→ Solution: Vérifier que les fichiers .tsx ont bien les corrections

### Erreur: "column 'email' does not exist in table students"
→ Les corrections sur admin/students n'ont pas été appliquées
→ Solution: Vérifier le fichier `admin/students/page.tsx`

### Erreur: "RLS policy failed"
→ Les politiques RLS refusent l'accès
→ Solution: Vérifier que l'utilisateur a le bon rôle et school_id

---

## 6. Prochaines étapes recommandées

1. ✅ Appliquer les migrations (003 et 004)
2. ✅ Tester les créations par rôle
3. ⬜ Créer des utilisateurs réels via l'inscription
4. ⬜ Ajouter plus de données de test
5. ⬜ Configurer les notifications (messages/emails)
6. ⬜ Mettre en place les rapports (PDF export)
