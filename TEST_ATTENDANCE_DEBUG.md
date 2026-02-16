# 🔧 DEBUG - Problème d'affichage des présences chez les parents

## ÉTAPE 1 : VÉRIFIER LA MIGRATION SQL ✅

**Avez-vous exécuté le fichier DEPLOYMENT_ATTENDANCE_SESSIONS.sql ?**

Si NON :
1. Ouvrez https://dashboard.supabase.io
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** (menu gauche)
4. Créez une nouvelle requête
5. Copiez TOUT le contenu de `DEPLOYMENT_ATTENDANCE_SESSIONS.sql`
6. Exécutez (Ctrl+Enter ou bouton Run)

## ÉTAPE 2 : VÉRIFIER LA STRUCTURE DE LA TABLE

Exécutez cette requête dans Supabase SQL Editor :

```sql
-- Vérifier que la colonne session existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'attendance'
ORDER BY ordinal_position;
```

**Résultat attendu :** Vous devriez voir une colonne `session` de type `USER-DEFINED` (attendance_session)

## ÉTAPE 3 : VÉRIFIER LES DONNÉES EXISTANTES

```sql
-- Voir toutes les présences du mois en cours
SELECT 
  id, 
  date, 
  session, 
  status, 
  student_id,
  TO_CHAR(date, 'YYYY-MM-DD Day') as jour_semaine
FROM attendance
WHERE date >= '2026-01-01' AND date <= '2026-01-31'
ORDER BY date DESC, session;
```

**Si la colonne session n'existe pas :** Vous verrez une erreur → Retournez à l'ÉTAPE 1

**Si aucune donnée n'apparaît :** Continuez à l'ÉTAPE 4

## ÉTAPE 4 : INSÉRER DES DONNÉES DE TEST

Remplacez `'VOTRE-STUDENT-ID'` et `'VOTRE-CLASS-ID'` par des IDs réels :

```sql
-- 1. Trouver un student_id et class_id réels
SELECT s.id as student_id, s.first_name, s.last_name, c.id as class_id, c.name
FROM students s
JOIN classes c ON s.class_id = c.id
LIMIT 1;
```

Copiez les IDs et utilisez-les ci-dessous :

```sql
-- 2. Insérer des présences de test pour aujourd'hui
INSERT INTO attendance (student_id, class_id, date, session, status)
VALUES 
  ('VOTRE-STUDENT-ID', 'VOTRE-CLASS-ID', '2026-01-20', 'MORNING', 'PRESENT'),
  ('VOTRE-STUDENT-ID', 'VOTRE-CLASS-ID', '2026-01-20', 'AFTERNOON', 'ABSENT')
ON CONFLICT (student_id, date, session) 
DO UPDATE SET status = EXCLUDED.status;

-- 3. Insérer pour hier
INSERT INTO attendance (student_id, class_id, date, session, status)
VALUES 
  ('VOTRE-STUDENT-ID', 'VOTRE-CLASS-ID', '2026-01-17', 'MORNING', 'ABSENT'),
  ('VOTRE-STUDENT-ID', 'VOTRE-CLASS-ID', '2026-01-17', 'AFTERNOON', 'PRESENT')
ON CONFLICT (student_id, date, session) 
DO UPDATE SET status = EXCLUDED.status;
```

## ÉTAPE 5 : TESTER DANS L'APPLICATION

1. **Connectez-vous en tant qu'ENSEIGNANT**
2. Allez dans "Marquage de présence"
3. Sélectionnez une classe
4. Sélectionnez "Matin" ou "Après-midi"
5. Marquez quelques élèves présents/absents
6. Cliquez sur "Enregistrer les présences"

### Vérifiez dans la console (F12) :
- Pas d'erreur 23514 (contrainte de date)
- Message de succès "Présences enregistrées avec succès"

## ÉTAPE 6 : VÉRIFIER CHEZ LES PARENTS

1. **Connectez-vous en tant que PARENT**
2. Allez dans "Présences"
3. **Ouvrez la console (F12)**
4. Regardez les logs :
   - `📊 Données attendance récupérées:` → Vous devez voir un tableau avec des objets
   - `📊 Colonnes disponibles:` → Vous devez voir `session` dans la liste
   - `🔍 Jour X:` → Détails des sessions pour un jour
   - `🎨 Couleurs pour jour X:` → Les couleurs appliquées

### Résultats attendus dans la console :

```
📊 Données attendance récupérées: Array(4)
  0: {id: "...", date: "2026-01-20", session: "MORNING", status: "PRESENT", ...}
  1: {id: "...", date: "2026-01-20", session: "AFTERNOON", status: "ABSENT", ...}
  ...
  
📊 Colonnes disponibles: ["id", "date", "session", "status", "student_id", ...]

🔍 Jour 20 (2026-01-20):
  morningSession: {session: "MORNING", status: "PRESENT"}
  afternoonSession: {session: "AFTERNOON", status: "ABSENT"}
  morningStatus: "PRESENT"
  afternoonStatus: "ABSENT"

🎨 Couleurs pour jour 20:
  morningColor: "bg-green-100"
  afternoonColor: "bg-red-100"
  isWeekend: false
  isWednesday: false
```

### Que vérifier visuellement :

✅ La cellule du jour 20 doit être DIVISÉE en deux :
- **Moitié haute (matin)** : VERT CLAIR avec le numéro "20"
- **Moitié basse (après-midi)** : ROUGE CLAIR

✅ Une ligne grise épaisse doit séparer les deux moitiés

## ÉTAPE 7 : PROBLÈMES COURANTS

### ❌ Erreur : "column session does not exist"
**Solution :** Exécutez DEPLOYMENT_ATTENDANCE_SESSIONS.sql (retour ÉTAPE 1)

### ❌ Toutes les cellules sont blanches
**Causes possibles :**
1. Aucune donnée dans la table attendance → Ajoutez des données de test (ÉTAPE 4)
2. La colonne `session` n'existe pas → Exécutez la migration (ÉTAPE 1)
3. L'élève sélectionné n'a pas de présences → Changez d'enfant ou ajoutez des données

### ❌ Les cellules restent blanches malgré les données
**Console montre des données ?**
- OUI → Problème de rendu CSS, vérifiez que Tailwind compile correctement
- NON → Problème de requête, vérifiez le `student_id` et les dates

### ❌ Erreur 23514 lors de l'enregistrement (enseignant)
**Solution :** La contrainte de date n'a pas été mise à jour
```sql
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_attendance_date;
ALTER TABLE attendance ADD CONSTRAINT check_attendance_date 
  CHECK (date <= (CURRENT_DATE + INTERVAL '1 day'));
```

## ÉTAPE 8 : CONTACT SI PROBLÈME PERSISTE

Si après toutes ces étapes le problème persiste, envoyez-moi :

1. **Capture d'écran de la console (F12)** avec les logs
2. **Résultat de cette requête SQL :**
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance';
```
3. **Résultat de cette requête :**
```sql
SELECT id, date, session, status FROM attendance LIMIT 5;
```

---

**IMPORTANT :** Les couleurs ne peuvent s'afficher que si :
1. ✅ La migration SQL a été exécutée
2. ✅ Des données existent dans la table attendance
3. ✅ Les données ont la colonne `session` remplie
4. ✅ L'élève consulté par le parent a des présences enregistrées
