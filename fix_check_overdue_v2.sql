-- FIX: Fonction check_overdue_payments avec noms de colonnes CORRIGÉS
-- Version 1: Si les colonnes sont total_amount et amount_paid

CREATE OR REPLACE FUNCTION check_overdue_payments()
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    parent_id UUID,
    parent_name TEXT,
    class_id UUID,
    class_name TEXT,
    school_id UUID,
    month INTEGER,
    year INTEGER,
    due_date DATE,
    days_overdue INTEGER,
    amount_due DECIMAL,
    reminder_level INTEGER,
    should_exclude BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS student_id,
        (s.first_name || ' ' || s.last_name) AS student_name,
        ps.parent_id,
        u.full_name AS parent_name,
        s.class_id,
        c.name AS class_name,
        s.school_id,
        EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS month,
        EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS year,
        (DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE AS due_date,
        calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) AS days_overdue,
        COALESCE(
            (SELECT (tf_inner.total_amount - COALESCE(tf_inner.amount_paid, 0))
             FROM tuition_fees tf_inner
             WHERE tf_inner.student_id = s.id 
             AND tf_inner.year_id = (SELECT id FROM years WHERE is_current = true LIMIT 1)
             LIMIT 1),
            0
        ) AS amount_due,
        CASE 
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) BETWEEN 1 AND 14 THEN 1
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) BETWEEN 15 AND 29 THEN 2
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) >= 30 THEN 3
            ELSE 0
        END AS reminder_level,
        calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) >= 30 AS should_exclude
    FROM students s
    INNER JOIN classes c ON s.class_id = c.id
    INNER JOIN parents_students ps ON s.id = ps.student_id AND ps.is_primary_contact = true
    INNER JOIN users u ON ps.parent_id = u.id
    WHERE 
        s.deleted_at IS NULL
        AND s.status = 'active'
        AND calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) > 0
        AND EXISTS (
            SELECT 1 FROM tuition_fees tf_check
            WHERE tf_check.student_id = s.id
            AND tf_check.year_id = (SELECT id FROM years WHERE is_current = true LIMIT 1)
            AND (tf_check.amount_paid IS NULL OR tf_check.amount_paid < tf_check.total_amount)
        );
END;
$$ LANGUAGE plpgsql;

-- Test
SELECT * FROM check_overdue_payments() LIMIT 5;
