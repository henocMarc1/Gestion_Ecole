-- Test de la migration notification_read_tracking

-- 1. Vérifier que les nouvelles colonnes existent
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
  AND column_name = 'read_count';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notification_recipients' 
  AND column_name IN ('read_at', 'read_from_device', 'read_ip_address');

-- 2. Vérifier que les vues existent
SELECT viewname 
FROM pg_views 
WHERE viewname IN ('notification_read_stats', 'notification_readers_detail');

-- 3. Vérifier que le trigger existe
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_read_count';

-- 4. Tester la vue notification_read_stats
SELECT * FROM notification_read_stats LIMIT 5;

-- 5. Tester la vue notification_readers_detail
SELECT * FROM notification_readers_detail LIMIT 5;

-- 6. Compter les notifications avec leurs statistiques
SELECT 
    COUNT(*) as total_notifications,
    SUM(read_count) as total_reads,
    AVG(read_count) as avg_reads_per_notification
FROM notifications
WHERE status = 'sent';
