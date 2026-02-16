-- FIX FINAL : check_overdue_payments avec la vraie structure
-- tuition_fees contient les frais PAR CLASSE (pas par étudiant)

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
        
        -- Récupérer le montant total des frais de la classe
        COALESCE(
            (SELECT tf.total_amount
             FROM tuition_fees tf
             WHERE tf.class_id = s.class_id 
             AND tf.school_id = s.school_id
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
        AND s.status = 'ACTIVE'
        AND c.payment_due_day IS NOT NULL
        AND calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) > 0
        AND EXISTS (
            SELECT 1 FROM tuition_fees tf_check
            WHERE tf_check.class_id = s.class_id
            AND tf_check.school_id = s.school_id
        );
END;
$$ LANGUAGE plpgsql;

-- Test
SELECT * FROM check_overdue_payments() LIMIT 5;
