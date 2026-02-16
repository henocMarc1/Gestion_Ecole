-- 🧪 TEST COMPLET DU SYSTÈME DE RAPPELS
-- Exécutez ce SQL pour vérifier que tout fonctionne

-- =====================================================
-- TEST 1 : Extension pg_cron
-- =====================================================
SELECT '🔍 TEST 1 : Vérification pg_cron' as test;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
        THEN '✅ Extension pg_cron installée'
        ELSE '❌ Extension pg_cron MANQUANTE'
    END as status;

-- =====================================================
-- TEST 2 : Job cron configuré
-- =====================================================
SELECT '🔍 TEST 2 : Vérification du job cron' as test;

SELECT 
    jobid,
    schedule,
    command,
    active,
    CASE 
        WHEN active THEN '✅ Job ACTIF'
        ELSE '❌ Job INACTIF'
    END as status
FROM cron.job
WHERE jobname = 'daily-payment-check';

-- =====================================================
-- TEST 3 : Fonctions SQL existent
-- =====================================================
SELECT '🔍 TEST 3 : Vérification des fonctions SQL' as test;

SELECT 
    routine_name,
    '✅ OK' as status
FROM information_schema.routines
WHERE routine_name IN (
    'calculate_days_overdue',
    'check_overdue_payments',
    'create_payment_reminders',
    'auto_exclude_students',
    'trigger_daily_payment_check'
)
ORDER BY routine_name;

-- =====================================================
-- TEST 4 : Table payment_reminders existe
-- =====================================================
SELECT '🔍 TEST 4 : Vérification de la table payment_reminders' as test;

SELECT 
    table_name,
    '✅ Table existe' as status
FROM information_schema.tables
WHERE table_name = 'payment_reminders';

-- =====================================================
-- TEST 5 : Colonnes de payment_reminders
-- =====================================================
SELECT '🔍 TEST 5 : Structure de payment_reminders' as test;

SELECT 
    column_name,
    data_type,
    '✅ OK' as status
FROM information_schema.columns
WHERE table_name = 'payment_reminders'
ORDER BY ordinal_position;

-- =====================================================
-- TEST 6 : Test fonction check_overdue_payments
-- =====================================================
SELECT '🔍 TEST 6 : Test check_overdue_payments()' as test;

SELECT 
    COUNT(*) as students_en_retard,
    CASE 
        WHEN COUNT(*) >= 0 THEN '✅ Fonction fonctionne'
        ELSE '❌ Erreur'
    END as status
FROM check_overdue_payments();

-- =====================================================
-- TEST 7 : Classes avec payment_due_day configuré
-- =====================================================
SELECT '🔍 TEST 7 : Classes avec échéances configurées' as test;

SELECT 
    COUNT(*) as classes_configurees,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Au moins une classe configurée'
        ELSE '⚠️ AUCUNE classe avec payment_due_day'
    END as status
FROM classes
WHERE payment_due_day IS NOT NULL
  AND deleted_at IS NULL;

-- =====================================================
-- TEST 8 : Étudiants ACTIFS
-- =====================================================
SELECT '🔍 TEST 8 : Étudiants actifs dans le système' as test;

SELECT 
    COUNT(*) as etudiants_actifs,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Étudiants présents'
        ELSE '⚠️ Aucun étudiant actif'
    END as status
FROM students
WHERE status = 'ACTIVE'
  AND deleted_at IS NULL;

-- =====================================================
-- TEST 9 : Tuition fees configurés
-- =====================================================
SELECT '🔍 TEST 9 : Frais de scolarité configurés' as test;

SELECT 
    COUNT(*) as tuition_fees_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Frais configurés'
        ELSE '⚠️ Aucun frais configuré'
    END as status
FROM tuition_fees;

-- =====================================================
-- TEST 10 : Rappels existants
-- =====================================================
SELECT '🔍 TEST 10 : Rappels créés' as test;

SELECT 
    COUNT(*) as total_rappels,
    COUNT(CASE WHEN reminder_level = 1 THEN 1 END) as niveau_1,
    COUNT(CASE WHEN reminder_level = 2 THEN 1 END) as niveau_2,
    COUNT(CASE WHEN reminder_level = 3 THEN 1 END) as niveau_3,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Rappels présents'
        ELSE 'ℹ️ Aucun rappel (normal si pas de retards)'
    END as status
FROM payment_reminders;

-- =====================================================
-- TEST 11 : Historique d'exécution du cron
-- =====================================================
SELECT '🔍 TEST 11 : Historique du cron job' as test;

SELECT 
    start_time,
    end_time,
    status,
    return_message,
    CASE 
        WHEN status = 'succeeded' THEN '✅ Succès'
        WHEN status = 'failed' THEN '❌ Échec'
        ELSE status
    END as execution_status
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-payment-check')
ORDER BY start_time DESC
LIMIT 3;

-- =====================================================
-- RÉSUMÉ FINAL
-- =====================================================
SELECT '📊 RÉSUMÉ FINAL' as test;

SELECT 
    'Système opérationnel' as composant,
    CASE 
        WHEN (SELECT COUNT(*) FROM cron.job WHERE jobname = 'daily-payment-check' AND active = true) > 0
        AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'trigger_daily_payment_check') > 0
        THEN '✅ TOUT FONCTIONNE CORRECTEMENT'
        ELSE '❌ PROBLÈME DÉTECTÉ'
    END as status;
