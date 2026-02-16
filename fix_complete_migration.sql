-- Migration complète - Toutes les parties manquantes
-- Exécutez ce SQL dans Supabase SQL Editor si des éléments manquent

-- =====================================================
-- 1. FONCTION: auto_exclude_students
-- =====================================================
CREATE OR REPLACE FUNCTION auto_exclude_students()
RETURNS INTEGER AS $$
DECLARE
    excluded_count INTEGER := 0;
BEGIN
    UPDATE students
    SET 
        status = 'suspended',
        updated_at = NOW()
    WHERE id IN (
        SELECT DISTINCT student_id
        FROM payment_reminders
        WHERE reminder_level = 3
        AND status = 'excluded'
        AND excluded_at IS NOT NULL
    )
    AND status = 'active';
    
    GET DIAGNOSTICS excluded_count = ROW_COUNT;
    
    RETURN excluded_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. VUE: active_payment_reminders
-- =====================================================
CREATE OR REPLACE VIEW active_payment_reminders AS
SELECT 
    pr.*,
    s.first_name || ' ' || s.last_name AS student_name,
    s.matricule AS student_matricule,
    u.full_name AS parent_name,
    u.email AS parent_email,
    u.phone AS parent_phone,
    c.name AS class_name,
    c.level AS class_level
FROM payment_reminders pr
INNER JOIN students s ON pr.student_id = s.id
INNER JOIN users u ON pr.parent_id = u.id
INNER JOIN classes c ON pr.class_id = c.id
WHERE pr.status IN ('sent', 'excluded')
ORDER BY pr.days_overdue DESC, pr.created_at DESC;

-- =====================================================
-- 3. VUE: payment_overdue_stats
-- =====================================================
CREATE OR REPLACE VIEW payment_overdue_stats AS
SELECT 
    c.id AS class_id,
    c.name AS class_name,
    c.payment_due_day,
    COUNT(DISTINCT pr.student_id) AS students_overdue,
    COUNT(DISTINCT CASE WHEN pr.reminder_level = 1 THEN pr.student_id END) AS level_1_count,
    COUNT(DISTINCT CASE WHEN pr.reminder_level = 2 THEN pr.student_id END) AS level_2_count,
    COUNT(DISTINCT CASE WHEN pr.reminder_level = 3 THEN pr.student_id END) AS excluded_count,
    SUM(pr.amount_due) AS total_amount_due,
    AVG(pr.days_overdue) AS avg_days_overdue
FROM classes c
LEFT JOIN payment_reminders pr ON c.id = pr.class_id AND pr.status IN ('sent', 'excluded')
GROUP BY c.id, c.name, c.payment_due_day;

-- =====================================================
-- FIN - Vérification
-- =====================================================
-- Vérifiez que tout existe :
SELECT 'Fonction auto_exclude_students' AS element, COUNT(*) AS existe
FROM information_schema.routines 
WHERE routine_name = 'auto_exclude_students'
UNION ALL
SELECT 'Vue active_payment_reminders', COUNT(*)
FROM information_schema.views 
WHERE table_name = 'active_payment_reminders'
UNION ALL
SELECT 'Vue payment_overdue_stats', COUNT(*)
FROM information_schema.views 
WHERE table_name = 'payment_overdue_stats';

-- Résultat attendu : 3 lignes avec "existe = 1"
