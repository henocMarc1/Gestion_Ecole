# 🚀 Guide de Déploiement - Edge Function Daily Payment Check

Ce guide vous accompagne pas à pas pour déployer la fonction de vérification quotidienne des paiements.

---

## ✅ Pré-requis

Avant de commencer, assurez-vous d'avoir :
- [x] Un projet Supabase actif
- [x] Les migrations 022, 023, 024 appliquées
- [x] Node.js installé sur votre machine
- [x] Un terminal (PowerShell sur Windows)

---

## 📋 Étape 1 : Installer Supabase CLI

### Windows (PowerShell en tant qu'administrateur)

```powershell
# Option A : Via Scoop (recommandé)
# 1. Installer Scoop si pas déjà fait
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# 2. Installer Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Option B : Via npm
npm install -g supabase
```

### Vérifier l'installation

```powershell
supabase --version
# Devrait afficher : supabase version 1.x.x
```

---

## 🔐 Étape 2 : Se connecter à Supabase

```powershell
# Lancer la commande de connexion
supabase login

# Une page web s'ouvrira dans votre navigateur
# Cliquez sur "Authorize" pour autoriser l'accès
```

✅ Vous verrez : `Finished supabase login.`

---

## 🔗 Étape 3 : Lier votre projet

### 3.1 : Trouver votre PROJECT-REF

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet école
3. L'URL sera : `https://supabase.com/dashboard/project/[PROJECT-REF]`
4. Copiez le `PROJECT-REF` (ex: `abcdefghijklmnop`)

### 3.2 : Lier le projet

```powershell
# Naviguer vers le dossier du projet
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"

# Lier le projet (remplacer YOUR-PROJECT-REF)
supabase link --project-ref YOUR-PROJECT-REF
```

**Exemple** :
```powershell
supabase link --project-ref abcdefghijklmnop
```

✅ Vous verrez : `Finished supabase link.`

---

## 🚀 Étape 4 : Déployer la fonction

```powershell
# Déployer la fonction daily-payment-check
supabase functions deploy daily-payment-check

# Attendre quelques secondes...
```

✅ Vous verrez :
```
Deploying function daily-payment-check...
Deployed function daily-payment-check with version xxxxx
```

---

## ✅ Étape 5 : Tester la fonction

### 5.1 : Test manuel

```powershell
# Tester la fonction (sans authentification pour le test)
supabase functions invoke daily-payment-check --no-verify-jwt
```

**Réponse attendue** :
```json
{
  "success": true,
  "timestamp": "2026-02-11T08:00:00.000Z",
  "remindersCreated": 5,
  "studentsExcluded": 0,
  "notificationsSent": 5
}
```

### 5.2 : Voir les logs

```powershell
# Afficher les derniers logs
supabase functions logs daily-payment-check

# Ou en temps réel
supabase functions logs daily-payment-check --tail
```

---

## ⏰ Étape 6 : Configurer le Cron Job

### 6.1 : Récupérer les clés API

1. Allez sur https://supabase.com/dashboard/project/YOUR-PROJECT-REF/settings/api
2. Copiez :
   - **Project URL** : `https://YOUR-PROJECT-REF.supabase.co`
   - **anon public** : `eyJhbG...` (clé commençant par eyJ)

### 6.2 : Créer le cron job via SQL

1. Allez sur https://supabase.com/dashboard/project/YOUR-PROJECT-REF/sql/new
2. Collez ce code SQL :

```sql
-- Activer l'extension pg_cron (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Créer le cron job qui s'exécute tous les jours à 8h00
SELECT cron.schedule(
  'daily-payment-check',           -- Nom du job
  '0 8 * * *',                      -- Planning : 8h00 chaque jour
  $$
  SELECT
    net.http_post(
      url:='https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-payment-check',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR-ANON-KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

3. **IMPORTANT** : Remplacez dans le code :
   - `YOUR-PROJECT-REF` par votre référence de projet
   - `YOUR-ANON-KEY` par votre clé anon

4. Cliquez sur **RUN** en bas à droite

✅ Vous verrez : `Success. No rows returned`

### 6.3 : Vérifier le cron job

```sql
-- Lister tous les cron jobs
SELECT * FROM cron.job;
```

Vous devriez voir :
```
jobid | schedule    | command                | nodename  | nodeport | database | username | active | jobname
------|-------------|------------------------|-----------|----------|----------|----------|--------|-------------------
1     | 0 8 * * *   | SELECT net.http_post...| localhost | 5432     | postgres | postgres | t      | daily-payment-check
```

---

## 🎯 Étape 7 : Test complet

### 7.1 : Créer des données de test

```sql
-- Créer une classe avec échéance au 5 du mois
INSERT INTO classes (school_id, name, level, capacity, year_id, payment_due_day)
VALUES (
  (SELECT id FROM schools WHERE name ILIKE '%pigier%' LIMIT 1),
  'Test Rappels',
  'CP',
  30,
  (SELECT id FROM academic_years WHERE is_current = true LIMIT 1),
  5
)
RETURNING id, name, payment_due_day;

-- Vérifier qu'il y a des élèves avec frais non payés
SELECT 
  s.first_name, 
  s.last_name, 
  c.name as class_name,
  t.amount,
  t.paid_amount,
  (t.amount - t.paid_amount) as remaining
FROM students s
JOIN tuition_fees t ON t.student_id = s.id
JOIN classes c ON c.id = s.class_id
WHERE t.paid_amount < t.amount
LIMIT 5;
```

### 7.2 : Déclencher manuellement la fonction

```powershell
supabase functions invoke daily-payment-check --no-verify-jwt
```

### 7.3 : Vérifier les rappels créés

```sql
-- Voir les rappels créés
SELECT * FROM active_payment_reminders
ORDER BY days_overdue DESC
LIMIT 10;

-- Statistiques
SELECT 
  reminder_level,
  COUNT(*) as count,
  SUM(amount_due) as total_amount
FROM payment_reminders
WHERE status = 'sent'
GROUP BY reminder_level
ORDER BY reminder_level;
```

---

## 📊 Étape 8 : Monitoring

### Créer un log de surveillance

```sql
-- Créer table de logs
CREATE TABLE IF NOT EXISTS payment_cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMP DEFAULT NOW(),
  reminders_created INTEGER,
  students_excluded INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER
);

-- Créer une fonction pour logger
CREATE OR REPLACE FUNCTION log_payment_check()
RETURNS void AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  reminders_count INTEGER;
  exclusions_count INTEGER;
BEGIN
  start_time := NOW();
  
  -- Exécuter les fonctions
  SELECT create_payment_reminders() INTO reminders_count;
  SELECT auto_exclude_students() INTO exclusions_count;
  
  end_time := NOW();
  
  -- Logger le résultat
  INSERT INTO payment_cron_logs (
    reminders_created,
    students_excluded,
    execution_time_ms
  ) VALUES (
    reminders_count,
    exclusions_count,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
  );
END;
$$ LANGUAGE plpgsql;
```

### Dashboard de monitoring

```sql
-- Voir les 10 dernières exécutions
SELECT 
  executed_at,
  reminders_created,
  students_excluded,
  execution_time_ms,
  CASE WHEN success THEN '✅' ELSE '❌' END as status
FROM payment_cron_logs
ORDER BY executed_at DESC
LIMIT 10;

-- Statistiques sur 30 jours
SELECT 
  DATE(executed_at) as day,
  SUM(reminders_created) as total_reminders,
  SUM(students_excluded) as total_exclusions,
  AVG(execution_time_ms) as avg_time_ms
FROM payment_cron_logs
WHERE executed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(executed_at)
ORDER BY day DESC;
```

---

## 🎉 Félicitations !

Votre système de rappels automatiques est maintenant opérationnel ! 

### Ce qui se passe maintenant :

✅ **Chaque jour à 8h00** :
1. La fonction Edge s'exécute automatiquement
2. Elle vérifie tous les paiements en retard
3. Elle crée/met à jour les rappels selon le niveau
4. Elle exclut automatiquement les élèves avec 30+ jours de retard
5. Elle prépare la liste des notifications à envoyer

### Prochaines étapes recommandées :

1. **📧 Configurer l'envoi de notifications** (Email/SMS)
2. **📊 Consulter le dashboard admin** : `/dashboard/admin/payment-reminders`
3. **👨‍👩‍👧 Tester l'interface parent** : `/dashboard/parent/payment-reminders`
4. **🔔 Paramétrer les alertes** pour les admins

---

## 🆘 En cas de problème

### Erreur : "command not found: supabase"

```powershell
# Réinstaller Supabase CLI
npm install -g supabase

# Ou via Scoop
scoop install supabase
```

### Erreur : "Project ref not found"

```powershell
# Vérifier que vous avez bien lié le projet
supabase projects list

# Relancer le link
supabase link --project-ref YOUR-PROJECT-REF
```

### Erreur : "Failed to deploy function"

```powershell
# Vérifier les fichiers
ls supabase/functions/daily-payment-check/

# Redéployer avec debug
supabase functions deploy daily-payment-check --debug
```

### Le cron ne s'exécute pas

```sql
-- Vérifier que pg_cron est installé
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Vérifier l'historique d'exécution
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-payment-check')
ORDER BY start_time DESC;
```

### La fonction retourne une erreur

```powershell
# Voir les logs détaillés
supabase functions logs daily-payment-check --tail

# Tester localement
supabase functions serve daily-payment-check
```

---

## 📞 Besoin d'aide ?

- 📖 Documentation : [PAYMENT_REMINDERS_GUIDE.md](../PAYMENT_REMINDERS_GUIDE.md)
- 🔍 Fonction : [index.ts](daily-payment-check/index.ts)
- 💬 Support Supabase : https://supabase.com/docs

---

**Dernière mise à jour** : 11 février 2026
