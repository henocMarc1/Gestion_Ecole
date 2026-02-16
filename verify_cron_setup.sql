-- Vérifier que tout est bien configuré

-- 1. Voir les jobs cron actifs
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    active
FROM cron.job
WHERE jobname = 'daily-payment-check';

-- 2. Tester manuellement (devrait créer des rappels si des étudiants sont en retard)
SELECT trigger_daily_payment_check();

-- 3. Voir l'historique des exécutions (si le job a déjà tourné)
SELECT 
    jobid,
    runid,
    start_time,
    end_time,
    status,
    return_message
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 5;

-- 4. Compter les rappels créés
SELECT 
    reminder_level,
    COUNT(*) as count
FROM payment_reminders
GROUP BY reminder_level
ORDER BY reminder_level;
