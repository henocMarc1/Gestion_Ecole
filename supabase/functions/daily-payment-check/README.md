# Daily Payment Check - Supabase Edge Function

Cette fonction Edge automatise la vérification quotidienne des paiements en retard et l'exclusion automatique des élèves.

## 🎯 Fonctionnalités

1. **Création de rappels** : Appelle `create_payment_reminders()` pour générer les rappels
2. **Exclusion automatique** : Appelle `auto_exclude_students()` pour suspendre les élèves avec 30+ jours de retard
3. **Préparation des notifications** : Liste les rappels prêts à être envoyés
4. **Logging complet** : Trace toutes les opérations pour le monitoring

## 📦 Déploiement

### 1. Installer Supabase CLI

```bash
# Windows (PowerShell)
scoop install supabase

# Ou via npm
npm install -g supabase
```

### 2. Se connecter à Supabase

```bash
supabase login
```

### 3. Lier le projet

```bash
# Dans le dossier ECOLE
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"

# Lier le projet (remplacer YOUR-PROJECT-REF)
supabase link --project-ref YOUR-PROJECT-REF
```

Pour trouver votre PROJECT-REF :
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet
- L'URL sera : `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`

### 4. Déployer la fonction

```bash
supabase functions deploy daily-payment-check
```

### 5. Vérifier le déploiement

```bash
# Tester manuellement la fonction
supabase functions invoke daily-payment-check --no-verify-jwt

# Voir les logs
supabase functions logs daily-payment-check
```

## ⏰ Configuration du Cron (Planification quotidienne)

### Option 1 : Via l'interface Supabase (Recommandé)

1. Allez sur https://supabase.com/dashboard/project/YOUR-PROJECT-REF/database/cron-jobs
2. Cliquez sur "Create a new cron job"
3. Configuration :
   - **Name** : `daily-payment-check`
   - **Schedule** : `0 8 * * *` (tous les jours à 8h00)
   - **SQL Query** :
   ```sql
   SELECT
     net.http_post(
       url:='https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-payment-check',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR-ANON-KEY"}'::jsonb,
       body:='{}'::jsonb
     ) as request_id;
   ```
4. Cliquez sur "Create cron job"

### Option 2 : Via SQL

```sql
-- Activer l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Créer le cron job
SELECT cron.schedule(
  'daily-payment-check',
  '0 8 * * *',  -- Tous les jours à 8h00
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

**Remplacer** :
- `YOUR-PROJECT-REF` par votre référence de projet
- `YOUR-ANON-KEY` par votre clé anon (Settings > API)

### Vérifier le cron job

```sql
-- Lister tous les cron jobs
SELECT * FROM cron.job;

-- Voir l'historique d'exécution
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-payment-check')
ORDER BY start_time DESC 
LIMIT 10;
```

## 🔍 Monitoring

### Voir les logs en temps réel

```bash
supabase functions logs daily-payment-check --tail
```

### Tester manuellement

```bash
# Test local
curl -X POST http://localhost:54321/functions/v1/daily-payment-check \
  -H "Authorization: Bearer YOUR-ANON-KEY"

# Test production
curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-payment-check \
  -H "Authorization: Bearer YOUR-ANON-KEY"
```

### Réponse attendue

```json
{
  "success": true,
  "timestamp": "2026-02-11T08:00:00.000Z",
  "remindersCreated": 15,
  "studentsExcluded": 3,
  "notificationsSent": 12,
  "details": {
    "reminders": {
      "created": 15,
      "message": "15 payment reminders processed"
    },
    "exclusions": {
      "excluded": 3,
      "message": "⚠️ 3 student(s) excluded due to 30+ days overdue"
    },
    "notifications": {
      "ready": 12,
      "message": "12 notifications ready to send"
    }
  }
}
```

## 🛠️ Configuration avancée

### Changer l'heure d'exécution

```sql
-- À 6h00 au lieu de 8h00
SELECT cron.schedule(
  'daily-payment-check',
  '0 6 * * *',
  $$ ... $$
);

-- Deux fois par jour (8h et 18h)
SELECT cron.schedule(
  'daily-payment-check-morning',
  '0 8 * * *',
  $$ ... $$
);

SELECT cron.schedule(
  'daily-payment-check-evening',
  '0 18 * * *',
  $$ ... $$
);
```

### Ajouter des alertes

```sql
-- Créer une table pour les logs
CREATE TABLE IF NOT EXISTS payment_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMP DEFAULT NOW(),
  reminders_created INTEGER,
  students_excluded INTEGER,
  success BOOLEAN,
  error_message TEXT
);

-- Modifier le cron pour logger
SELECT cron.schedule(
  'daily-payment-check',
  '0 8 * * *',
  $$
  DO $$
  DECLARE
    result jsonb;
  BEGIN
    SELECT net.http_post(
      url:='https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-payment-check',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR-ANON-KEY"}'::jsonb
    )::jsonb INTO result;
    
    INSERT INTO payment_check_logs (success, reminders_created, students_excluded)
    VALUES (true, (result->>'remindersCreated')::int, (result->>'studentsExcluded')::int);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO payment_check_logs (success, error_message)
    VALUES (false, SQLERRM);
  END;
  $$;
  $$
);
```

## 🐛 Dépannage

### La fonction ne se déploie pas

```bash
# Vérifier que vous êtes dans le bon dossier
pwd

# Vérifier la structure des fichiers
ls supabase/functions/daily-payment-check/

# Relancer le déploiement avec --debug
supabase functions deploy daily-payment-check --debug
```

### Le cron ne s'exécute pas

```sql
-- Vérifier que pg_cron est activé
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Vérifier le statut du job
SELECT * FROM cron.job WHERE jobname = 'daily-payment-check';

-- Vérifier les erreurs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-payment-check')
ORDER BY start_time DESC;
```

### Erreur 401 (Unauthorized)

Vérifier que :
1. L'ANON_KEY est correcte
2. Les RLS policies permettent l'accès
3. La fonction utilise bien le SERVICE_ROLE_KEY

### La fonction retourne une erreur 500

```bash
# Voir les logs détaillés
supabase functions logs daily-payment-check --tail

# Tester localement
supabase functions serve daily-payment-check
```

## 📊 Métriques à surveiller

**Quotidiennement** :
- ✅ Nombre de rappels créés
- ✅ Nombre d'exclusions
- ✅ Temps d'exécution

**Hebdomadairement** :
- 📈 Tendance des retards
- 💰 Montant total des impayés
- 📧 Taux de réponse aux rappels

**Mensuellement** :
- 🎯 Efficacité du système
- 📉 Réduction des impayés
- 🔧 Optimisations possibles

## 🔗 Ressources

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [Deno Documentation](https://deno.land/)

## 📞 Support

En cas de problème, consulter :
1. Les logs de la fonction : `supabase functions logs daily-payment-check`
2. Les logs du cron : `SELECT * FROM cron.job_run_details`
3. Le guide principal : `PAYMENT_REMINDERS_GUIDE.md`
