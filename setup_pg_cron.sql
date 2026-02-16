-- SOLUTION 2: pg_cron directement dans Supabase
-- Exécutez ce SQL dans Supabase SQL Editor

-- 1. Activer l'extension pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Créer une fonction wrapper qui appelle l'Edge Function via HTTP
CREATE OR REPLACE FUNCTION trigger_daily_payment_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    response_status INTEGER;
BEGIN
    -- Appeler directement les fonctions SQL au lieu de l'Edge Function
    PERFORM create_payment_reminders();
    PERFORM auto_exclude_students();
    
    RAISE NOTICE 'Daily payment check completed at %', NOW();
END;
$$;

-- 3. Planifier l'exécution tous les jours à 8h00
SELECT cron.schedule(
    'daily-payment-check',           -- nom du job
    '0 8 * * *',                     -- tous les jours à 8h00
    'SELECT trigger_daily_payment_check();'
);

-- 4. Vérifier que le job est créé
SELECT * FROM cron.job;

-- 5. Pour tester immédiatement :
SELECT trigger_daily_payment_check();

-- 6. Pour voir l'historique d'exécution :
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- 7. Pour désactiver le job si besoin :
-- SELECT cron.unschedule('daily-payment-check');
